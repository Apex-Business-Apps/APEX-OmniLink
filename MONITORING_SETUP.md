# Production Monitoring Setup Guide

## Sentry Error Tracking & Performance Monitoring

### Quick Setup (5 minutes)

1. **Create Sentry Account**
   - Visit https://sentry.io and sign up
   - Free tier: 5,000 errors/month, 10,000 performance transactions/month

2. **Create New Project**
   - Select "React" as platform
   - Copy your DSN (looks like: `https://xxxxx@xxxxx.ingest.sentry.io/xxxxx`)

3. **Install Sentry SDK**
   ```bash
   npm install @sentry/react
   ```

4. **Configure Environment Variables**
   Add to `.env`:
   ```env
   VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
   VITE_SENTRY_ENVIRONMENT=production
   VITE_APP_VERSION=1.0.0
   ```

5. **Initialize in App**
   The monitoring system is already integrated! Just add the DSN and restart your app.

6. **Verify Installation**
   - Visit your app and trigger a test error
   - Check https://sentry.io/issues/ to see the error appear

### Features Enabled

✅ **Error Tracking**
- Automatic exception capture
- Stack traces with source maps
- User context and breadcrumbs
- Duplicate error grouping

✅ **Performance Monitoring**
- Page load times
- API request tracking
- Component render times
- Custom transactions

✅ **Session Replay** (Privacy-Safe)
- Visual playback of user sessions with errors
- All text and media masked by default
- Only captures error sessions (100%)
- Random sampling for normal sessions (10%)

✅ **Security Events**
- Failed authentication attempts
- Rate limit violations
- CSRF attempts
- Suspicious activity

### Monitoring Best Practices

1. **Set User Context After Login**
   ```typescript
   import { setSentryUser } from '@/lib/sentry';

   // After successful login
   setSentryUser(user.id, user.email, user.full_name);
   ```

2. **Clear User Context on Logout**
   ```typescript
   import { clearSentryUser } from '@/lib/sentry';

   // On logout
   clearSentryUser();
   ```

3. **Add Custom Context**
   ```typescript
   import { setSentryContext } from '@/lib/sentry';

   setSentryContext('organization', {
     id: org.id,
     name: org.name,
     plan: org.plan
   });
   ```

4. **Set Up Alerts**
   - Go to Sentry → Alerts → Create Alert Rule
   - Configure email/Slack notifications for critical errors
   - Set thresholds (e.g., >10 errors in 1 hour)

5. **Review Weekly**
   - Check error trends
   - Fix high-frequency issues first
   - Monitor performance regressions

### Alternative Monitoring Services

If you prefer a different service:

- **LogRocket** (https://logrocket.com)
  - Better session replay
  - More expensive
  - Integration: Replace Sentry imports

- **Rollbar** (https://rollbar.com)
  - Simpler error tracking
  - Less features
  - Good for smaller teams

- **DataDog** (https://datadoghq.com)
  - Enterprise-grade
  - Full APM suite
  - Higher cost

### Cost Optimization

**Free Tier Limits:**
- 5,000 errors/month
- 10,000 performance transactions/month
- 1 GB session replay storage

**If you exceed limits:**
1. Increase `ignoreErrors` in `src/lib/sentry.ts`
2. Reduce `tracesSampleRate` (currently 10% in production)
3. Reduce `replaysSessionSampleRate` (currently 10%)
4. Upgrade to paid plan ($26/month for 50K errors)

### Testing Sentry Integration

```typescript
// Trigger a test error (dev only)
if (import.meta.env.DEV) {
  throw new Error('Sentry test error');
}
```

### Current Status

- ✅ Monitoring utilities integrated (`src/lib/monitoring.ts`)
- ✅ Sentry initialization ready (`src/lib/sentry.ts`)
- ⚠️ **Sentry SDK not yet installed** - Run `npm install @sentry/react`
- ⚠️ **DSN not configured** - Add `VITE_SENTRY_DSN` to `.env`

### Support

- **Sentry Docs:** https://docs.sentry.io/platforms/javascript/guides/react/
- **APEX Support:** Contact your DevOps team

---

**Note:** The monitoring system works without Sentry (falls back to localStorage logging), but production deployments should have proper monitoring configured.
