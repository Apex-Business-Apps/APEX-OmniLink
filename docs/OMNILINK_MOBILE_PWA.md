# OmniLink Mobile PWA

## Executive Summary

OmniLink is APEX OmniHub's mobile-first Progressive Web App (PWA) designed for tablet and mobile devices. It provides a native-like experience with offline support, installability on iOS and Android, and scoped operational capabilities for client access.

**Key Differentiators:**
- Mobile-only enforcement with admin bypass
- Role-based capability scoping (no email allowlists)
- Native app installation on iOS/Android
- Offline-first architecture with service worker caching
- Dark mode with system preference detection
- Touch-optimized bottom navigation

---

## Architecture Overview

### Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `MobileOnlyGate` | Enforces mobile/tablet viewport restriction | `src/components/MobileOnlyGate.tsx` |
| `MobileBottomNav` | Touch-friendly bottom navigation bar | `src/components/MobileBottomNav.tsx` |
| `ThemeToggle` | Dark mode control (system/light/dark) | `src/components/ThemeToggle.tsx` |
| `useCapabilities` | Role-based permission hook | `src/hooks/useCapabilities.ts` |

### Pages

| Page | Route | Description | Capability Required |
|------|-------|-------------|---------------------|
| Translation | `/translation` | Semantic translation UI | `canUseTranslation` |
| Agent | `/agent` | Voice interface with command mapping | `canUseVoiceAgent` |
| OmniTrace | `/omnitrace` | Workflow replay with timeline scrubber | `canViewOmniTrace` |
| Settings | `/settings` | User preferences and account management | (authenticated) |
| Integrations | `/integrations` | OmniPort integration management | `canManageIntegrations` |
| OmniDash | `/omnidash` | Executive dashboard | `canViewOmniDash` |

---

## Feature Flags

All features are controlled via environment variables for idempotent enable/disable:

```bash
# Mobile-only gate (restricts desktop access)
VITE_OMNILINK_MOBILE_ONLY=true

# PWA functionality (install prompt, offline support)
VITE_OMNILINK_PWA=true

# Voice agent features
VITE_OMNILINK_VOICE=true

# Translation features
VITE_OMNILINK_TRANSLATION=true
```

### Rollback Procedure

1. Set feature flags to `false` in `.env`
2. Redeploy application
3. Verify `/health` endpoint responds
4. (Optional) Revert git commit if needed

---

## Role-Based Capabilities

### Database Schema

User roles are stored in `public.user_roles` table:

```sql
CREATE TYPE app_role AS ENUM ('admin', 'user');

CREATE TABLE user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  role app_role DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Capability Matrix

| Capability | Free | Starter | Pro | Enterprise | Admin |
|------------|------|---------|-----|------------|-------|
| `canViewOmniDash` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `canManageIntegrations` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `canViewOmniTrace` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `canReplayOmniTrace` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `canUseTranslation` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `canUseVoiceAgent` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `canViewPolicySummary` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `canAccessDiagnostics` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `canBypassMobileGate` | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Mobile-Only Gate

### Design

The `MobileOnlyGate` component enforces mobile/tablet access using:
- Viewport width detection (>= 1024px is "desktop")
- Admin role bypass via `canBypassMobileGate`
- Query parameter override: `?desktop=1` (admin only)

### User Experience

**Desktop users see:**
```
┌──────────────────────────┐
│     OmniLink Mobile      │
│                          │
│  📱 Your portal to       │
│     intelligence         │
│                          │
│  OmniLink is optimized   │
│  for tablet and mobile   │
│  devices.                │
│                          │
│  Please access from a    │
│  mobile device or        │
│  reduce your window size │
└──────────────────────────┘
```

### Admin Bypass

Admins can bypass the gate:
1. Automatically (role detection)
2. Via query param: `https://app.omnihub.com/?desktop=1`

---

## PWA Installation

### iOS (Safari)

1. Navigate to OmniLink URL
2. Tap "Share" button (box with arrow)
3. Select "Add to Home Screen"
4. Tap "Add"
5. OmniLink icon appears on home screen

### Android (Chrome)

1. Navigate to OmniLink URL
2. Tap "Add to Home Screen" banner OR
3. Tap menu (⋮) → "Install app"
4. Tap "Install"
5. OmniLink app appears in app drawer

### Features Enabled

- **Offline Support**: Network-first caching with offline fallback
- **App Shortcuts**: Quick access to Dash, Integrations, Agent
- **Share Target**: Receive shared content from other apps
- **Standalone Display**: Runs without browser chrome

