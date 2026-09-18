/**
 * Method 2 — exact lexicon v2.
 * Case-insensitive whole-token match against curated EN+CS list.
 * Also matches MULTIWORD_SWEARS as contiguous phrases.
 * Strip punctuation for match; remask letters only.
 * No leet / spacing / stem expansion (those belong to token_scorer).
 * V2b: also matches TRAIN_RUDE multiword/singles (train-derived only).
 */
import {
  applySpanMask,
  fold,
  tokenize,
  coreOf,
  stripInvisible,
} from "../lib/text.mjs";
import { LEXICON_SET, MULTIWORD_ALL as MULTIWORD_SWEARS } from "../lib/words.mjs";

export const name = "lexicon";

function findMultiword(text) {
  const spans = [];
  const lower = fold(stripInvisible(text));
  for (const phrase of MULTIWORD_SWEARS) {
    const pf = fold(phrase);
    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(pf, from);
      if (idx === -1) break;
      // map fold indices → original roughly via walk
      let fi = 0;
      let absStart = -1;
      let absEnd = -1;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (/[\u200B\u200C\u200D\u2060\uFEFF\u00AD]/.test(ch)) continue;
        const f = fold(ch);
        for (const fc of f) {
          if (fi === idx) absStart = i;
          fi++;
          if (fi === idx + pf.length) {
            absEnd = i + 1;
            break;
          }
        }
        if (absEnd !== -1) break;
      }
      if (absStart >= 0 && absEnd > absStart) {
        // Per-word censor rule (v2b): mask each content word in the phrase
        const chunk = text.slice(absStart, absEnd);
        const re = /\p{L}+/gu;
        let m;
        let any = false;
        while ((m = re.exec(chunk))) {
          any = true;
          spans.push({
            start: absStart + m.index,
            end: absStart + m.index + m[0].length,
          });
        }
        if (!any) spans.push({ start: absStart, end: absEnd });
      }
      from = idx + pf.length;
    }
  }
  return spans;
}

export function detectAndCensor(text) {
  const tokens = tokenize(text);
  const spans = [...findMultiword(text)];
  for (const t of tokens) {
    const core = coreOf(t.surface);
    if (!core) continue;
    const key = fold(stripInvisible(core));
    if (LEXICON_SET.has(key)) {
      spans.push({ start: t.start, end: t.end });
    }
  }
  const has_profanity = spans.length > 0;
  const censored = has_profanity ? applySpanMask(text, spans) : text;
  return { has_profanity, censored, spans, method_meta: { n_hits: spans.length } };
}

export default { name, detectAndCensor };
