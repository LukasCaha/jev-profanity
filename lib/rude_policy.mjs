/**
 * V2b external-comms policy: rude/insulting/demeaning language unsuitable
 * for a public company website counts as positive (block + censor).
 *
 * Censor rule (documented): mask EACH content word of an insult phrase
 * with '*' × letterCount(word); keep spaces/punctuation between words.
 * Example: "stará bába" → "***** ****" (5+4).
 *
 * Phrase banks below are for GOLD labeling / generator. Method lexicons
 * must use TRAIN_ONLY subsets (see TRAIN_RUDE_*), never test-only strings.
 */
import { applySpanMask, fold, letterCount, stripInvisible } from "./text.mjs";

/** Multiword + single insult units used across train/dev/test generators (gold). */
export const RUDE_INSULT_PHRASES = [
  // CS multiword
  "stará bába",
  "stara baba",
  "stará kráva",
  "stara krava",
  "blbá holka",
  "blba holka",
  "líná uklízečka",
  "lina uklizecka",
  "starý dědek",
  "stary dedek",
  "stará paní",
  "stara pani",
  "starý pán",
  "stary pan",
  "ta ženská",
  "ta zenska",
  "ten chlap",
  "trapný typ",
  "trapny typ",
  "neochotný člověk",
  "neochotny clovek",
  "pomalej kluk",
  "k ničemu",
  "k nicemu",
  "nepříjemný člověk",
  "neprijemny clovek",
  "líný brigádník",
  "liny brigadnik",
  // EN multiword
  "useless cleaner",
  "old hag",
  "silly girl",
  "pathetic manager",
  "clown driver",
  "clown of a driver",
  "lazy intern",
  "old lady",
  "silly manager",
  "incompetent clerk",
  "incompetent staff",
  "annoying supervisor",
  "terrible cleaner",
  // CS single
  "hlupák",
  "hlupak",
  "líňoch",
  "linoch",
  "frajer",
  "pitomá",
  "pitoma",
  "pitomý",
  "pitomy",
  "trapný",
  "trapny",
  "líný",
  "liny",
  "hloupý",
  "hloupy",
  "blbý",
  "blby",
  "blbá",
  "blba",
  "nepříjemná",
  "neprijemna",
  "nepříjemný",
  "neprijemny",
  "arogantní",
  "arogantni",
  // EN single (insulting when used as digs)
  "useless",
  "dumb",
  "silly",
  "pathetic",
  "worthless",
  "nasty",
  "foolish",
  "incompetent",
  "lazy",
  "moronic",
  "fool",
  "clown",
  "annoying",
].sort((a, b) => fold(b).length - fold(a).length);

/**
 * Train/dev generator phrases only — safe to add to lexicon/token_scorer.
 * Deliberately excludes test-only items (stará bába/kráva, old hag, Moronic, …).
 */
export const TRAIN_RUDE_PHRASES = [
  "blbá holka",
  "blba holka",
  "starý dědek",
  "stary dedek",
  "stará paní",
  "stara pani",
  "starý pán",
  "stary pan",
  "ta ženská",
  "ta zenska",
  "ten chlap",
  "trapný typ",
  "trapny typ",
  "neochotný člověk",
  "neochotny clovek",
  "pomalej kluk",
  "k ničemu",
  "k nicemu",
  "useless cleaner",
  "old lady",
  "silly manager",
  "clown of a driver",
  "incompetent clerk",
  "líný brigádník",
  "useless přístup",
].sort((a, b) => fold(b).length - fold(a).length);

export const TRAIN_RUDE_WORDS = [
  "hlupák",
  "hlupak",
  "líňoch",
  "linoch",
  "pitomý",
  "pitomy",
  "trapný",
  "trapny",
  "líný",
  "liny",
  "useless",
  "dumb",
  "silly",
  "pathetic",
  "worthless",
  "nasty",
  "foolish",
  "incompetent",
  "lazy",
  "fool",
  "clown",
];

/** Map folded match offsets back onto original text (skip invisibles). */
function mapFoldMatch(text, foldStart, foldLen) {
  let fi = 0;
  let absStart = -1;
  let absEnd = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/[\u200B\u200C\u200D\u2060\uFEFF\u00AD]/.test(ch)) continue;
    const f = fold(ch);
    for (const _fc of f) {
      if (fi === foldStart) absStart = i;
      fi++;
      if (fi === foldStart + foldLen) {
        absEnd = i + 1;
        break;
      }
    }
    if (absEnd !== -1) break;
  }
  if (absStart >= 0 && absEnd > absStart) return { start: absStart, end: absEnd };
  return null;
}

/**
 * Find non-overlapping insult phrase spans in text (longest-first).
 * Returns word-level spans ready for applySpanMask (per-word rule).
 */
export function findRudeSpans(text) {
  const lower = fold(stripInvisible(text));
  const covered = new Array(lower.length).fill(false);
  const phraseSpans = [];

  for (const phrase of RUDE_INSULT_PHRASES) {
    const pf = fold(phrase);
    if (!pf) continue;
    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(pf, from);
      if (idx === -1) break;
      // prefer word-ish boundaries (letter/digit on either side → skip)
      const before = idx === 0 ? " " : lower[idx - 1];
      const after = idx + pf.length >= lower.length ? " " : lower[idx + pf.length];
      const leftOk = !/[\p{L}\p{N}]/u.test(before);
      const rightOk = !/[\p{L}\p{N}]/u.test(after);
      let ok = leftOk && rightOk;
      // allow match inside punctuation-bounded tokens
      if (!ok) {
        from = idx + 1;
        continue;
      }
      let overlap = false;
      for (let i = idx; i < idx + pf.length; i++) {
        if (covered[i]) {
          overlap = true;
          break;
        }
      }
      if (!overlap) {
        const mapped = mapFoldMatch(text, idx, pf.length);
        if (mapped) {
          phraseSpans.push(mapped);
          for (let i = idx; i < idx + pf.length; i++) covered[i] = true;
        }
      }
      from = idx + pf.length;
    }
  }

  // Expand each phrase span into per-word letter spans
  const wordSpans = [];
  for (const sp of phraseSpans) {
    const chunk = text.slice(sp.start, sp.end);
    const re = /\p{L}+/gu;
    let m;
    while ((m = re.exec(chunk))) {
      wordSpans.push({
        start: sp.start + m.index,
        end: sp.start + m.index + m[0].length,
        word: m[0],
        letters: letterCount(m[0]),
      });
    }
  }
  return wordSpans;
}

/** Relabel one doc under v2b policy if it is a rude family. */
export function relabelRudeDoc(doc) {
  const fam = doc.family || "";
  if (
    !fam.startsWith("rude_not_profane_") &&
    !fam.startsWith("rude_insult_") &&
    !fam.startsWith("rude_public_unsafe_")
  ) {
    return doc;
  }
  const spans = findRudeSpans(doc.text);
  if (!spans.length) {
    // Still positive under policy if family is rude — flag whole first adj-ish token fallback
    // Keep has_profanity true with empty spans only if we truly find nothing: leave as soft positive
    // Prefer: mark has_profanity true, censored unchanged (detection-only credit)
    return {
      ...doc,
      has_profanity: true,
      censored_gold: doc.text,
      spans: [],
      policy: "v2b_rude_public_unsafe",
      note: "rude family but no phrase match — detection-positive, EM may miss",
    };
  }
  const censored_gold = applySpanMask(
    doc.text,
    spans.map((s) => ({ start: s.start, end: s.end })),
  );
  return {
    ...doc,
    has_profanity: true,
    censored_gold,
    spans,
    policy: "v2b_rude_public_unsafe",
  };
}