---

## Service Worker Strategy

### Cache Buckets

| Bucket | Purpose | Strategy |
|--------|---------|----------|
| `omnilink-v1-static` | Static assets (HTML, manifest, icons) | Cache-first |
| `omnilink-v1-dynamic` | Dynamic pages and assets | Network-first |
| `omnilink-v1-api` | Supabase API responses | Network-first, stale-while-revalidate |

### Offline Behavior

1. **Online**: Fetch from network, update cache in background
2. **Offline**: Serve from cache if available
3. **Navigation (offline)**: Serve cached `index.html`
4. **API (offline)**: Return last cached response or 503

### Cache Invalidation

Old caches are automatically deleted on service worker activation:
```javascript
cacheNames.filter(name =>
  name.startsWith('omnilink-') &&
  !name.startsWith(CACHE_VERSION)
)
```

---

## Dark Mode

### Theme Provider

OmniLink uses `next-themes` for dark mode:

```tsx
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  <App />
</ThemeProvider>
```

### Theme Options

| Theme | Description |
|-------|-------------|
| `system` | Respects OS/browser preference (default) |
| `light` | Force light mode |
| `dark` | Force dark mode |

### Persistence

Theme preference is persisted to `localStorage` and synced across tabs.

### CSS Variables

Themes are implemented via Tailwind's `dark:` variant:

```css
/* Light mode */
--background: 0 0% 100%;
--foreground: 222.2 84% 4.9%;

/* Dark mode */
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
}
```

---

## Voice Agent

### Command Mapping

Voice commands are processed client-side using deterministic regex patterns:

```typescript
const commands: VoiceCommand[] = [
  {
    pattern: /open integrations?|show integrations?/i,
    action: () => navigate('/integrations'),
    description: 'Navigate to Integrations',
  },
  // ... more commands
];
```

### Privacy

- **No server-side processing**: Commands interpreted locally
- **No transcript logging**: Unless user explicitly opts in
- **WebSocket to edge function**: Real-time audio transmission
- **Degraded mode**: Graceful fallback on network failure

### Available Commands

| Command | Action |
|---------|--------|
| "Open integrations" | Navigate to `/integrations` |
| "Open OmniDash" | Navigate to `/omnidash` |
| "Open OmniTrace" | Navigate to `/omnitrace` |
| "Enable dark mode" | Set theme to dark |
| "Enable light mode" | Set theme to light |
| "Help" | Show available commands |

---

## Translation

### Semantic Translation Engine

OmniLink includes a client-side semantic translator with:
- **Forward translation**: Canonical → app-specific format
- **Back-translation verification**: Fail-closed on mismatch
- **Locale awareness**: Supports multiple target locales
- **Risk tagging**: RED lane for verification failures

### UI Features

1. **Target locale selection**: fr-FR, es-ES, de-DE, ja-JP, zh-CN, en-US
2. **JSON payload input**: Paste canonical event JSON
3. **Verification status**: Visual badges for success/failure
4. **Export**: Download translated event as JSON
5. **Preview mode**: Deterministic pseudo-translation (demo)

### Production Translation

Production translation would use:
- Local AI models (no external APIs)
- Cached translation dictionaries
- Full semantic equivalence verification

---

## OmniTrace Replay

### Enhanced UI

The replay interface provides:

1. **Timeline Scrubber**: Slider to navigate through events
2. **Play/Pause**: Auto-advance through events (500ms intervals)
3. **Export**: Download replay bundle as JSON
4. **Policy View**: Dedicated section for policy decisions
5. **Event Detail**: Current event metadata display

### Event Filtering

Events are categorized by `kind`:
- `tool` - Tool invocations
- `model` - LLM calls
- `policy` - OmniPolicy decisions
- `cache` - Cache operations
- `system` - System events

### Policy Decisions

Policy events display:
- **Decision**: allow/deny badge
- **Reason**: Explanation for decision
- **Timestamp**: Event occurrence time
- **Correlation**: Trace correlation ID

### Truncation Warnings

Visible alerts when `events_truncated: true`:
```
⚠️ Events Truncated
Some events were truncated. Full replay bundle available via API.
```

---

## Security Considerations

### Proprietary Protection

1. **Sourcemaps disabled**: `vite.config.ts` sets `sourcemap: false` in production
2. **Sensitive logic server-side**: Client remains thin orchestration layer
3. **Redacted logs**: No tokens, keys, or PII in browser console
4. **Admin-only diagnostics**: Diagnostic panels restricted to `isAdmin: true`

