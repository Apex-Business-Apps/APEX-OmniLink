# OBSERVABILITY STACK - IMPLEMENTATION GUIDE
**Phase 2, Week 3-4 - Logging, Metrics, Traces, Alerts**

**Status:** Ready for Implementation
**Stack:** Datadog (metrics/traces) + Sentry (errors)
**Cost:** ~$45-60/month (Datadog Pro + Sentry Team)

---

## STACK OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│ OBSERVABILITY ARCHITECTURE                                  │
└─────────────────────────────────────────────────────────────┘

Frontend (Vercel)
├── Sentry SDK → Error tracking, performance monitoring
└── Datadog RUM → Real user monitoring, session replay

Backend (Supabase Edge Functions)
├── Datadog Agent → Logs, metrics, traces
├── OpenTelemetry → Distributed tracing
└── Structured JSON logging

Infrastructure
├── Vercel metrics → Datadog via integration
├── Supabase metrics → Custom export to Datadog
└── Cloudflare metrics → Datadog via API

Dashboards
├── SLO Dashboard → Error budget tracking
├── Operator Dashboard → Emergency controls status
└── Infrastructure Dashboard → Resource utilization
```

---

## PART 1: SENTRY ERROR TRACKING

### 1.1 Install Sentry

```bash
# Install Sentry SDK
npm install --save @sentry/react @sentry/vite-plugin
```

### 1.2 Configure Sentry

**Create `src/lib/sentry.ts`:**

```typescript
import * as Sentry from '@sentry/react'

export function initSentry() {
  // Only initialize if DSN is provided
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) {
    console.warn('[Sentry] DSN not configured, error tracking disabled')
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // 'development', 'production', 'staging'

    // Performance Monitoring
    integrations: [
      new Sentry.BrowserTracing({
        // Trace frontend navigation
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          window.history
        ),
      }),
      new Sentry.Replay({
        // Session replay for debugging
        maskAllText: true, // Privacy: mask all text
        blockAllMedia: true, // Privacy: block all images/videos
      }),
    ],

    // Performance Monitoring
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0, // 10% in prod, 100% in dev

    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

    // Filter out sensitive data
    beforeSend(event, hint) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
      }

      // Remove sensitive query params
      if (event.request?.url) {
        const url = new URL(event.request.url)
        url.searchParams.delete('token')
        url.searchParams.delete('api_key')
        event.request.url = url.toString()
      }

      return event
    },

    // Ignore known errors
    ignoreErrors: [
      // Browser extensions
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      // Network errors
      'NetworkError',
      'Failed to fetch',
    ],
  })
}

// Set user context (after authentication)
export function setSentryUser(user: { id: string; email?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
  })
}

// Clear user context (on logout)
export function clearSentryUser() {
  Sentry.setUser(null)
}

// Capture custom errors
export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    contexts: {
      custom: context,
    },
  })
}

// Capture custom messages
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  Sentry.captureMessage(message, level)
}
```

**Update `src/main.tsx`:**

```typescript
import { initSentry } from '@/lib/sentry'

// Initialize Sentry BEFORE React
initSentry()

// Then render app
const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### 1.3 Add Error Boundary

**Create `src/components/ErrorBoundary.tsx`:**

```typescript
import * as Sentry from '@sentry/react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export const ErrorBoundary = Sentry.withErrorBoundary(
  ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>
  },
  {
    fallback: ({ error, resetError }) => (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground">
            We've been notified and are working on a fix.
          </p>
          <div className="space-x-2">
            <Button onClick={resetError}>Try again</Button>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              Go home
            </Button>
          </div>
          {import.meta.env.DEV && (
            <pre className="mt-4 overflow-auto rounded-lg bg-muted p-4 text-left text-xs">
              {error.stack}
            </pre>
          )}
        </div>
      </div>
    ),
  }
)
```

**Wrap app in error boundary:**

```typescript
// src/main.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary'

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
```

### 1.4 Add Performance Monitoring

**Instrument critical operations:**

```typescript
import * as Sentry from '@sentry/react'

// Wrap database queries
export async function fetchUsers() {
  const transaction = Sentry.startTransaction({
    op: 'database.query',
    name: 'fetch-users',
  })

  try {
    const { data, error } = await db.find('users')

    if (error) {
      Sentry.captureException(error)
    }

    transaction.setStatus('ok')
    return { data, error }
  } catch (err) {
    transaction.setStatus('internal_error')
    Sentry.captureException(err)
    throw err
  } finally {
    transaction.finish()
  }
}
```

### 1.5 Sentry Project Setup

1. **Create account:** https://sentry.io/signup/
2. **Create project:** React
3. **Get DSN:** Settings → Client Keys (DSN)
4. **Add to Doppler:**
   ```bash
   doppler secrets set VITE_SENTRY_DSN="https://...@sentry.io/..." --project omnihub --config prod
   ```

