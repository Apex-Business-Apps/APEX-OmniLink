# Observability Patterns Reference

Copyright (c) 2025 APEX Business Systems Ltd. | https://apexbusiness-systems.com

## The Three Pillars

| Pillar | Purpose | Tools |
|--------|---------|-------|
| **Logs** | What happened | Pino, Winston, structlog |
| **Metrics** | How system performs | Prometheus, StatsD |
| **Traces** | Request flow | Jaeger, OpenTelemetry |

---

## Structured Logging

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'api', env: process.env.NODE_ENV },
});

const log = logger.child({ requestId, userId });
log.info({ orderId, total }, 'Order created');
log.error({ err, orderId }, 'Payment failed');
```

### Log Levels

| Level | When to Use |
|-------|-------------|
| `error` | Operation failed, needs attention |
| `warn` | Unexpected but handled |
| `info` | Significant business events |
| `debug` | Development troubleshooting |

---

## Metrics (Prometheus)

```typescript
import { Counter, Histogram } from 'prom-client';

const httpRequests = new Counter({
  name: 'http_requests_total',
  labelNames: ['method', 'path', 'status'],
});

const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});
```

### RED Method

```
Rate     - Requests per second
Errors   - Failed requests per second
Duration - Request latency (p50, p95, p99)
```

---

## Health Checks

```typescript
// Liveness: Is process alive?
app.get('/health/live', (req, res) => {
  res.json({ status: 'ok' });
});

// Readiness: Can it handle traffic?
app.get('/health/ready', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'error' });
  }
});
```

---

## Alerting Rules

```yaml
groups:
  - name: api
    rules:
      - alert: HighErrorRate
        expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
```
