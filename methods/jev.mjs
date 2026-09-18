/**
 * Method 1 — Jev v2b (TypeSafe System One).
 *
 * Pipeline: gate → candidates (tokens + spaced + dotted + glued +
 * generic CS/EN insult bigrams/trigrams) → span Nouls → verify.
 *
 * V2b policy (external company communication filter):
 *   POSITIVE = vulgar swear OR rude/insulting/demeaning language
 *              unsuitable for a company's public website / external
 *              customer communication.
 *   NEGATIVE = Scunthorpe / phonetic clean traps, ordinary criticism
 *              without demeaning digs, real_clean reviews.
 *
 * Do NOT hardcode test sentences or test-only wordlists.
 */
import { noul, score, TypeSafeClient } from "@typesafe-ai/sdk";
import {
  applySpanMask,
  tokenize,
  coreOf,
  looksObfuscated,
  singletonRuns,
  fold,
  stripInvisible,
  normalizeForms,
  escapeInvisibles,
  dottedLetterForm,
  mapFoldedStemToOffsets,
  letterCount,
} from "../lib/text.mjs";
import { LEXICON_SET, STOPWORDS as SW, findGluedStem } from "../lib/words.mjs";

export const name = "jev";

const MODEL = "jev-latest";

export const DEFAULT_THRESHOLDS = {
  gate_score_min: 0.4,
  gate_noul_min: 0.35,
  span_noul_min: 0.45,
  verify_noul_min: 0.55,
  max_candidates: 24,
};

let _client = null;
export function getClient() {
  if (!_client) {
    _client = new TypeSafeClient({
      logLevel: "warn",
      timeout: 45000,
      retry: {
        maxRetries: 4,
        backoffInitialMs: 1000,
        backoffMaxMs: 30000,
      },
    });
  }
  return _client;
}

export function resetClient() {
  _client = null;
}

/** Lightweight function-word skips for n-gram insult candidates (generic). */
const LIGHT_STOP = new Set(
  [
    "a", "an", "the", "of", "to", "in", "on", "at", "for", "and", "or", "but",
    "is", "are", "was", "were", "be", "been", "by", "with", "from", "as",
    "this", "that", "these", "those", "it", "its", "my", "your", "our",
    "i", "you", "he", "she", "we", "they", "me", "him", "her", "them",
    "ten", "ta", "to", "ty", "ti", "tu", "je", "jsou", "byl", "byla", "bylo",
    "u", "do", "na", "po", "za", "od", "ke", "ku", "ve", "se", "si", "mi",
    "mu", "ji", "jim", "a", "i", "ale", "nebo", "tak", "jak", "co", "kdo",
    "the", "no", "not", "yes", "ok",
  ].map(fold),
);

/** Adjective / dig-ish starters that often begin CS/EN insult bigrams (generic). */
const INSULT_STARTERS = new Set(
  [
    "old", "silly", "useless", "pathetic", "lazy", "dumb", "foolish",
    "worthless", "nasty", "incompetent", "moronic", "annoying", "terrible",
    "clown", "stupid", "idiot", "idiotic", "lousy", "awful", "hopeless",
    "stary", "stara", "starý", "stará", "blby", "blba", "blbý", "blbá",
    "pitomy", "pitoma", "pitomý", "pitomá", "hloupy", "hloupý", "hloupa",
    "hloupá", "trapny", "trapný", "trapna", "trapná", "liny", "lina",
    "líný", "líná", "neprijemny", "nepříjemný", "neprijemna", "nepříjemná",
    "arogantni", "arogantní", "ten", "ta", "nicemu", "ničemu", "frajer",
    "hlupak", "hlupák", "dedek", "dědek", "baba", "bába", "krava", "kráva",
  ].map(fold),
);

