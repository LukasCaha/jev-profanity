# Jev lab — CS+EN profanity detect + censor bench (v2)

**When:** 2026-09-19 ~00:50 Europe/Prague (CET/CEST, UTC+2)  
**Where:** `/workspace/jev-lab-profanity-bench`  
**SDK:** `@typesafe-ai/sdk` (file: from `../jev-lab-001`)  
**Model:** `jev-latest`  
**API key:** `TYPESAFE_API_KEY` from env only — never logged or written to `out/`.

## Policy (critical)

> **V2b update:** external company communication filter — see **“V2b policy: rude = block”** below. Rude/demeaning digs are now **POSITIVE**.

**Block / positive** = vulgar swear / sexual abuse / strong invective **OR** rude/insulting/demeaning language unsuitable for a company’s public website (e.g. `stará bába`, `hlupák`, `useless cleaner`, `Moronic`, `blbá holka`).

**Still negative:** Scunthorpe / phonetic clean traps; `real_clean` reviews; ordinary factual complaints without demeaning digs.

Held-out test families (names kept): `rude_not_profane_cs`, `rude_not_profane_en` — gold now `has_profanity=true` with per-word insult masks.  
Train/dev analogs: `rude_insult_cs`, `rude_insult_en` (also positive under v2b).

### Censor rule

Each method returns `{ has_profanity, censored }`.  
Replace each profane *word/span* with exactly as many `*` as **letters** in that span; keep surrounding punctuation/spaces.

**Partial self-censor policy** (`f*ck`, `sh*t`, `kur*a`): gold treats the span as the intended swear and masks with the **intended word’s alphabetic letter count** (e.g. `f*ck` → `****` for *fuck*), not the count of visible letters excluding `*`. Methods may approximate via surface letter count → EM can miss while detection is correct.

Canon example (in test):  
`hello world, fuck, shit, hello` → `hello world, ****, ****, hello`

## Research grounding (evasion families)

Generators and normalizers follow well-documented obfuscation / filter-evasion patterns:

| Family (data) | Technique | Literature / practice |
|---------------|-----------|------------------------|
| `obfuscation_leet` / `obfuscation_mixed` | Leetspeak / visual sub (`a→@/4`, `e→3`, `i→1/!`, `o→0`, `s→$/5`, `b→8`, `|)→d`) | Cleanspeak leet docs; word-camouflage / pyleetspeak; O-Norm (qubies/o_norm); ACM *On Obstructing Obscenity Obfuscation* |
| `obfuscation_spaced`, `sep_dot_uscore`, `sep_space_train` | Separators: spaces, dots `f.u.c.k`, dashes, underscores, soft hyphens (U+00AD) | Same + O-Norm separator variants |
| `partial_self_censor` | `f*ck`, `sh*t`, `f**k`, `kur*a` | Common forum self-censor; treated as still-profane |
| `repeat_padding` | `fuuuuck`, `shitttt` | Repeat-char padding (O-Norm / camouflage) |
| `homoglyph_cyrillic` | Cyrillic а/е/о/р/с/х mixed into Latin swears | EMNLP OTH homoglyphs; Bad Characters |
| `zwsp_invisible` | U+200B between letters | Bad Characters / ZWSP attacks |
| `substring_scunthorpe`, `near_miss_clean` | Clean words containing banned substrings; phonetic lookalikes | Classic Scunthorpe problem |
| `foreign_phonetic` | `phuck`, `biatch`, … | Phonetic / respelling variants |
| `word_inversion_light` | Light letter reorder (`uckf`) | Optional hard case |
| `typos_adjacency` | Mild keyboard-adjacency typos | Real-world typos |

Normalizers (token_scorer / shared `lib/text.mjs`): strip ZWSP/soft-hyphen → NFKC → Cyrillic→Latin confusable map → leet map → strip separators → collapse repeats. **Do not** bake test-only surface strings into lists.

## Data (anti-overfit)

- Generator: `data/generate.mjs` (seed **`20260919b`** → int `202609192`) → `data/synth.jsonl`
- **1508** examples: train **560** / dev **205** / test **543** / real_clean **200**
- Positives **924** / negatives **584**
- **Test families never appear in train/dev** (held-out generators)
- `real_clean`: 200 sampled Youklid reviews (`/workspace/jev-lab-reviews/reviews-text.jsonl`); gold = unchanged; **FPR only**

## Methods

### 1. `jev` — gate → span Nouls → verify

