/**
 * Method 3 — token_scorer v3 (obfuscation-aware lexicon hybrid).
 *
 * Improvements vs v1:
 *  - Separator strip (dots/dashes/underscores/soft-hyphen) + leet map + ZWSP
 *  - Cyrillic→Latin confusables via fold/normalizeForms
 *  - Spaced letter-runs (incl. Czech vulgars)
 *  - Glued-stem masking: worldčurák → world***** (mask swear morpheme only)
 *  - Partial self-censor forms (f*ck → letters fck / stem match)
 *  - V3: train short-codes/algospeak via words.mjs; must NOT bake test-only (stará bába etc. — not in lexicon)
 */
import {
  applySpanMask,
  fold,
  tokenize,
  coreOf,
  normalizeForms,
  looksObfuscated,
  singletonRuns,
  stripInvisible,
  dottedLetterForm,
  mapFoldedStemToOffsets,
  letterCount,
} from "../lib/text.mjs";
import {
  inLexiconStem,
  LEXICON_SET,
  findGluedStem,
  MULTIWORD_ALL as MULTIWORD_SWEARS,
} from "../lib/words.mjs";

export const name = "token_scorer";

function formsHit(forms) {
  for (const f of forms) {
    if (!f) continue;
    if (inLexiconStem(f)) return true;
    if (LEXICON_SET.has(f)) return true;
  }
  return false;
}

/** Try to recover partial-censor stems: fck → fuck by checking lexicon with common vowel inserts — NO;
 * stick to list-anchored: if letters after strip * are stem-adjacent via collapse. */
function partialHit(forms) {
  for (const f of forms) {
    if (!f || f.length < 3) continue;
    if (inLexiconStem(f) || LEXICON_SET.has(f)) return true;
    // common self-censor pattern: missing one vowel — check known list with that property
    // Only: if removing nothing and f is prefix of a lexicon word of length f+1..f+2
    for (const w of LEXICON_SET) {
      if (w.length >= f.length && w.length <= f.length + 2) {
        // f is w with some chars deleted (at most 2)
        if (isSubsequence(f, w) && f.length >= w.length - 2) return true;
      }
    }
  }
  return false;
}

function isSubsequence(short, long) {
  let i = 0;
  for (const ch of long) {
    if (ch === short[i]) i++;
    if (i >= short.length) return true;
  }
  return i >= short.length;
}

function findMultiwordSpans(text) {
  const spans = [];
  const folded = fold(stripInvisible(text));
  // map folded index → original index (approx by walking)
  for (const phrase of MULTIWORD_SWEARS) {
    const pf = fold(phrase);
    let from = 0;
    while (from < folded.length) {
      const idx = folded.indexOf(pf, from);
      if (idx === -1) break;
      // map back: walk original
      const mapped = mapFoldRangeToOriginal(text, idx, idx + pf.length);
      if (mapped) {
        const chunk = text.slice(mapped.start, mapped.end);
        const re = /\p{L}+/gu;
        let m;
        let any = false;
        while ((m = re.exec(chunk))) {
          any = true;
          spans.push({
            start: mapped.start + m.index,
            end: mapped.start + m.index + m[0].length,
            why: "multiword",
          });
        }
        if (!any) spans.push({ ...mapped, why: "multiword" });
      }
      from = idx + pf.length;
    }
  }
  return spans;
}

function mapFoldRangeToOriginal(text, foldStart, foldEnd) {
  let fi = 0;
  let absStart = -1;
  let absEnd = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/[\u200B\u200C\u200D\u2060\uFEFF\u00AD]/.test(ch)) continue;
    const f = fold(ch);
    for (const fc of f) {
      if (fi === foldStart) absStart = i;
      fi++;
      if (fi === foldEnd) {
        absEnd = i + 1;
        break;
      }
    }
    if (absEnd !== -1) break;
  }
  if (absStart < 0 || absEnd < 0) return null;
  return { start: absStart, end: absEnd };
}