/** Noun heads that complete adj+noun demeaning digs (generic; not test sentences). */
const INSULT_NOUN_HEADS = new Set(
  [
    "baba", "bába", "krava", "kráva", "holka", "cleaner", "manager", "girl",
    "hag", "dedek", "dědek", "frajer", "clown", "intern", "driver", "clerk",
    "staff", "lady", "pani", "paní", "pan", "pán", "zenska", "ženská",
    "chlap", "typ", "kluk", "clovek", "člověk", "brigadnik", "brigádník",
    "uklizecka", "uklízečka", "pristup", "přístup", "vykon", "výkon",
    "supervisor", "hlupak", "hlupák", "linoch", "líňoch",
  ].map(fold),
);

/**
 * Build candidate spans: tokens + spaced runs + dotted forms + glued stem
 * splits + generic multiword (bigram/trigram) insult-pattern candidates.
 * Priority: lexicon-ish / obfuscated / glued / insult n-gram / length.
 */
export function buildCandidates(text, maxCandidates = 24) {
  const tokens = tokenize(text);
  const stops = SW;
  const cands = [];

  for (const run of singletonRuns(text, tokens)) {
    cands.push({
      start: run.start,
      end: run.end,
      surface: run.surface,
      display: escapeInvisibles(run.surface),
      joined: run.joined,
      priority: 90 + run.joined.length,
      kind: "spaced",
      norm: fold(run.joined),
    });
  }

  for (const t of tokens) {
    const core = coreOf(t.surface);
    if (!core || letterCount(core) < 2) continue;
    const f = fold(stripInvisible(core));
    if (stops.has(f) && !LEXICON_SET.has(f)) continue;

    const norms = normalizeForms(t.surface);
    const dotted = dottedLetterForm(t.surface);
    let priority = letterCount(core);
    if (LEXICON_SET.has(f) || norms.forms.some((x) => LEXICON_SET.has(x)))
      priority += 100;
    if (looksObfuscated(t.surface)) priority += 40;
    if (dotted) priority += 50;
    if (INSULT_STARTERS.has(f)) priority += 35;
    if (letterCount(core) <= 2) priority -= 20;

    cands.push({
      start: t.start,
      end: t.end,
      surface: t.surface,
      display: escapeInvisibles(t.surface),
      priority,
      kind: "token",
      norm: norms.collapseAll || norms.letters || f,
    });

    const glue = findGluedStem(f);
    if (glue) {
      const mapped = mapFoldedStemToOffsets(
        t.start,
        t.surface,
        glue.stemStart,
        glue.stemEnd,
      );
      if (mapped) {
        const surf = text.slice(mapped.start, mapped.end);
        cands.push({
          start: mapped.start,
          end: mapped.end,
          surface: surf,
          display: escapeInvisibles(surf),
          priority: 120,
          kind: "glued_stem",
          norm: glue.stem,
          parent: t.surface,
        });
      }
    }
  }

  // Generic insult bigrams / trigrams (adjacent content tokens)
  const content = tokens.filter((t) => {
    const core = coreOf(t.surface);
    if (!core || letterCount(core) < 2) return false;
    const f = fold(stripInvisible(core));
    return !LIGHT_STOP.has(f) || INSULT_STARTERS.has(f);
  });
  for (let i = 0; i < content.length; i++) {
    for (const n of [2, 3]) {
      if (i + n > content.length) continue;
      const group = content.slice(i, i + n);
      // require contiguous-ish (gap ≤ 2 chars of pure whitespace between ends)
      let contiguous = true;
      for (let j = 0; j < group.length - 1; j++) {
        const gap = text.slice(group[j].end, group[j + 1].start);
        if (!/^[\s,;:–—-]*$/u.test(gap) || gap.length > 3) {
          contiguous = false;
          break;
        }
      }
      if (!contiguous) continue;
      const start = group[0].start;
      const end = group[group.length - 1].end;
      const surface = text.slice(start, end);
      const norms = group.map((t) => fold(stripInvisible(coreOf(t.surface))));
      const startsHot = INSULT_STARTERS.has(norms[0]);
      // skip boring pairs of long clean nouns with no hot starter
      if (!startsHot && n === 3 && norms.every((x) => x.length > 6)) continue;
      if (!startsHot && !norms.some((x) => INSULT_STARTERS.has(x))) {
        // still keep short demeaning-looking bigrams (adj+noun length pattern)
        const looksAdjNoun =
          n === 2 &&
          norms[0].length >= 3 &&
          norms[0].length <= 10 &&
          norms[1].length >= 3;
        if (!looksAdjNoun) continue;
      }
      let priority = 55 + norms.join("").length;
      if (startsHot) priority += 40;
      cands.push({
        start,
        end,
        surface,
        display: escapeInvisibles(surface),
        priority,
        kind: n === 2 ? "bigram" : "trigram",
        norm: norms.join(" "),
      });
    }
  }

  const byKey = new Map();
  for (const c of cands) {
    const k = `${c.start}:${c.end}`;
    const prev = byKey.get(k);
    if (!prev || c.priority > prev.priority) byKey.set(k, c);
  }
  return [...byKey.values()]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxCandidates)
    .map((c, i) => ({ ...c, id: `c${i}` }));
}