---

## PART 2: DATADOG OBSERVABILITY

### 2.1 Install Datadog RUM (Frontend)

```bash
npm install --save @datadog/browser-rum @datadog/browser-logs
```

**Create `src/lib/datadog.ts`:**

```typescript
import { datadogRum } from '@datadog/browser-rum'
import { datadogLogs } from '@datadog/browser-logs'

export function initDatadog() {
  const clientToken = import.meta.env.VITE_DATADOG_CLIENT_TOKEN
  const applicationId = import.meta.env.VITE_DATADOG_APPLICATION_ID

  if (!clientToken || !applicationId) {
    console.warn('[Datadog] Not configured, monitoring disabled')
    return
  }

  // Initialize RUM (Real User Monitoring)
  datadogRum.init({
    applicationId,
    clientToken,
    site: 'datadoghq.com',
    service: 'omnihub-frontend',
    env: import.meta.env.MODE,
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',

    // Performance monitoring
    sessionSampleRate: 100, // 100% of sessions
    sessionReplaySampleRate: 20, // 20% session replay
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,

    // Privacy
    defaultPrivacyLevel: 'mask-user-input',
  })

  // Start session tracking
  datadogRum.startSessionReplayRecording()

  // Initialize Logs
  datadogLogs.init({
    clientToken,
    site: 'datadoghq.com',
    service: 'omnihub-frontend',
    env: import.meta.env.MODE,
    forwardErrorsToLogs: true,
    sessionSampleRate: 100,
  })
}

// Set user context
export function setDatadogUser(user: { id: string; email?: string; name?: string }) {
  datadogRum.setUser({
    id: user.id,
    email: user.email,
    name: user.name,
  })
}

// Log custom events
export function logEvent(name: string, attributes?: Record<string, any>) {
  datadogRum.addAction(name, attributes)
}

// Log errors
export function logError(error: Error, context?: Record<string, any>) {
  datadogLogs.logger.error(error.message, {
    error: {
      kind: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  })
}
```

**Initialize in `src/main.tsx`:**

```typescript
import { initDatadog } from '@/lib/datadog'

// Initialize Datadog
initDatadog()
```

### 2.2 Datadog Agent for Backend (Supabase Edge Functions)

**Create `supabase/functions/_shared/datadog.ts`:**

```typescript
/**
 * Datadog APM for Supabase Edge Functions
 */

interface DatadogLog {
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  service: string
  ddsource: string
  ddtags: string
  [key: string]: any
}

export class DatadogLogger {
  private apiKey: string
  private service: string
  private env: string

  constructor(apiKey: string, service: string = 'omnihub-backend', env: string = 'production') {
    this.apiKey = apiKey
    this.service = service
    this.env = env
  }

  private async sendLog(log: DatadogLog) {
    try {
      await fetch('https://http-intake.logs.datadoghq.com/api/v2/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.apiKey,
        },
        body: JSON.stringify({
          ...log,
          service: this.service,
          ddsource: 'supabase',
          ddtags: `env:${this.env}`,
          timestamp: new Date().toISOString(),
        }),
      })
    } catch (err) {
      console.error('[Datadog] Failed to send log:', err)
    }
  }

  info(message: string, attributes?: Record<string, any>) {
    this.sendLog({
      level: 'info',
      message,
      ...attributes,
    } as DatadogLog)
  }

  warn(message: string, attributes?: Record<string, any>) {
    this.sendLog({
      level: 'warn',
      message,
      ...attributes,
    } as DatadogLog)
  }

  error(message: string, error?: Error, attributes?: Record<string, any>) {
    this.sendLog({
      level: 'error',
      message,
      error: error ? {
        kind: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      ...attributes,
    } as DatadogLog)
  }
}

// Singleton instance
let logger: DatadogLogger | null = null

export function getDatadogLogger(): DatadogLogger {
  if (!logger) {
    const apiKey = Deno.env.get('DATADOG_API_KEY')
    if (!apiKey) {
      throw new Error('DATADOG_API_KEY not configured')
    }
    logger = new DatadogLogger(apiKey)
  }
  return logger
}
```

**Use in edge functions:**

```typescript
import { getDatadogLogger } from '../_shared/datadog.ts'
import { withEmergencyControls } from '../_shared/emergency-controls.ts'

Deno.serve(
  withEmergencyControls('my_operation', async (req, controls) => {
    const logger = getDatadogLogger()

    try {
      logger.info('Operation started', {
        user_id: 'user-123',
        operation: 'my_operation',
      })

      // ... perform operation ...

      logger.info('Operation completed', {
        duration_ms: 150,
      })

      return new Response(JSON.stringify({ status: 'ok' }))
    } catch (error) {
      logger.error('Operation failed', error, {
        operation: 'my_operation',
      })
      throw error
    }
  })
)
```

