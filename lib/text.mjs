/** Shared tokenize / fold / censor helpers (v2 — research-grounded normalizers). */

/** Zero-width / invisible chars commonly used in obfuscation (ZWSP, ZWNJ, soft hyphen, …). */
export const INVISIBLE_RE = /[\u200B\u200C\u200D\u2060\uFEFF\u00AD]/g;

/** Basic Cyrillic → Latin confusable map (homoglyphs; EMNLP OTH / Bad Characters style). */
const CYR_TO_LAT = {
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  х: "x",
  у: "y",
  к: "k",
  н: "h",
  в: "b",
  м: "m",
  т: "t",
  і: "i",
  ї: "i",
  ё: "e",
  А: "a",
  Е: "e",
  О: "o",
  Р: "p",
  С: "c",
  Х: "x",
  У: "y",
  К: "k",
  Н: "h",
  В: "b",
  М: "m",
  Т: "t",
};

export function letterCount(s) {
  let n = 0;
  for (const ch of s) {
    if (/\p{L}/u.test(ch)) n++;
  }
  return n;
}

/** Strip invisible / soft-hyphen obfuscators. */
export function stripInvisible(s) {
  return String(s).replace(INVISIBLE_RE, "");
}

/**
 * Lowercase + NFKC + strip combining marks + basic Cyrillic confusables.
 * Does NOT strip ZWSP here (call stripInvisible first when desired).
 */
export function fold(s) {
  let t = String(s).normalize("NFKC");
  let out = "";
  for (const ch of t) {
    out += CYR_TO_LAT[ch] ?? ch;
  }
  return out
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/**
 * Split a span into leading punct, core, trailing punct.
 * Core starts at first letter/digit and ends at last letter/digit.
 * Invisible chars inside are kept in core.
 */
export function splitAffix(token) {
  const s = String(token);
  // V3: keep leet markers *@$ inside core so ky$ → kys via applyLeetMap
  const CORE = /[\p{L}\p{N}*@$]/u;
  const first = s.search(CORE);
  if (first === -1) return { lead: s, core: "", trail: "" };
  let last = -1;
  for (let i = s.length - 1; i >= 0; i--) {
    if (CORE.test(s[i])) {
      last = i;
      break;
    }
  }
  return {
    lead: s.slice(0, first),
    core: s.slice(first, last + 1),
    trail: s.slice(last + 1),
  };
}

/** Replace a profane span/token: core → n asterisks (n = letter count of alphabetic chars). */
export function maskToken(token) {
  const { lead, core, trail } = splitAffix(token);
  if (!core) return token;
  return lead + "*".repeat(letterCount(core)) + trail;
}

/**
 * Mask with an explicit letter count (for partial self-censor gold:
 * intended-word alphabetic letter count, not surface-with-stars).
 */
export function maskTokenWithLetters(token, nLetters) {
  const { lead, core, trail } = splitAffix(token);
  if (!core && nLetters <= 0) return token;
  return lead + "*".repeat(Math.max(0, nLetters)) + trail;
}

export function applySpanMask(text, spans) {
  const picked = pickNonOverlapping(spans);
  const sorted = [...picked].sort((a, b) => b.start - a.start);
  let out = text;
  for (const sp of sorted) {
    if (sp.start < 0 || sp.end > out.length || sp.start >= sp.end) continue;
    const chunk = out.slice(sp.start, sp.end);
    if (typeof sp.letters === "number") {
      out =
        out.slice(0, sp.start) +
        maskTokenWithLetters(chunk, sp.letters) +
        out.slice(sp.end);
    } else {
      out = out.slice(0, sp.start) + maskToken(chunk) + out.slice(sp.end);
    }
  }
  return out;
}

export function pickNonOverlapping(spans) {
  const arr = (spans || [])
    .filter((s) => s && typeof s.start === "number" && s.end > s.start)
    .sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const picked = [];
  for (const s of arr) {
    const overlaps = picked.some((p) => !(s.end <= p.start || s.start >= p.end));
    if (!overlaps) picked.push(s);
  }
  return picked.sort((a, b) => a.start - b.start);
}

/**
 * Word-like tokens: letters, digits, invisibles, and light obfuscation chars.
 * Soft hyphen / ZWSP kept inside token so we can detect them.
 */
export const TOKEN_RE = /[\p{L}\p{N}*@$._'\-\u200B\u200C\u200D\u2060\uFEFF\u00AD]+/gu;

export function tokenize(text) {
  const tokens = [];
  const re = new RegExp(TOKEN_RE.source, "gu");
  let m;
  while ((m = re.exec(text))) {
    tokens.push({
      start: m.index,
      end: m.index + m[0].length,
      surface: m[0],
    });
  }
  return tokens;
}

export function coreOf(surface) {
  return splitAffix(surface).core;
}

export function maxRepeatRun(s) {
  let max = 1;
  let run = 1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] === s[i - 1]) {
      run++;
      if (run > max) max = run;
    } else run = 1;
  }
  return max;
}

/** Leet / visual substitution map (Cleanspeak / O-Norm / word-camouflage style). */
export function applyLeetMap(s) {
  // multi-char digraphs first; never use empty-alternation regexes
  let t = s;
  t = t.replaceAll("|)", "d");
  t = t.replaceAll("|\\/", "n"); // |/ digraph for n (rare)
  t = t.replaceAll("()", "o");
  t = t.replace(/ph/gi, "f");
  t = t.replace(/0/g, "o");
  t = t.replace(/1/g, "i");
  t = t.replace(/!/g, "i");
  t = t.replace(/3/g, "e");
  t = t.replace(/4/g, "a");
  t = t.replace(/@/g, "a");
  t = t.replace(/5/g, "s");
  t = t.replace(/\$/g, "s");
  t = t.replace(/7/g, "t");
  t = t.replace(/8/g, "b");
  return t;
}