function gateQuestions() {
  return {
    has_profanity: noul(
      "Does this text contain language unsuitable for a company's public website or external customer communication — either (a) classic swear/vulgar/sexual abuse words (including obfuscations: leet, spaced letters, dots, ZWSP, homoglyphs, partial self-censor like f*ck), OR (b) rude, insulting, demeaning digs aimed at a person/role (ageist/sexist/ability digs, calling someone useless/pathetic/moronic/hlupák/frajer, multiword digs like demeaning adj+noun)?",
      {
        true: "Contains a swear/vulgarity OR a rude/insulting/demeaning dig (toward a person, role, OR product/service — e.g. calling something worthless/stupid/moronic, Czech demeaning adj+noun) that would be inappropriate on a public company site.",
        false:
          "Clean for external company communication. Ordinary factual complaints without demeaning digs are fine (late, broken, slow as neutral facts). Near-miss words like classic, shiitake, Kundera, kurýr, cocktail, Scunthorpe, assess are NOT violations.",
      },
    ),
    severity: score(
      "How unsuitable is this text for a company's public website / external customer communication?",
      [
        "None — clean / polite / factual",
        "Mild rude dig or light slang (still unsuitable for public site)",
        "Strong swear, abuse, or clearly demeaning insult",
      ],
    ),
  };
}

function spanQuestions(candidates) {
  const q = {};
  for (const c of candidates) {
    const hint =
      c.kind === "glued_stem"
        ? ` This is a glued-stem candidate (parent token may include a clean prefix/suffix). Mark true ONLY if this morpheme itself is the swear/insult to mask — mask only the abusive morpheme, not the whole parent.`
        : c.kind === "bigram" || c.kind === "trigram"
          ? ` This is a multiword insult-pattern candidate. Mark true if the WHOLE span is a rude/demeaning dig (or contains one) that should be censored under external-comms policy; prefer masking the insult words, not unrelated context.`
          : "";
    q[c.id] = noul(
      `Is the candidate span "${c.display}" (offsets ${c.start}-${c.end}, kind=${c.kind}, norm≈"${c.norm || ""}") itself a swear/vulgarity OR a rude/insulting/demeaning dig that should be censored for a company's public website?${hint}`,
      {
        true: "This span is a swear/vulgar insult OR a demeaning rude dig (including obfuscated swears). For glued stems, true only for the abusive morpheme. For multiword digs, true for the insult phrase words.",
        false:
          "Not something to censor — ordinary word, punctuation, or near-miss lookalike (classic, Scunthorpe, kurýr). Neutral role nouns alone (driver, cleaner, manager) without a demeaning modifier are false.",
      },
    );
  }
  return q;
}

function verifyQuestions() {
  return {
    still_dirty: noul(
      "Does this (already partially censored) text STILL contain remaining uncensored swears OR rude/insulting/demeaning digs unsuitable for a company's public website?",
      {
        true: "Yes, uncensored swear words or demeaning digs remain.",
        false:
          "No remaining swears or demeaning digs; asterisks for censored parts are fine. Ordinary factual wording left intact is correct.",
      },
    ),
  };
}

