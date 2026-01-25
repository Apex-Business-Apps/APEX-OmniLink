# Prompt Defense Tuning

## Config
- Central config lives in `src/security/promptDefenseConfig.ts`.
- Rules cover instruction override, credential seeking, data exfil, and role confusion.
- High-risk keywords and prefix policy enforced before rule evaluation.

## Analysis Script
```bash
npm run prompt-defense:analyze -- --input=./logs/flagged.jsonl
```
- Input: JSONL with `prompt` and optional `label` (`malicious`/`benign`).
- Output: total flagged, per-rule counts, and false-positive rate when labels exist.

## Real Injection Tests
- `tests/fixtures/prompt_injections.jsonl` provides block/allow fixtures.
- Run: `npm run test:prompt-defense`.

## Tuning Target
- Keep false positives under 1% on the last 1000 flagged prompts.
- Adjust rules or `blockOnHighRiskKeywords` in the config and rerun analysis + tests.

