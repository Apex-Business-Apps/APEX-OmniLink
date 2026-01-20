# Security Patterns Reference

Copyright (c) 2025 APEX Business Systems Ltd. | https://apexbusiness-systems.com

## OWASP Top 10 Quick Fixes

| # | Vulnerability | Fix |
|---|---------------|-----|
| 1 | Broken Access Control | Server-side auth checks on every request |
| 2 | Cryptographic Failures | TLS everywhere, proper key management |
| 3 | Injection | Parameterized queries, input validation |
| 4 | Insecure Design | Threat modeling, defense in depth |
| 5 | Security Misconfiguration | Hardened defaults, minimal attack surface |

---

## Input Validation

```typescript
import { z } from 'zod';
import DOMPurify from 'dompurify';

const UserInput = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100).regex(/^[\w\s-]+$/),
});

const safeHtml = DOMPurify.sanitize(untrustedHtml);
```

## SQL Injection Prevention

```typescript
// ❌ NEVER
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// ✅ ALWAYS parameterized
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
```

## Password Hashing

```typescript
import bcrypt from 'bcrypt';
const hash = await bcrypt.hash(password, 12);
const valid = await bcrypt.compare(input, hash);
```

## JWT Best Practices

```typescript
const token = jwt.sign({ sub: userId }, secret, {
  algorithm: 'HS256',
  expiresIn: '1h',
});

// Verify with explicit algorithm
const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
```

## Security Headers

```typescript
const headers = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'",
};
```

## Security Checklist

```
□ All user input validated and sanitized
□ Parameterized queries for all database access
□ Passwords hashed with bcrypt (cost 12+)
□ JWT using explicit algorithm, short expiry
□ HTTPS enforced everywhere
□ Security headers configured
□ Rate limiting on auth endpoints
□ Secrets in environment variables
□ Dependencies scanned for vulnerabilities
```