### 2.3 OpenTelemetry Instrumentation

**Install OpenTelemetry:**

```bash
npm install --save @opentelemetry/api @opentelemetry/sdk-trace-web @opentelemetry/instrumentation-fetch @opentelemetry/exporter-trace-otlp-http
```

**Create `src/lib/opentelemetry.ts`:**

```typescript
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

export function initOpenTelemetry() {
  const datadogApiKey = import.meta.env.VITE_DATADOG_API_KEY

  if (!datadogApiKey) {
    console.warn('[OpenTelemetry] Not configured')
    return
  }

  const provider = new WebTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'omnihub-frontend',
      [SemanticResourceAttributes.SERVICE_VERSION]: import.meta.env.VITE_APP_VERSION || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: import.meta.env.MODE,
    }),
  })

  // Export traces to Datadog
  const exporter = new OTLPTraceExporter({
    url: 'https://trace.agent.datadoghq.com/v1/traces',
    headers: {
      'DD-API-KEY': datadogApiKey,
    },
  })

  provider.addSpanProcessor(new SimpleSpanProcessor(exporter))
  provider.register()

  // Auto-instrument fetch requests
  registerInstrumentations({
    instrumentations: [
      new FetchInstrumentation({
        // Add trace context to requests
        propagateTraceHeaderCorsUrls: [
          /https:\/\/.*\.supabase\.co/,
          /https:\/\/api\.omnihub\.dev/,
        ],
      }),
    ],
  })
}
```

### 2.4 Datadog Account Setup

1. **Create account:** https://www.datadoghq.com/
2. **Get API key:** Organization Settings → API Keys
3. **Create RUM application:** UX Monitoring → RUM Applications → New Application
4. **Add secrets to Doppler:**
   ```bash
   doppler secrets set VITE_DATADOG_API_KEY="<api-key>" --project omnihub --config prod
   doppler secrets set VITE_DATADOG_CLIENT_TOKEN="<client-token>" --project omnihub --config prod
   doppler secrets set VITE_DATADOG_APPLICATION_ID="<app-id>" --project omnihub --config prod
   doppler secrets set DATADOG_API_KEY="<api-key>" --project omnihub --config prod
   ```

---

## PART 3: DASHBOARDS

### 3.1 SLO Dashboard (Datadog)

**Create dashboard JSON:**

```json
{
  "title": "OmniHub - SLO Dashboard",
  "widgets": [
    {
      "definition": {
        "title": "Error Budget (30 days)",
        "type": "slo",
        "slo_id": "<slo-id>",
        "show_error_budget": true,
        "view_type": "detail"
      }
    },
    {
      "definition": {
        "title": "Error Rate",
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:trace.http.request.errors{service:omnihub-frontend}.as_count()/sum:trace.http.request.hits{service:omnihub-frontend}.as_count()*100",
            "display_type": "line",
            "style": {
              "palette": "dog_classic",
              "line_type": "solid",
              "line_width": "normal"
            }
          }
        ],
        "yaxis": {
          "label": "Error Rate (%)",
          "scale": "linear",
          "min": "0",
          "max": "5"
        }
      }
    },
    {
      "definition": {
        "title": "P95 Latency",
        "type": "timeseries",
        "requests": [
          {
            "q": "p95:trace.http.request.duration{service:omnihub-frontend}",
            "display_type": "line"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Uptime (24h)",
        "type": "check_status",
        "check": "http.can_connect",
        "grouping": "cluster",
        "group_by": ["host"]
      }
    }
  ]
}
```

**Create SLO:**

1. Go to: Monitors → Service Level Objectives → New SLO
2. Select metric: Error rate < 1%
3. Time window: 30 days
4. Target: 99.9% uptime
5. Save SLO

### 3.2 Operator Dashboard

**Create `docs/dashboards/operator-dashboard.json`:**

```json
{
  "title": "OmniHub - Operator Dashboard",
  "widgets": [
    {
      "definition": {
        "title": "Emergency Controls Status",
        "type": "query_value",
        "requests": [
          {
            "q": "max:omnihub.emergency_controls.kill_switch{*}",
            "aggregator": "last"
          }
        ],
        "custom_links": [
          {
            "label": "View Emergency Controls",
            "link": "https://omnihub.dev/admin/emergency-controls"
          }
        ],
        "precision": 0
      }
    },
    {
      "definition": {
        "title": "Pending Operations (Operator Takeover)",
        "type": "query_value",
        "requests": [
          {
            "q": "sum:omnihub.pending_operations{*}",
            "aggregator": "last"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Recent Alerts",
        "type": "alert_graph",
        "alert_id": "all",
        "viz_type": "timeseries"
      }
    }
  ]
}
```

