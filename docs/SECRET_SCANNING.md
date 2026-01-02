# Secret Scanning & No-Secrets Guidance

## Policy
- **Never** commit secrets, tokens, or private keys.
- Use environment variables and secret managers.
- Redact sensitive values in logs and error messages.

## Local scan (fast heuristic)
Run the lightweight scan before committing:

```bash
npm run secret:scan
```

This scan looks for common token and private key patterns. It is **not** a replacement
for professional secret scanners, but it provides a quick guardrail.

## If a secret is detected
1. **Rotate** the secret immediately.
2. Remove it from the repo history using your approved process.
3. Add the secret to the correct environment store (never in `VITE_*`).
4. Re-run `npm run secret:scan`.