/**
 * Obfuscation-aware normalization pipeline:
 * strip invisibles → fold (NFKC + confusables) → leet map → strip separators
 * → collapse repeats. Returns several forms for lexicon matching.
 */
export function normalizeForms(surface) {
  const raw = stripInvisible(coreOf(surface));
  let t = fold(raw);
  t = applyLeetMap(t);
  const strippedSep = t.replace(/[._\-*\s\u00AD]+/g, "");
  const letters = t.replace(/[^\p{L}]/gu, "");
  const collapse3 = letters.replace(/(.)\1{2,}/gu, "$1");
  const collapseAll = letters.replace(/(.)\1+/gu, "$1");
  // partial self-censor: f*ck → fck already in letters; also try inserting likely vowel
  const forms = new Set(
    [t, strippedSep, letters, collapse3, collapseAll].filter(Boolean),
  );
  return {
    folded: t,
    letters,
    collapse3,
    collapseAll,
    strippedSep,
    forms: [...forms],
  };
}

export function looksObfuscated(surface) {
  const core = coreOf(surface);
  if (!core) return false;
  if (INVISIBLE_RE.test(core)) return true;
  if (/[*@$0-9._\-!]/.test(core) && /\p{L}/u.test(core)) return true;
  if (maxRepeatRun(fold(stripInvisible(core))) >= 3) return true;
  if (/^[\p{L}]([._\-\u00AD][\p{L}]){2,}$/u.test(stripInvisible(core))) return true;
  // mixed script (Latin + Cyrillic)
  if (/\p{Script=Latin}/u.test(core) && /\p{Script=Cyrillic}/u.test(core)) return true;
  return false;
}

/**
 * Consecutive single-letter tokens separated only by whitespace → one span.
 * Used for "f u c k" / "k u r v a".
 */
export function singletonRuns(text, tokens) {
  const runs = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    const letters = fold(stripInvisible(coreOf(t.surface))).replace(/[^\p{L}]/gu, "");
    if (letters.length !== 1) {
      i++;
      continue;
    }
    let j = i;
    let joined = letters;
    // Conjunction singles after a formed word must not extend spaced swears
    // (e.g. "f u c k a celý" — stop before Czech/EN "a").
    const SINGLE_CONJ = new Set(["a", "i", "o", "u", "y", "e"]);
    while (j + 1 < tokens.length) {
      const a = tokens[j];
      const b = tokens[j + 1];
      const between = text.slice(a.end, b.start);
      const bLetters = fold(stripInvisible(coreOf(b.surface))).replace(/[^\p{L}]/gu, "");
      if (bLetters.length !== 1) break;
      if (!/^[ \t]*$/.test(between)) break;
      if (joined.length >= 4 && SINGLE_CONJ.has(bLetters)) break;
      joined += bLetters;
      j++;
    }
    if (j > i && joined.length >= 3) {
      runs.push({
        start: tokens[i].start,
        end: tokens[j].end,
        surface: text.slice(tokens[i].start, tokens[j].end),
        joined,
      });
    }
    i = j + 1;
  }
  return runs;
}

/**
 * Map a folded-letter substring range back onto the original surface core.
 */
export function mapFoldedStemToOffsets(tokenStart, surface, foldStemStart, foldStemEnd) {
  const { lead, core } = splitAffix(surface);
  if (!core) return null;
  let foldIdx = 0;
  let absStart = -1;
  let absEnd = -1;
  const coreAbs = tokenStart + lead.length;
  for (let i = 0; i < core.length; i++) {
    const ch = core[i];
    if (INVISIBLE_RE.test(ch)) continue;
    const folded = fold(ch);
    if (!folded) continue;
    for (const fc of folded) {
      if (!/\p{L}/u.test(fc)) continue;
      if (foldIdx === foldStemStart) absStart = coreAbs + i;
      foldIdx++;
      if (foldIdx === foldStemEnd) {
        absEnd = coreAbs + i + 1;
        break;
      }
    }
    if (absEnd !== -1) break;
  }
  if (absStart < 0 || absEnd < 0 || absStart >= absEnd) return null;
  return { start: absStart, end: absEnd };
}

/** Detect dotted/underscored/soft-hyphen letter runs inside one token: f.u.c.k */
export function dottedLetterForm(surface) {
  const core = stripInvisible(coreOf(surface));
  if (!core) return null;
  if (!/^(\p{L})(?:[._\-\u00AD](\p{L})){2,}$/u.test(core)) return null;
  const letters = core.replace(/[^\p{L}]/gu, "");
  if (letters.length < 3) return null;
  return fold(letters);
}

/** Escape invisibles for display in Jev candidate lists. */
export function escapeInvisibles(s) {
  return String(s)
    .replace(/\u200B/g, "<ZWSP>")
    .replace(/\u200C/g, "<ZWNJ>")
    .replace(/\u200D/g, "<ZWJ>")
    .replace(/\u00AD/g, "<SHY>")
    .replace(/\uFEFF/g, "<BOM>");
}

export function percentile(values, p) {
  if (!values.length) return 0;
  const a = [...values].sort((x, y) => x - y);
  const idx = Math.min(a.length - 1, Math.max(0, Math.ceil((p / 100) * a.length) - 1));
  return a[idx];
}