### 3.3 Infrastructure Dashboard

Monitor Vercel, Supabase, Cloudflare metrics:

```json
{
  "title": "OmniHub - Infrastructure",
  "widgets": [
    {
      "definition": {
        "title": "Vercel - Response Time",
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:vercel.edge.response_time{*}",
            "display_type": "line"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Supabase - DB Connections",
        "type": "query_value",
        "requests": [
          {
            "q": "sum:supabase.db.connections{*}",
            "aggregator": "last"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Cloudflare - Requests",
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:cloudflare.requests{*}.as_count()",
            "display_type": "bars"
          }
        ]
      }
    }
  ]
}
```

---

## PART 4: ALERTS

### 4.1 Critical Alerts

**Create `.datadog/monitors/`:**

**High Error Rate:**
```yaml
# .datadog/monitors/high-error-rate.yaml
name: "[OmniHub] High Error Rate"
type: metric alert
query: "avg(last_5m):sum:trace.http.request.errors{service:omnihub-frontend}.as_count()/sum:trace.http.request.hits{service:omnihub-frontend}.as_count()*100 > 5"
message: |
  Error rate is above 5% for the last 5 minutes.

  Current rate: {{value}}%
  Threshold: 5%

  @pagerduty-omnihub
  @slack-#incidents
tags:
  - service:omnihub
  - team:devops
  - severity:critical
thresholds:
  critical: 5
  warning: 2
```

**Service Down:**
```yaml
# .datadog/monitors/service-down.yaml
name: "[OmniHub] Service Down"
type: service check
query: '"http.can_connect".over("url:https://omnihub.dev").by("*").last(2).count_by_status()'
message: |
  OmniHub is down!

  @pagerduty-omnihub
  @slack-#incidents

  Runbook: https://docs.omnihub.dev/runbooks/service-down
tags:
  - service:omnihub
  - team:devops
  - severity:critical
```

**Database High Latency:**
```yaml
# .datadog/monitors/db-latency.yaml
name: "[OmniHub] Database High Latency"
type: metric alert
query: "avg(last_10m):avg:supabase.db.query.duration{*} > 1000"
message: |
  Database queries are taking longer than 1 second.

  Current: {{value}}ms
  Threshold: 1000ms

  @slack-#devops
tags:
  - service:omnihub-db
  - team:backend
  - severity:warning
thresholds:
  critical: 2000
  warning: 1000
```

### 4.2 Alert Channels

**Slack Integration:**
1. Go to: Integrations → Slack
2. Click "Add Slack Channel"
3. Authorize Datadog app
4. Select channel: `#incidents`

**PagerDuty Integration:**
1. Go to: Integrations → PagerDuty
2. Add PagerDuty service key
3. Configure escalation policy

---

## COST BREAKDOWN

### Sentry
- **Team Plan:** $26/month (100k events)
- **Business Plan:** $80/month (500k events)
- **Recommended:** Team ($26/month)

### Datadog
- **Pro Plan:** $15/host/month + $5/1M logs
- **Estimated usage:**
  - 1 host (Vercel frontend)
  - 1M logs/month
  - RUM: 10k sessions/month
- **Total:** ~$20-30/month

### Total Monthly Cost
- **Sentry:** $26/month
- **Datadog:** $30/month
- **Total:** **$56/month** (within $300-500 budget)

---

## IMPLEMENTATION CHECKLIST

**Week 3: Logging & Metrics**
- [ ] Install Sentry SDK (`@sentry/react`)
- [ ] Configure Sentry in `src/lib/sentry.ts`
- [ ] Add error boundary
- [ ] Install Datadog RUM SDK
- [ ] Configure Datadog in `src/lib/datadog.ts`
- [ ] Add Datadog logger to edge functions
- [ ] Install OpenTelemetry SDK
- [ ] Configure OTEL in `src/lib/opentelemetry.ts`
- [ ] Test error tracking (trigger test error, verify in Sentry)
- [ ] Test logging (check Datadog logs)

**Week 4: Dashboards & Alerts**
- [ ] Create Datadog SLO (99.9% uptime)
- [ ] Create SLO dashboard
- [ ] Create Operator dashboard
- [ ] Create Infrastructure dashboard
- [ ] Set up critical alerts (high error rate, service down)
- [ ] Configure Slack integration
- [ ] Configure PagerDuty integration
- [ ] Test alerts (trigger test alert, verify notification)

---

**Document Status:** ✅ READY FOR IMPLEMENTATION
**Last Updated:** 2026-01-03
**Owner:** SRE Team
**Related:** `DEPLOYMENT_ROLLOUT_PLAN.md`, `DOPPLER_IMPLEMENTATION_GUIDE.md`
