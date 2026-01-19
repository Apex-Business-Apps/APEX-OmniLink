# Security Headers Configuration

This document provides security header configurations for deploying the APEX OmniHub marketing site across different hosting platforms.

## Quick Reference

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS protection |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information |
| `Permissions-Policy` | Deny all sensitive APIs | Restricts device API access |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Enforces HTTPS |
| `Content-Security-Policy` | See below | Controls resource loading |
| `X-DNS-Prefetch-Control` | `off` | Disables DNS prefetching |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolates browsing context |
| `Cross-Origin-Resource-Policy` | `same-origin` | Restricts resource sharing |
| `Cross-Origin-Embedder-Policy` | `require-corp` | Requires CORP for resources |

## Content Security Policy

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
font-src 'self';
img-src 'self' data:;
connect-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests
```

### CSP Design Decisions

**No External Dependencies**
- No Google Fonts (`font-src 'self'` only)
- No external scripts or analytics
- All resources served from same origin

**Inline Styles Exception**
- `style-src 'unsafe-inline'` is required for:
  - CSS-in-JS patterns used in React components
  - Inline style attributes for dynamic theming
- This is documented and acceptable for this use case

**Data URIs**
- `img-src data:` allows the grid texture SVG pattern defined in CSS
- No user-uploaded content uses data URIs

### Supabase Integration CSP

If Supabase backend is enabled, update `connect-src`:

```
connect-src 'self' https://<your-project>.supabase.co
```

## HSTS Preload

This site is configured with HSTS preload:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

### Preload Submission Requirements

Before submitting to the HSTS preload list:

1. **Verify HTTPS-only**: Ensure all content is served over HTTPS
2. **Verify subdomains**: All subdomains must also support HTTPS
3. **Test thoroughly**: Use [hstspreload.org](https://hstspreload.org/) eligibility checker
4. **Submit**: Once verified, submit at hstspreload.org

### Preload Warning

**HSTS preload is essentially permanent.** Once your domain is added to the preload list:
- It takes months to remove
- All browsers will enforce HTTPS for your domain
- HTTP-only services on any subdomain will break

Only enable preload if you are **certain** the domain will always use HTTPS.

### Disabling Preload

To disable preload (before submission):
1. Remove `preload` from the HSTS header
2. Keep `includeSubDomains` for security

## Platform Configurations

### Vercel

Configuration is in `vercel.json`. Deployed automatically with:
- All security headers
- Asset caching (1 year for `/assets/*`)
- Favicon caching (24 hours)

### IONOS / Apache

Create `.htaccess` in the document root:

```apache
<IfModule mod_headers.c>
    # Security Headers
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "DENY"
    Header set X-XSS-Protection "1; mode=block"
    Header set Referrer-Policy "strict-origin-when-cross-origin"
    Header set Permissions-Policy "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()"
    Header set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    Header set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"
    Header set X-DNS-Prefetch-Control "off"
    Header set Cross-Origin-Opener-Policy "same-origin"
    Header set Cross-Origin-Resource-Policy "same-origin"
    Header set Cross-Origin-Embedder-Policy "require-corp"
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType font/woff2 "access plus 1 year"
</IfModule>

# Serve pre-compressed files if available
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/css application/javascript
</IfModule>
```

### Nginx

Add to your server block:

```nginx
# Security Headers
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests" always;
add_header X-DNS-Prefetch-Control "off" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Resource-Policy "same-origin" always;
add_header Cross-Origin-Embedder-Policy "require-corp" always;

# Cache static assets
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Gzip compression
gzip on;
gzip_types text/plain text/css application/javascript application/json image/svg+xml;
gzip_min_length 1000;
```

### Netlify

Create `netlify.toml`:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()"
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
    Content-Security-Policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"
    X-DNS-Prefetch-Control = "off"
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Resource-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### Cloudflare Pages

Create `public/_headers`:

```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests
  X-DNS-Prefetch-Control: off
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

## Verification

### Command Line

```bash
curl -I https://apexomnihub.icu
```

### Online Tools

- **Security Headers**: https://securityheaders.com/
- **Mozilla Observatory**: https://observatory.mozilla.org/
- **CSP Evaluator**: https://csp-evaluator.withgoogle.com/

### Expected Grade

With this configuration, expect:
- **SecurityHeaders.com**: A+ grade
- **Mozilla Observatory**: A+ grade

## Rollback Procedures

### Remove All Security Headers

**Vercel**: Delete the `headers` array from `vercel.json`

**IONOS/Apache**: Delete `.htaccess` or remove the `<IfModule mod_headers.c>` block

**Nginx**: Remove all `add_header` directives from the server block

**Netlify**: Delete `netlify.toml` or remove the `[[headers]]` sections

### Disable HSTS Preload Only

Change:
```
max-age=63072000; includeSubDomains; preload
```

To:
```
max-age=63072000; includeSubDomains
```

**Note**: If already submitted to preload list, removal takes 6-12 weeks.

### Relax CSP

To allow additional sources, modify the CSP:

```
# Allow Supabase
connect-src 'self' https://*.supabase.co

# Allow external analytics (not recommended)
script-src 'self' https://analytics.example.com
```

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-01-11 | Initial configuration with HSTS preload | System |
| 2025-01-11 | Removed Google Fonts dependency | System |
| 2025-01-11 | Added Cross-Origin headers | System |