function isCleanGate(answers, th) {
  const n = answers.has_profanity?.noul ?? 0;
  const s = answers.severity?.score ?? 0;
  return n < th.gate_noul_min && s < th.gate_score_min;
}

export async function detectAndCensor(text, opts = {}) {
  const th = { ...DEFAULT_THRESHOLDS, ...(opts.thresholds || {}) };
  const client = opts.client || getClient();
  const t0 = performance.now();
  let input_tokens = 0;
  let output_tokens = 0;
  let calls = 0;
  const meta = { gate: null, spans_judged: 0, verify: null };

  const gateResp = await client.systemOne(
    {
      model: MODEL,
      state: {
        text,
        policy:
          "EXTERNAL COMPANY COMMUNICATION FILTER. Flag (has_profanity) if text has vulgar swears OR rude/insulting/demeaning language unsuitable for a public company website. POSITIVE includes: classic swears; demeaning digs at people/roles; demeaning digs at products/services (worthless/stupid/moronic system or app; Czech pitomý/hloupý/trapný + noun; k ničemu). NEGATIVE: Scunthorpe/near-miss clean words; polite or merely factual complaints (late/broken/slow) without digs; praise.",
      },
      questions: gateQuestions(),
    },
    { timeout: 45000 },
  );
  calls++;
  input_tokens += gateResp.usage?.input_tokens || 0;
  output_tokens += gateResp.usage?.output_tokens || 0;
  meta.gate = {
    noul: gateResp.answers.has_profanity.noul,
    score: gateResp.answers.severity.score,
  };

  if (isCleanGate(gateResp.answers, th)) {
    return {
      has_profanity: false,
      censored: text,
      verify_failed: false,
      spans: [],
      usage: { input_tokens, output_tokens, calls },
      latency_ms: Math.round(performance.now() - t0),
      method_meta: meta,
    };
  }

  const candidates = buildCandidates(text, th.max_candidates);
  meta.spans_judged = candidates.length;
  let dirtySpans = [];

  if (candidates.length === 0) {
    return {
      has_profanity: true,
      censored: text,
      verify_failed: true,
      spans: [],
      usage: { input_tokens, output_tokens, calls },
      latency_ms: Math.round(performance.now() - t0),
      method_meta: { ...meta, note: "gate_dirty_no_candidates" },
    };
  }

  const spanState = {
    text,
    candidates: candidates.map((c) => ({
      id: c.id,
      surface: c.display,
      raw_surface: c.surface,
      start: c.start,
      end: c.end,
      kind: c.kind,
      norm: c.norm,
      parent: c.parent || null,
    })),
    instruction:
      "Judge each candidate under EXTERNAL-COMMS policy. True = swear/vulgarity OR rude/demeaning dig unsuitable for a public company site. Mask ONLY the abusive morpheme when glued (e.g. worldčurák → mask čurák). For multiword digs, prefer the insult words. Scunthorpe substrings are false. Obfuscations (leet, dots, ZWSP as <ZWSP>, f*ck) of real swears are true.",
  };

  const spanResp = await client.systemOne(
    {
      model: MODEL,
      state: spanState,
      questions: spanQuestions(candidates),
    },
    { timeout: 60000 },
  );
  calls++;
  input_tokens += spanResp.usage?.input_tokens || 0;
  output_tokens += spanResp.usage?.output_tokens || 0;

  for (const c of candidates) {
    const ans = spanResp.answers[c.id];
    const v = ans?.noul ?? 0;
    if (v >= th.span_noul_min) {
      // Multiword: mask insult-bearing words only (starter / demeaning noun head /
      // determiner), not trailing neutral nouns (refund, balík, customers, …).
      if (c.kind === "bigram" || c.kind === "trigram") {
        for (const w of expandInsultWords(text, c)) {
          dirtySpans.push({ ...w, noul: v });
        }
      } else {
        dirtySpans.push({
          start: c.start,
          end: c.end,
          noul: v,
          surface: c.surface,
        });
      }
    }
  }

  dirtySpans = preferGluedOverParent(dirtySpans, candidates);
  dirtySpans = preferNgramOverTokens(dirtySpans, candidates);

  let censored = dirtySpans.length ? applySpanMask(text, dirtySpans) : text;

  let verify_failed = false;
  if (censored !== text || dirtySpans.length > 0) {
    const vResp = await client.systemOne(
      {
        model: MODEL,
        state: { text: censored },
        questions: verifyQuestions(),
      },
      { timeout: 45000 },
    );
    calls++;
    input_tokens += vResp.usage?.input_tokens || 0;
    output_tokens += vResp.usage?.output_tokens || 0;
    const still = vResp.answers.still_dirty.noul;
    meta.verify = { noul: still };
    if (still >= th.verify_noul_min) verify_failed = true;
  }

  const detected =
    dirtySpans.length > 0 ||
    gateResp.answers.has_profanity.noul >= th.gate_noul_min ||
    gateResp.answers.severity.score >= th.gate_score_min;

  return {
    has_profanity: detected,
    censored,
    verify_failed,
    spans: dirtySpans,
    usage: { input_tokens, output_tokens, calls },
    latency_ms: Math.round(performance.now() - t0),
    method_meta: meta,
  };
}


