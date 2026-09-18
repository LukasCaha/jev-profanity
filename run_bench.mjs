#!/usr/bin/env node
/**
 * Profanity detect+censor bench v3: jev / lexicon / token_scorer.
 * Policy: vulgar OR rude/demeaning OR V3 coded/algospeak/hate-code
 * (public-website unsafe) = positive. Czech-first.
 *
 * Usage:
 *   node run_bench.mjs              # full
 *   node run_bench.mjs --smoke      # tiny subset
 *   node run_bench.mjs --no-jev     # skip paid Jev
 *   node run_bench.mjs --retune     # force threshold retune on train/dev
 *   node run_bench.mjs --splits test,real_clean  # subset of splits
 * Env: CONCURRENCY (default 4), TYPESAFE_API_KEY
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { percentile } from "./lib/text.mjs";
import * as lexicon from "./methods/lexicon.mjs";
import * as token_scorer from "./methods/token_scorer.mjs";
import * as jev from "./methods/jev.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DATA = join(ROOT, "data", "synth.jsonl");
const OUT_DIR = join(ROOT, "out");
const PRED = join(OUT_DIR, "predictions.jsonl");
const METRICS = join(OUT_DIR, "metrics.json");
const THRESHOLDS_PATH = join(OUT_DIR, "thresholds.json");
const JEV_COST_PER_MTOK = 0.042;

/** Research-grounded evasion / policy families for breakdown. */
const EVASION_FAMILIES = [
  "obfuscation_leet",
  "obfuscation_spaced",
  "obfuscation_mixed",
  "sep_dot_uscore",
  "sep_space_train",
  "partial_self_censor",
  "partial_censor_train",
  "repeat_padding",
  "repeat_pad_train",
  "homoglyph_cyrillic",
  "zwsp_invisible",
  "typos_adjacency",
  "foreign_phonetic",
  "word_inversion_light",
  "glued_affix",
  "cs_evasion_train",
];
const RUDE_FAMILIES = [
  "rude_not_profane_cs",
  "rude_not_profane_en",
  "rude_insult_cs",
  "rude_insult_en",
];
const SCUNTHORPE_FAMILIES = ["substring_scunthorpe", "near_miss_clean"];
/** V3 held-out test families (disjoint from train/dev). */
const V3_TEST_FAMILIES = [
  "algospeak_hostile",
  "short_code_insult",
  "subculture_slur",
  "semantic_weapon",
  "coded_hate",
  "coded_hate_trap",
];
const V3_TRAIN_FAMILIES = [
  "algospeak_train",
  "short_code_train",
  "semantic_weapon_train",
  "coded_hate_train",
  "subculture_train",
  "coded_hate_trap_train",
  "cs_evasion_train",
];