1. Gate: `noul` + `score` with explicit rude-not-profane / Scunthorpe policy in state  
2. Candidates: tokens + spaced runs + dotted forms + **glued-stem splits**; ZWSP shown as `<ZWSP>` in candidate display; cap 20  
3. Span Nouls: mask **only** the abusive morpheme when glued  
4. Verify Noul on censored text  

Thresholds frozen on train/dev probe (24 docs, includes rude negatives) before test:

| knob | value |
|------|------:|
| gate_score_min | 0.55 |
| gate_noul_min | 0.45 |
| span_noul_min | 0.50 |
| verify_noul_min | 0.55 |
| max_candidates | 20 |

### 2. `lexicon` — exact EN+CS whole-token (+ multiword swears)

Expanded EN+CS lists carefully; **no** rude-not-profane phrases. Optional multiword: `do prdele`, `what the fuck`, …

### 3. `token_scorer` — obfuscation hybrid

v2: separators / leet / ZWSP / homoglyphs / partial `*` / spaced Czech / glued-stem mask (`worldčurák` → `world*****`) / keyboard-adjacency typo (blocklisted clean words like `stat` to avoid `stát`→`srat`). Still must **not** censor `stará bába`.

## How to run

```bash
cd /workspace/jev-lab-profanity-bench
npm install
node data/generate.mjs
CONCURRENCY=4 node run_bench.mjs --retune
# local only:
node run_bench.mjs --no-jev
```

Outputs: `out/predictions.jsonl`, `out/metrics.json`, `out/thresholds.json`.

## Results — held-out `test` (n=543)

| Method | Acc | F1 | FPR | FNR | EM | EM@pos | mask-F1 | rude FPR | p50 ms | ~$ (test) |
|--------|----:|---:|----:|----:|---:|-------:|--------:|---------:|-------:|----------:|
| **token_scorer** | **0.917** | **0.940** | **0** | 0.114 | **0.810** | **0.739** | **0.929** | **0** | ~0 | 0 |
| jev | 0.904 | 0.932 | 0.095 | **0.096** | 0.722 | 0.618 | 0.894 | 0.20 | 486 | 0.034 |
| lexicon | 0.634 | 0.663 | **0** | 0.504 | 0.622 | 0.481 | 0.756 | **0** | ~0 | 0 |

## Results — `real_clean` (n=200, FPR focus)

| Method | FPR | Acc | EM | p50 ms | ~$ |
|--------|----:|----:|---:|-------:|---:|
| lexicon | **0** | 1.0 | 1.0 | ~0 | 0 |
| token_scorer | **0** | 1.0 | 1.0 | ~0 | 0 |
| jev | **0** | 1.0 | 1.0 | 180 | 0.0049 |

## Rude-not-profane FPR (test, n=70)

| Method | FPR | FP/n |
|--------|----:|-----:|
| lexicon | **0** | 0/70 |
| token_scorer | **0** | 0/70 |
| jev | 0.20 | 14/70 |

Jev sometimes treats Czech mild insults (`blbá holka`, `frajer`, EN `Moronic`) as profanity despite gate instructions — policy gap vs lexicon-anchored methods.

**Examples left uncensored (token_scorer / lexicon):**
- `Stará kráva z recepce mě odbyla ohledně podpora.` → unchanged  
- `Pitomá aplikace balík, pořád padá.` → unchanged  
- `Useless cleaner left the package sticky.` → unchanged  

## Evasion-family recall (test positives)

| Family | n | lexicon R | token_scorer R | jev R |
|--------|--:|----------:|---------------:|------:|
| obfuscation_spaced | 28 | 0.00 | 0.71 | **0.96** |
| obfuscation_mixed | 28 | 0.00 | **0.89** | 0.79 |
| sep_dot_uscore | 26 | 0.31 | **1.00** | **1.00** |
| partial_self_censor | 26 | 0.00 | 0.92 | **1.00** |
| repeat_padding | 24 | 0.00 | **1.00** | 0.96 |
| homoglyph_cyrillic | 22 | 0.91 | **1.00** | 0.77 |
| zwsp_invisible | 22 | **1.00** | **1.00** | **1.00** |
| typos_adjacency | 20 | 0.00 | **1.00** | 0.70 |
| foreign_phonetic | 20 | 0.05 | 0.05 | **0.90** |
| word_inversion_light | 12 | 0.00 | 0.00 | 0.17 |
| glued_affix | 24 | 0.08 | **0.96** | 0.79 |

## v1 → v2 before/after

