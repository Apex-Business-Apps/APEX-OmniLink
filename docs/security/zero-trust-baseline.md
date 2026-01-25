# Zero-Trust Baseline

## What We Measure
- Per-user/device session counts and average session duration.
- Unique actions per device to spot anomalous breadth.
- Last-seen timestamp and risk flag (normal/elevated).

## How to Run
```bash
npm run zero-trust:baseline
# or provide logs
npm run zero-trust:baseline -- --input=./logs/activity.json
```

## Extending
- Feed real auth/access logs into the CLI.
- Tighten risk scoring (e.g., geo anomalies, time-of-day).
- Persist computed baselines for trend analysis.

