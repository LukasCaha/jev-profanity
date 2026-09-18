# jev-profanity

Czech-first lab: detect + star-censor unsafe review text (vulgar / rude / coded attacks).

Compares **Jev** (TypeSafe System One) vs **lexicon** vs **token_scorer**.

## Tags
- `v0.1.0` — V2b metrics
- `v3.0.0` — algospeak / short-codes / semantic weapon / coded hate (Czech-first)

## Run
```bash
cp env.example.txt .env   # or export TYPESAFE_API_KEY
# Point @typesafe-ai/sdk in package.json to a real install path, then:
npm i
node data/generate.mjs
node run_bench.mjs
```

Never commit `.env` or API keys. See `LAB_NOTE.md` and `artifacts/v3.0.0/`.