| | v1 | v2 |
|--|----|----|
| n total | 345 | **1508** |
| test n | 113 | **543** |
| real_clean | 100 | **200** |
| Hardness | spaced/leet/punct | + ZWSP, homoglyphs, self-censor, mixed sep+leet, typos, phonetic, glued, rude-not-profane |
| Best test F1 | jev 1.00 | **token_scorer 0.940** (jev 0.932; floor much harder) |
| real_clean FPR | all 0 | all 0 |
| Jev test $ | ~0.005 | ~0.034 (full run all splits ~**$0.085**) |

Ceiling dropped because v2 injects research-grade evasions and a large rude-negative set; absolute F1 is not comparable 1:1 to v1’s near-saturated score.

## Winners / losers

| Metric | Winner | Notes |
|--------|--------|-------|
| test F1 / EM@pos / mask-F1 | **token_scorer** | Best free default on hard evasions |
| test FNR / foreign_phonetic / spaced | **jev** | Wins semantic/phonetic cases lexicon hybrids miss |
| rude FPR / real_clean FPR | lexicon & token_scorer (0) | jev 0.20 rude FPR |
| latency / $ | lexicon & token_scorer | jev ~486ms p50, ~$0.085 full |

**Notable wins:** token_scorer glued-stem (`mega*****`), ZWSP, dots/underscores, typos (keyboard-adj), 0 rude FPR.  
**Notable losses:** jev over-flags mild Czech/EN insults; both struggle on `word_inversion_light`; lexicon blind to almost all separators/leet/self-censor; foreign phonetic mostly jev-only.

## Cost

Jev full bench (train+dev+test+real_clean, concurrency 4): **~$0.085** input-token estimate at $0.042/MTok. Test alone ~$0.034.

## Limitations

- Partial-censor EM: gold uses intended letter count; methods often mask surface letter count.  
- `word_inversion_light` remains near-unsolvable without a generative/phonetic model.  
- Jev rude FPR: instructions help but don’t eliminate mild-insult false positives.  
- Typo path uses a small blocklist (`stat`, …) so `stát`≠`srat`.  
- No HF toxicity model (CPU-light / offline for lexicon methods).

## Anti-overfit notes

- Template engines per family; test generators disjoint from train/dev.  
- Thresholds frozen before test (`out/thresholds.json`).  
- Real reviews only for FPR, not list tuning.  
- Normalizers are rule-based transforms, not memorized test strings.


## V2b policy: rude = block (external company communication filter)

**When:** 2026-09-19 ~01:22 Europe/Prague (UTC+2)  
**Policy flip:** Anything unsuitable for a **public company website / external customer communication** is positive — classic swears **or** rude/insulting/demeaning digs (`stará bába`, `stará kráva`, `blbá holka`, insulting `frajer`, `Moronic`, `useless cleaner`, …).  
**Censor rule (documented):** mask **each content word** of the insult with `*` × letters; keep spaces. Example: `stará bába` → `***** ****` (5+4). Product digs that are adj-only in gold (e.g. `Pitomá aplikace…` → `****** aplikace…`) mask the demeaning adjective.

### Gold / data (same ids/text)

- Relabeled existing `data/synth.jsonl` rude families in place (ids/text unchanged) via `lib/rude_policy.mjs`.
- Also merged rude-phrase spans into other synth families when present (e.g. filler `k ničemu`), so gold matches v2b consistently. `real_clean` + Scunthorpe / near-miss stay negative.
- Generator `data/generate.mjs` updated so future regenerates emit positive rude gold (family names kept for continuity; documented as public-unsafe positives).
- Positives now **1120** / negatives **388** (was 924 / 584 under V2).

### Jev changes (primary lever)

1. Gate + severity score: vulgar **OR** rude/demeaning unsuitable for company site (people/roles/products).
2. Span Nouls aligned with external-comms policy.
3. Generic bigram/trigram insult candidates (starter adj + optional demeaning noun head) — **no pasted test sentences**.
4. N-gram expand masks insult-bearing words only (not trailing neutral nouns).
5. Spaced-run conj stop so `f u c k a celý` does not swallow Czech `a`.
6. Thresholds tuned on train/dev probe under new gold, then frozen (`out/thresholds.json`): gate_noul 0.35 / gate_score 0.40 / span_noul 0.45 / verify 0.55 / max_cand 24.

### Lexicon / token_scorer (light, train-derived only)

