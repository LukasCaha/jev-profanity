# jev-profanity

Lab benchmark: **detect + asterisk-censor** unsafe text for a company external-comms filter (Youklid), comparing:

1. **jev** — TypeSafe System One (gate → span judgments → mask → verify)
2. **lexicon** — exact EN/CS word lists
3. **token_scorer** — obfuscation-aware list hybrid

## Task

Each method returns `{ has_profanity, censored }`.  
Censor rule: replace each blocked word with `*` × letter count; keep punctuation/spaces.

Policy (V2b+): block vulgar **or** rude/demeaning language unsuitable for a public company website (e.g. `stará bába`, `Moronic`), plus V3 coded/algospeak cases when used as attacks.

## Setup

```bash
npm install
export TYPESAFE_API_KEY=...   # never commit
node data/generate.mjs        # regenerate synth
CONCURRENCY=4 node run_bench.mjs
# local only:
node run_bench.mjs --no-jev
```

## Versioning

| Tag | Notes |
|-----|--------|
| `v0.1.0` | Initial publish of lab harness + current synth/metrics |
| `v3` | (upcoming) Czech-first algospeak / short codes / coded hate families |

See `LAB_NOTE.md` for V1→V2→V2b results and anti-overfit notes.

## Layout

- `data/` — generators + `synth.jsonl`
- `methods/` — jev / lexicon / token_scorer
- `lib/` — shared text utils + policy helpers
- `out/` — metrics (predictions gitignored; regenerate locally)
- `LAB_NOTE.md` — lab notebook

## Safety

Synthetic abusive text is for **defensive filter evaluation only**. Do not ship lists/prompts as production policy without review.