function parseArgs(argv) {
  const opts = {
    smoke: false,
    noJev: false,
    tuneOnly: false,
    retune: false,
    methods: null,
    splits: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--smoke") opts.smoke = true;
    else if (a === "--no-jev") opts.noJev = true;
    else if (a === "--tune-only") opts.tuneOnly = true;
    else if (a === "--retune") opts.retune = true;
    else if (a === "--methods") opts.methods = argv[++i].split(",");
    else if (a === "--splits") opts.splits = argv[++i].split(",");
    else if (a === "--help" || a === "-h") {
      console.error(
        "Usage: node run_bench.mjs [--smoke] [--no-jev] [--retune] [--tune-only] [--methods a,b] [--splits test,real_clean]",
      );
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

function loadData() {
  return readFileSync(DATA, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

async function poolMap(items, concurrency, worker) {
  let next = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

function detMetrics(rows) {
  let tp = 0,
    tn = 0,
    fp = 0,
    fn = 0;
  for (const r of rows) {
    if (r.gold && r.pred) tp++;
    else if (!r.gold && !r.pred) tn++;
    else if (!r.gold && r.pred) fp++;
    else fn++;
  }
  const n = rows.length || 1;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const accuracy = (tp + tn) / n;
  const fpr = tn + fp ? fp / (tn + fp) : 0;
  const fnr = tp + fn ? fn / (tp + fn) : 0;
  return {
    n: rows.length,
    tp,
    tn,
    fp,
    fn,
    accuracy: round4(accuracy),
    precision: round4(precision),
    recall: round4(recall),
    f1: round4(f1),
    fpr: round4(fpr),
    fnr: round4(fnr),
  };
}

function round4(x) {
  return Number(Number(x).toFixed(4));
}

function rewriteMetrics(rows) {
  let exact = 0;
  let exact_pos = 0;
  let pos_n = 0;
  let mask_tp = 0,
    mask_fp = 0,
    mask_fn = 0;
  for (const r of rows) {
    const ok = r.gold_censored === r.pred_censored;
    if (ok) exact++;
    if (r.gold_pos) {
      pos_n++;
      if (ok) exact_pos++;
    }
    const g = r.gold_censored;
    const p = r.pred_censored;
    const len = Math.max(g.length, p.length);
    for (let i = 0; i < len; i++) {
      const gg = g[i] === "*";
      const pp = p[i] === "*";
      if (gg && pp) mask_tp++;
      else if (!gg && pp) mask_fp++;
      else if (gg && !pp) mask_fn++;
    }
  }
  const mask_p = mask_tp + mask_fp ? mask_tp / (mask_tp + mask_fp) : 0;
  const mask_r = mask_tp + mask_fn ? mask_tp / (mask_tp + mask_fn) : 0;
  const mask_f1 = mask_p + mask_r ? (2 * mask_p * mask_r) / (mask_p + mask_r) : 0;
  return {
    exact_match: round4(exact / (rows.length || 1)),
    exact_match_positive: pos_n ? round4(exact_pos / pos_n) : null,
    n_positive: pos_n,
    mask_char_f1: round4(mask_f1),
    mask_char_precision: round4(mask_p),
    mask_char_recall: round4(mask_r),
  };
}

function latencyStats(msArr) {
  if (!msArr.length) return { p50: 0, p95: 0, mean: 0, n: 0 };
  const mean = msArr.reduce((a, b) => a + b, 0) / msArr.length;
  return {
    p50: percentile(msArr, 50),
    p95: percentile(msArr, 95),
    mean: Math.round(mean),
    n: msArr.length,
  };
}

async function tuneJev(docs, concurrency) {
  const trainDev = docs.filter((d) => d.split === "train" || d.split === "dev");
  const pos = trainDev.filter((d) => d.has_profanity);
  const neg = trainDev.filter((d) => !d.has_profanity);
  // v2b: rude families are POSITIVE — probe them for recall; keep clean negs for FPR
  const rudePos = pos.filter((d) => RUDE_FAMILIES.includes(d.family));
  const otherPos = pos.filter((d) => !RUDE_FAMILIES.includes(d.family));
  const probe = [];
  for (let i = 0; i < Math.min(8, otherPos.length); i++) probe.push(otherPos[i]);
  for (let i = 0; i < Math.min(8, rudePos.length); i++) probe.push(rudePos[i]);
  for (let i = 0; i < Math.min(8, neg.length); i++) probe.push(neg[i]);

  console.error(`tune: probing ${probe.length} train/dev docs with default thresholds…`);
  const th = { ...jev.DEFAULT_THRESHOLDS };
  const gatePos = [];
  const gateNeg = [];
  const client = jev.getClient();

  await poolMap(probe, Math.min(concurrency, 4), async (doc) => {
    try {
      const r = await jev.detectAndCensor(doc.text, { thresholds: th, client });
      const gN = r.method_meta?.gate?.noul;
      const gS = r.method_meta?.gate?.score;
      if (doc.has_profanity) gatePos.push({ n: gN, s: gS, ok: r.has_profanity, family: doc.family });
      else gateNeg.push({ n: gN, s: gS, ok: !r.has_profanity, family: doc.family });
    } catch (err) {
      console.error(`tune error on ${doc.id}:`, String(err?.message || err).slice(0, 200));
    }
  });

  const fp = gateNeg.filter((x) => !x.ok).length;
  const fn = gatePos.filter((x) => !x.ok).length;
  const rudeFn = gatePos.filter((x) => !x.ok && RUDE_FAMILIES.includes(x.family)).length;
  // Prefer catching rude positives (lower thresholds) if missing them
  if (fn >= 3 || rudeFn >= 2) {
    th.gate_noul_min = Math.max(0.2, th.gate_noul_min - 0.1);
    th.gate_score_min = Math.max(0.25, th.gate_score_min - 0.1);
    th.span_noul_min = Math.max(0.3, th.span_noul_min - 0.05);
  }
  // Raise thresholds only if clean FPR is high and rude recall is already ok
  if (fp >= 3 && rudeFn === 0) {
    th.gate_noul_min = Math.min(0.7, th.gate_noul_min + 0.1);
    th.gate_score_min = Math.min(0.9, th.gate_score_min + 0.1);
    th.span_noul_min = Math.min(0.7, th.span_noul_min + 0.05);
  }

  th.tuned_on = {
    probe_n: probe.length,
    probe_fp: fp,
    probe_fn: fn,
    probe_rude_fn: rudeFn,
    at: new Date().toISOString(),
  };
  console.error(`tune: frozen thresholds ${JSON.stringify(th)}`);
  return th;
}

async function runMethod(methodName, docs, opts) {
  const concurrency = opts.concurrency;
  const results = [];
  let errors = 0;
  const client = methodName === "jev" ? jev.getClient() : null;
  const th = opts.thresholds;

  let done = 0;
  await poolMap(docs, concurrency, async (doc) => {
    const t0 = performance.now();
    let out;
    try {
      if (methodName === "lexicon") {
        out = lexicon.detectAndCensor(doc.text);
        out.latency_ms = Math.round(performance.now() - t0);
        out.usage = { input_tokens: 0, output_tokens: 0, calls: 0 };
      } else if (methodName === "token_scorer") {
        out = token_scorer.detectAndCensor(doc.text);
        out.latency_ms = Math.round(performance.now() - t0);
        out.usage = { input_tokens: 0, output_tokens: 0, calls: 0 };
      } else if (methodName === "jev") {
        out = await jev.detectAndCensor(doc.text, { thresholds: th, client });
      } else {
        throw new Error(`unknown method ${methodName}`);
      }
    } catch (err) {
      errors++;
      out = {
        has_profanity: false,
        censored: doc.text,
        error: String(err?.message || err).slice(0, 400),
        latency_ms: Math.round(performance.now() - t0),
        usage: { input_tokens: 0, output_tokens: 0, calls: 0 },
      };
    }
    results.push({
      id: doc.id,
      family: doc.family,
      split: doc.split,
      method: methodName,
      text: doc.text,
      gold_has_profanity: doc.has_profanity,
      gold_censored: doc.censored_gold,
      pred_has_profanity: !!out.has_profanity,
      pred_censored: out.censored,
      verify_failed: !!out.verify_failed,
      latency_ms: out.latency_ms || 0,
      usage: out.usage || null,
      spans: out.spans || null,
      error: out.error || null,
      method_meta: out.method_meta || null,
    });
    done++;
    if (done % 50 === 0 || done === docs.length) {
      console.error(`  ${methodName}: ${done}/${docs.length} (errors=${errors})`);
    }
  });
  return results;
}

function scoreSlice(predRows, splitFilter) {
  const rows = predRows.filter((r) =>
    typeof splitFilter === "function" ? splitFilter(r) : r.split === splitFilter,
  );
  const det = detMetrics(
    rows.map((r) => ({ gold: r.gold_has_profanity, pred: r.pred_has_profanity })),
  );
  const rew = rewriteMetrics(
    rows.map((r) => ({
      gold_censored: r.gold_censored,
      pred_censored: r.pred_censored,
      gold_pos: r.gold_has_profanity,
    })),
  );
  const lat = latencyStats(rows.map((r) => r.latency_ms));
  const inTok = rows.reduce((a, r) => a + (r.usage?.input_tokens || 0), 0);
  const outTok = rows.reduce((a, r) => a + (r.usage?.output_tokens || 0), 0);
  const cost_usd = round4((inTok / 1e6) * JEV_COST_PER_MTOK);
  return {
    detection: det,
    rewrite: rew,
    latency_ms: lat,
    tokens: { input: inTok, output: outTok },
    estimated_cost_usd: cost_usd,
    verify_failed_n: rows.filter((r) => r.verify_failed).length,
    errors: rows.filter((r) => r.error).length,
  };
}

function familyBreakdown(predRows, families, split = "test") {
  const out = {};
  for (const fam of families) {
    const rows = predRows.filter((r) => r.split === split && r.family === fam);
    if (!rows.length) continue;
    out[fam] = detMetrics(
      rows.map((r) => ({ gold: r.gold_has_profanity, pred: r.pred_has_profanity })),
    );
  }
  return out;
}

function rudeRecall(predRows) {
  // v2b: rude_* test families are POSITIVE — report recall (TPR), not FPR
  const rows = predRows.filter(
    (r) =>
      r.split === "test" &&
      (r.family === "rude_not_profane_cs" || r.family === "rude_not_profane_en"),
  );
  const tp = rows.filter((r) => r.pred_has_profanity && r.gold_has_profanity).length;
  const fn = rows.filter((r) => !r.pred_has_profanity && r.gold_has_profanity).length;
  const em = rows.filter((r) => r.pred_censored === r.gold_censored).length;
  function fam(name) {
    const rr = rows.filter((r) => r.family === name);
    const t = rr.filter((r) => r.pred_has_profanity && r.gold_has_profanity).length;
    const f = rr.filter((r) => !r.pred_has_profanity && r.gold_has_profanity).length;
    const e = rr.filter((r) => r.pred_censored === r.gold_censored).length;
    return {
      n: rr.length,
      tp: t,
      fn: f,
      recall: rr.length ? round4(t / rr.length) : null,
      exact_match: rr.length ? round4(e / rr.length) : null,
    };
  }
  return {
    n: rows.length,
    tp,
    fn,
    recall: rows.length ? round4(tp / rows.length) : null,
    exact_match: rows.length ? round4(em / rows.length) : null,
    by_family: {
      rude_not_profane_cs: fam("rude_not_profane_cs"),
      rude_not_profane_en: fam("rude_not_profane_en"),
    },
  };
}

function summarize(allPreds, methods) {
  const out = {
    generated_at: new Date().toISOString(),
    version: "3",
    methods: {},
    note:
      "v3: Detection + rewrite; V2b rude=positive kept; +algospeak/short-codes/subculture/semantic-weapon/coded-hate (+clean numeric traps). Czech-first. Thresholds frozen on train/dev before test.",
  };
  for (const m of methods) {
    const rows = allPreds.filter((r) => r.method === m);
    out.methods[m] = {
      test: scoreSlice(rows, "test"),
      real_clean: scoreSlice(rows, "real_clean"),
      train: scoreSlice(rows, "train"),
      dev: scoreSlice(rows, "dev"),
      all_synth: scoreSlice(rows, (r) => r.split !== "real_clean"),
      rude_public_unsafe_recall: rudeRecall(rows),
      // keep alias for older readers
      rude_not_profane_fpr: (() => {
        const rr = rudeRecall(rows);
        return { n: rr.n, fp: rr.tp, fpr: rr.recall, note: "v2b alias: fpr field = recall" };
      })(),
      evasion_families_test: familyBreakdown(rows, EVASION_FAMILIES, "test"),
      scunthorpe_near_miss_test: familyBreakdown(rows, SCUNTHORPE_FAMILIES, "test"),
      v3_families_test: familyBreakdown(rows, V3_TEST_FAMILIES, "test"),
      v3_families_train: familyBreakdown(rows, V3_TRAIN_FAMILIES, "train"),
    };
  }
  const testF1 = methods.map((m) => ({
    m,
    f1: out.methods[m].test.detection.f1,
    em_pos: out.methods[m].test.rewrite.exact_match_positive,
    fpr_real: out.methods[m].real_clean.detection.fpr,
    rude_recall: out.methods[m].rude_public_unsafe_recall.recall,
    cost: out.methods[m].test.estimated_cost_usd,
  }));
  out.winners = {
    test_f1: [...testF1].sort((a, b) => b.f1 - a.f1)[0]?.m,
    test_exact_match_positive: [...testF1].sort(
      (a, b) => (b.em_pos ?? -1) - (a.em_pos ?? -1),
    )[0]?.m,
    real_clean_lowest_fpr: [...testF1].sort((a, b) => a.fpr_real - b.fpr_real)[0]?.m,
    rude_highest_recall: [...testF1].sort(
      (a, b) => (b.rude_recall ?? -1) - (a.rude_recall ?? -1),
    )[0]?.m,
    test_lowest_cost: [...testF1].sort((a, b) => a.cost - b.cost)[0]?.m,
  };
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const concurrency = Math.max(1, Number(process.env.CONCURRENCY || 4) || 4);
  mkdirSync(OUT_DIR, { recursive: true });

  if (!existsSync(DATA)) {
    console.error("missing data/synth.jsonl — run: node data/generate.mjs");
    process.exit(1);
  }
  let docs = loadData();
  console.error(`loaded ${docs.length} docs`);

  if (opts.splits) {
    const allow = new Set(opts.splits);
    docs = docs.filter((d) => allow.has(d.split));
    console.error(`filtered splits ${opts.splits.join(",")}: ${docs.length}`);
  }

  if (opts.smoke) {
    const bySplit = { train: [], dev: [], test: [], real_clean: [] };
    for (const d of docs) {
      if (bySplit[d.split]?.length < 2) bySplit[d.split].push(d);
    }
    // sample a few evasion + rude
    const extra = docs.filter(
      (d) =>
        d.family === "rude_not_profane_cs" ||
        d.family === "zwsp_invisible" ||
        d.family === "sep_dot_uscore" ||
        d.family === "homoglyph_cyrillic" ||
        d.family === "partial_self_censor" ||
        d.family === "algospeak_hostile" ||
        d.family === "short_code_insult" ||
        d.family === "semantic_weapon" ||
        d.family === "coded_hate" ||
        d.family === "coded_hate_trap" ||
        d.id === "test_canon_fuck_shit",
    ).slice(0, 20);
    const canon = docs.find((d) => d.id === "test_canon_fuck_shit");
    docs = [
      ...bySplit.train,
      ...bySplit.dev,
      ...bySplit.test,
      ...extra,
      ...(canon ? [canon] : []),
      ...bySplit.real_clean,
    ];
    const seen = new Set();
    docs = docs.filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)));
    console.error(`smoke subset: ${docs.length}`);
  }

  let methods = opts.methods || ["lexicon", "token_scorer", "jev"];
  if (opts.noJev) methods = methods.filter((m) => m !== "jev");

  let thresholds = { ...jev.DEFAULT_THRESHOLDS };
  if (methods.includes("jev")) {
    if (existsSync(THRESHOLDS_PATH) && !opts.smoke && !opts.retune) {
      thresholds = JSON.parse(readFileSync(THRESHOLDS_PATH, "utf8"));
      console.error("reusing frozen thresholds from out/thresholds.json");
    } else {
      const tuneDocs = loadData().filter(
        (d) => d.split === "train" || d.split === "dev",
      );
      thresholds = await tuneJev(tuneDocs, concurrency);
      writeFileSync(THRESHOLDS_PATH, JSON.stringify(thresholds, null, 2) + "\n");
    }
  }
  if (opts.tuneOnly) {
    console.log(JSON.stringify(thresholds, null, 2));
    return;
  }

  writeFileSync(PRED, "", "utf8");
  const allPreds = [];

  for (const m of methods) {
    console.error(`=== method ${m} on ${docs.length} docs (concurrency=${concurrency}) ===`);
    const rows = await runMethod(m, docs, { concurrency, thresholds });
    for (const r of rows) {
      appendFileSync(PRED, JSON.stringify(r) + "\n");
      allPreds.push(r);
    }
  }

  const metrics = summarize(allPreds, methods);
  metrics.thresholds = thresholds;
  metrics.n_docs_run = docs.length;
  metrics.concurrency = concurrency;
  metrics.smoke = opts.smoke;
  writeFileSync(METRICS, JSON.stringify(metrics, null, 2) + "\n");
  console.error(`wrote ${PRED}`);
  console.error(`wrote ${METRICS}`);
  console.log(
    JSON.stringify(
      {
        winners: metrics.winners,
        methods: Object.fromEntries(
          Object.entries(metrics.methods).map(([k, v]) => [
            k,
            {
              test_f1: v.test.detection.f1,
              test_acc: v.test.detection.accuracy,
              test_fpr: v.test.detection.fpr,
              test_fnr: v.test.detection.fnr,
              test_em_pos: v.test.rewrite.exact_match_positive,
              test_em: v.test.rewrite.exact_match,
              test_mask_f1: v.test.rewrite.mask_char_f1,
              real_fpr: v.real_clean.detection.fpr,
              rude_recall: v.rude_public_unsafe_recall.recall,
              rude_tp: v.rude_public_unsafe_recall.tp,
              rude_fn: v.rude_public_unsafe_recall.fn,
              rude_n: v.rude_public_unsafe_recall.n,
              rude_em: v.rude_public_unsafe_recall.exact_match,
              test_cost_usd: v.test.estimated_cost_usd,
              test_lat_p50: v.test.latency_ms.p50,
              test_lat_p95: v.test.latency_ms.p95,
            },
          ]),
        ),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("fatal:", err?.message ?? err);
  process.exit(1);
});