/** Keyboard-adjacent substitution only (no insert/delete — avoids hello→hell, that→twat). */
const KEY_NEAR = {
  a: "sqw", s: "awedz", d: "serfcx", f: "drtgvc", g: "ftyhbv",
  h: "gyujnb", j: "huiknm", k: "jiol", l: "kop",
  q: "wa", w: "qeas", e: "wrsd", r: "etdf", t: "ryfg",
  y: "tugh", u: "yihj", i: "uojk", o: "ipkl", p: "ol",
  z: "asx", x: "zsdc", c: "xdfv", v: "cfgb", b: "vghn",
  n: "bhjm", m: "njk",
};


/** Clean words that are 1 keyboard-adj from a swear — never typo-flag. */
const TYPO_BLOCKLIST = new Set([
  "stat", "statu", "stata", "that", "pass", "class", "classic", "glass",
  "ass", // too short anyway
  "hell", // is swear - leave
  "cut", "cant", "count", "shot", "shut", "chat", "boat", "coat",
  "duck", "luck", "rock", "dock", "sick", "thick",
  "fact", "farm", "form", "fork", "pork",
]);

function keyboardAdjTypo(norm) {
  if (!norm || norm.length < 4 || norm.length > 12) return false;
  if (TYPO_BLOCKLIST.has(norm)) return false;
  for (const w of LEXICON_SET) {
    if (w.length !== norm.length || w.length < 4) continue;
    let diff = -1;
    for (let i = 0; i < w.length; i++) {
      if (w[i] !== norm[i]) {
        if (diff !== -1) { diff = -2; break; }
        diff = i;
      }
    }
    if (diff < 0) continue;
    const from = norm[diff];
    const to = w[diff];
    if ((KEY_NEAR[from] || "").includes(to)) return true;
  }
  return false;
}

export function detectAndCensor(text) {
  const tokens = tokenize(text);
  const spans = [];
  const covered = new Set();

  // 0) multiword phrases
  for (const sp of findMultiwordSpans(text)) {
    spans.push(sp);
  }

  // 1) spaced letter runs
  for (const run of singletonRuns(text, tokens)) {
    const forms = normalizeForms(run.joined).forms;
    forms.push(fold(run.joined));
    if (formsHit(forms) || inLexiconStem(fold(run.joined.replace(/\s+/g, "")))) {
      spans.push({ start: run.start, end: run.end, why: "spaced" });
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.start >= run.start && t.end <= run.end) covered.add(i);
      }
    }
  }

  // 2) per-token
  for (let i = 0; i < tokens.length; i++) {
    if (covered.has(i)) continue;
    const t = tokens[i];
    const core = coreOf(t.surface);
    if (!core || letterCount(core) < 2) continue;

    // 2a) dotted / separator letter form inside token
    const dotted = dottedLetterForm(t.surface);
    if (dotted && (inLexiconStem(dotted) || LEXICON_SET.has(dotted))) {
      spans.push({ start: t.start, end: t.end, why: "dotted" });
      continue;
    }

    const { forms, letters, collapseAll } = normalizeForms(t.surface);
    let hit = formsHit(forms);
    if (!hit && looksObfuscated(t.surface) && letters.length >= 3) {
      hit =
        inLexiconStem(collapseAll) ||
        inLexiconStem(letters) ||
        partialHit([letters, collapseAll, ...forms]);
    }
    if (!hit && /\*/.test(t.surface)) {
      hit = partialHit(forms);
    }
    // mild keyboard-adjacency typo (single adjacent-key substitution only)
    if (!hit && letters.length >= 4 && !LEXICON_SET.has(letters)) {
      hit = keyboardAdjTypo(letters); // not collapseAll (hello→helo→hell)
    }

    // 2b) glued stem — mask only morpheme
    if (!hit) {
      const foldedCore = fold(stripInvisible(core));
      const glue = findGluedStem(foldedCore);
      if (glue) {
        const mapped = mapFoldedStemToOffsets(
          t.start,
          t.surface,
          glue.stemStart,
          glue.stemEnd,
        );
        if (mapped) {
          spans.push({ ...mapped, why: "glued_" + glue.kind });
          continue;
        }
      }
    }

    if (hit) {
      spans.push({ start: t.start, end: t.end, why: "token" });
    }
  }

  const has_profanity = spans.length > 0;
  const censored = has_profanity ? applySpanMask(text, spans) : text;
  return {
    has_profanity,
    censored,
    spans,
    method_meta: { n_hits: spans.length },
  };
}

export default { name, detectAndCensor };