### Least Privilege

- Routes check capabilities before rendering
- API calls rejected server-side if unauthorized
- Sensitive fields redacted in API responses (`output_redacted`)

### Defense-in-Depth

- CSP headers restrict script execution
- Service worker validates cache integrity
- WebSocket connections authenticated via Supabase
- Zero-trust device registry integration

---

## Performance Metrics

### Bundle Size

| Chunk | Size (gzipped) | Purpose |
|-------|----------------|---------|
| `react-vendor` | ~45 KB | React + React DOM + Router |
| `ui-components` | ~35 KB | Radix UI components |
| `supabase-vendor` | ~28 KB | Supabase client |
| `web3-core` | ~65 KB | Web3 libraries (lazy-loaded) |

### Core Web Vitals (Target)

| Metric | Target | Actual |
|--------|--------|--------|
| LCP (Largest Contentful Paint) | < 2.5s | TBD |
| FID (First Input Delay) | < 100ms | TBD |
| CLS (Cumulative Layout Shift) | < 0.1 | TBD |

### Service Worker Performance

- **Install time**: < 2s (static asset caching)
- **Fetch interception**: < 5ms overhead
- **Cache hit rate**: Target 80% for repeat visits

---

## Testing

### Unit Tests

```bash
npm run test       # Vitest unit tests
npm run typecheck  # TypeScript type checking
npm run lint       # ESLint + formatting
```

### E2E Tests

```bash
npm run test:e2e   # Playwright browser tests
```

### Manual Testing Checklist

- [ ] PWA installs on iOS Safari
- [ ] PWA installs on Android Chrome
- [ ] Offline mode serves cached content
- [ ] Dark mode toggle persists across sessions
- [ ] Mobile-only gate blocks desktop (non-admin)
- [ ] Admin can bypass gate with `?desktop=1`
- [ ] Voice commands navigate correctly
- [ ] Translation preview works for sample JSON
- [ ] OmniTrace replay timeline scrubs smoothly
- [ ] Bottom nav highlights active route

---

## Deployment

### Build

```bash
npm run build
```

### Environment Variables

Ensure these are set in production:

```bash
# Required
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# OmniLink Features (optional, defaults to true)
VITE_OMNILINK_MOBILE_ONLY=true
VITE_OMNILINK_PWA=true
VITE_OMNILINK_VOICE=true
VITE_OMNILINK_TRANSLATION=true
```

### Health Check

Verify deployment:

```bash
curl https://your-domain.com/health
# Expected: 200 OK
```

---

## Troubleshooting

### "OmniLink is available on tablet and mobile"

**Cause**: Desktop browser detected, mobile-only gate active

**Solutions**:
1. Resize browser window < 1024px width
2. Open on actual mobile device
3. (Admin) Add `?desktop=1` to URL
4. (Temporary) Set `VITE_OMNILINK_MOBILE_ONLY=false`

### Service Worker not updating

**Cause**: Cached old service worker

**Solution**:
1. Open DevTools → Application → Service Workers
2. Check "Update on reload"
3. Click "Unregister"
4. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Dark mode not persisting

**Cause**: `localStorage` blocked or cleared

**Solution**:
1. Check browser privacy settings
2. Ensure cookies/storage allowed for domain
3. Disable incognito/private browsing

### Voice commands not working

**Cause**: Microphone permissions denied or WebSocket connection failed

**Solution**:
1. Check browser microphone permissions
2. Verify Supabase edge function `apex-voice` is deployed
3. Check network tab for WebSocket errors
4. Ensure `VITE_VOICE_WS_URL` is correct

---

## Roadmap

### Q1 2026

- [ ] Native mobile apps (React Native wrapper)
- [ ] Push notifications via FCM/APNS
- [ ] Biometric authentication (Face ID / Touch ID)
- [ ] Enhanced offline sync with conflict resolution

### Q2 2026

- [ ] Multi-language UI (i18n beyond translation feature)
- [ ] Advanced voice commands with NLU
- [ ] AR/VR integrations for immersive dashboards
- [ ] Widget framework for home screen widgets

---

## Support

For issues or questions:
- **Email**: support@apexbusiness-systems.com
- **GitHub Issues**: https://github.com/apexbusiness-systems/APEX-OmniHub/issues
- **Documentation**: /docs

---

## License

Proprietary. © 2026 APEX Business Systems. All rights reserved.