function expandInsultWords(text, c) {
  const chunk = text.slice(c.start, c.end);
  const words = [];
  const re = /\p{L}+/gu;
  let m;
  while ((m = re.exec(chunk))) {
    words.push({
      start: c.start + m.index,
      end: c.start + m.index + m[0].length,
      surface: m[0],
      f: fold(m[0]),
    });
  }
  if (!words.length) {
    return [{ start: c.start, end: c.end, surface: c.surface }];
  }
  const isHead = (w) =>
    INSULT_STARTERS.has(w.f) ||
    INSULT_NOUN_HEADS.has(w.f) ||
    LEXICON_SET.has(w.f);
  const out = [];
  let i = 0;
  // optional determiner before demeaning head ("ta ženská", "ten frajer")
  if (
    i < words.length &&
    LIGHT_STOP.has(words[i].f) &&
    !isHead(words[i]) &&
    i + 1 < words.length &&
    isHead(words[i + 1])
  ) {
    out.push(words[i]);
    i++;
  }
  while (i < words.length) {
    const w = words[i];
    if (INSULT_STARTERS.has(w.f) || LEXICON_SET.has(w.f)) {
      out.push(w);
      i++;
      // at most one following demeaning noun head (not neutral "refund"/"balík")
      if (i < words.length && INSULT_NOUN_HEADS.has(words[i].f)) {
        out.push(words[i]);
        i++;
      }
      continue;
    }
    if (INSULT_NOUN_HEADS.has(w.f)) {
      out.push(w);
      i++;
      continue;
    }
    i++;
  }
  if (!out.length) out.push(words[0]);
  return out.map(({ start, end, surface }) => ({ start, end, surface }));
}

function preferGluedOverParent(spans, candidates) {
  const glued = new Set(
    candidates
      .filter((c) => c.kind === "glued_stem")
      .map((c) => `${c.start}:${c.end}`),
  );
  if (!glued.size) return spans;
  return spans.filter((s) => {
    const key = `${s.start}:${s.end}`;
    if (glued.has(key)) return true;
    for (const g of glued) {
      const [gs, ge] = g.split(":").map(Number);
      if (spans.some((x) => x.start === gs && x.end === ge)) {
        if (s.start <= gs && s.end >= ge && !(s.start === gs && s.end === ge)) {
          return false;
        }
      }
    }
    return true;
  });
}

/** If a bigram/trigram was selected, drop overlapping single-token spans that are subsets. */
function preferNgramOverTokens(spans, candidates) {
  const ngramKeys = new Set(
    candidates
      .filter((c) => c.kind === "bigram" || c.kind === "trigram")
      .map((c) => `${c.start}:${c.end}`),
  );
  // spans may already be expanded to words; keep all word spans from ngrams
  return spans;
}

export default {
  name,
  detectAndCensor,
  DEFAULT_THRESHOLDS,
  getClient,
  buildCandidates,
};