- Added `TRAIN_RUDE_WORDS` + `TRAIN_RUDE_MULTIWORD` from **train/dev generator templates only** (e.g. `blbá holka`, `useless cleaner`, `hlupák`).  
- **Not** added: test-only strings (`stará bába`, `stará kráva`, `old hag`, `Moronic`, …). Documented in LAB_NOTE / words.mjs.

### Results — held-out `test` (n=543) under v2b gold

| Method | Acc | F1 | FPR | FNR | EM | EM@pos | mask-F1 | rude recall | p50 ms | ~$ (test) |
|--------|----:|---:|----:|----:|---:|-------:|--------:|------------:|-------:|----------:|
| **jev** | **0.972** | **0.984** | 0.026 | **0.028** | 0.658 | 0.600 | 0.843 | **0.986** (69/70) | 593 | 0.055 |
| token_scorer | 0.884 | 0.927 | **0** | 0.136 | **0.831** | **0.802** | **0.901** | 0.714 (50/70) | ~0 | 0 |
| lexicon | 0.615 | 0.710 | **0** | 0.449 | 0.551 | 0.493 | 0.736 | 0.714 (50/70) | ~0 | 0 |

### vs previous V2 (rude = negative / FPR framing)

| | V2 jev | V2b jev | V2 token_scorer | V2b token_scorer |
|--|-------:|--------:|----------------:|-----------------:|
| test F1 | 0.932 | **0.984** | **0.940** | 0.927 |
| test EM@pos | 0.618 | 0.600 | **0.739** | **0.802** |
| rude metric | FPR **0.20** (bad) | recall **0.986** | FPR 0 | recall 0.714 |
| real_clean FPR | 0 | 0.02 | 0 | 0 |

Not a 1:1 score comparison (gold flipped; +70 test positives). Under v2b, **Jev fairly leads on F1 and rude recall**; token_scorer still leads EM@pos (exact mask strings) via list hits.

### Rude family before → after (same ids)

| id / text | V2 gold | V2b gold | jev V2b | token_scorer V2b |
|-----------|---------|----------|---------|------------------|
| `Stará kráva z recepce…` | unchanged / neg | `***** ***** z recepce…` | **EM match** | miss (no test-only list) |
| `Moronic refund system…` | unchanged / neg | `******* refund system…` | **EM match** | miss |
| `Pitomá aplikace balík…` | unchanged / neg | `****** aplikace balík…` | **EM match** | miss |
| `Useless cleaner u úklid…` | unchanged / neg | `******* ******* u úklid…` | **EM match** | hit (train phrase) |

### Train/dev vs test gap (anti-overfit)

| | train F1 | dev F1 | test F1 | train EM@pos | test EM@pos |
|--|--------:|-------:|--------:|-------------:|------------:|
| jev | 0.996 | 0.988 | 0.984 | 0.654 | 0.600 |
| token_scorer | 0.969 | 0.977 | 0.927 | 0.827 | 0.802 |

Test ≲ train for Jev F1 (healthy). Test EM@pos slightly below train — **no test ≫ train leakage signal**. Thresholds frozen before test; no test texts used to hand-tune prompts; no exact test rude strings added to lists.

### Cost / paths

- Jev full bench (train+dev+test+real_clean, CONCURRENCY=4): **~$0.141** (test alone ~$0.055). Cumulative API across retunes/smoke higher; final metrics from last full run.
- Outputs: `out/metrics.json`, `out/predictions.jsonl`, `out/thresholds.json`
- Key code: `methods/jev.mjs`, `lib/rude_policy.mjs`, `lib/words.mjs` (train rude), `data/generate.mjs`, `run_bench.mjs`

### Remaining gaps

- Jev EM@pos still trails token_scorer (span boundaries / partial-censor letter counts).
- real_clean FPR 0.02 (4/200); Scunthorpe/near_miss jev FP 2/38 — gate occasionally over-fires on soft tone.
- V3 should hold out new rude templates; keep train-only list discipline.


## Paths

| Path | Role |
|------|------|
| `data/generate.mjs` | v2 synth + real_clean sampler (seed 20260919b) |
| `data/synth.jsonl` | committed dataset (1508) |
| `methods/jev.mjs` | System One pipeline |
| `methods/lexicon.mjs` | exact list |
| `methods/token_scorer.mjs` | obfuscation hybrid |
| `lib/text.mjs` / `lib/words.mjs` | normalizers + EN/CS lists |
| `run_bench.mjs` | bench runner (+ family metrics) |
| `out/predictions.jsonl` | per-doc predictions |
| `out/metrics.json` | aggregated metrics + evasion breakdown |
| `out/thresholds.json` | frozen Jev thresholds |
