# Security Headers Configuration

This document provides security header configurations for deploying the APEX OmniHub marketing site across different hosting platforms.

## Headers Overview

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS protection (backup for older browsers) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information sent with requests |
| `Permissions-Policy` | Deny all sensitive APIs | Restricts access to device APIs |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | Enforces HTTPS (2 years) |
| `Content-Security-Policy` | See below | Controls resource loading |

## Content Security Policy Details

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data:;
connect-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self'
```

### CSP Exceptions Explained

- **`style-src 'unsafe-inline'`**: Required for CSS-in-JS and inline styles. The site uses minimal inline styles for layout.
- **`https://fonts.googleapis.com`**: Google Fonts stylesheet loading.
- **`https://fonts.gstatic.com`**: Google Fonts file hosting.
- **`img-src data:`**: Allows data URLs for the grid texture SVG pattern.

### Supabase Integration (When Enabled)

If Supabase is enabled via `VITE_ENABLE_REQUEST_ACCESS=true`, add the Supabase URL to `connect-src`:

```
connect-src 'self' https://<your-project>.supabase.co
```

## Platform-Specific Configurations

### Vercel

Configuration is in `vercel.json`. No additional setup required.

### IONOS

Create a `.htaccess` file in the root directory:

```apache
<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "DENY"
    Header set X-XSS-Protection "1; mode=block"
    Header set Referrer-Policy "strict-origin-when-cross-origin"
    Header set Permissions-Policy "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
    Header set Strict-Transport-Security "max-age=63072000; includeSubDomains"
    Header set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
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
```

### Nginx

Add to your server block:

```nginx
# Security Headers
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;

# Cache static assets
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Cloudflare Pages (if used)

Create `_headers` file in `public/`:

```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()
  Strict-Transport-Security: max-age=63072000; includeSubDomains
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

### Generic Static Hosting

For hosts that support `_headers` or similar:

1. Copy the Cloudflare Pages `_headers` format above
2. If the host doesn't support custom headers, consider using a CDN in front

## HSTS Preload Considerations

The current configuration does NOT include `preload` in the HSTS header. To enable HSTS preload:

1. Verify the site is fully HTTPS-only
2. Add `preload` to the header: `max-age=63072000; includeSubDomains; preload`
3. Submit to https://hstspreload.org/

**Warning**: HSTS preload is essentially permanent. Only enable if you're certain the domain will always use HTTPS.

## Rollback

To remove headers:

1. **Vercel**: Remove the `headers` section from `vercel.json`
2. **IONOS/Apache**: Delete the `.htaccess` file
3. **Nginx**: Remove the `add_header` directives
4. **Cloudflare Pages**: Delete the `_headers` file

## Verification

Test headers with:

```bash
curl -I https://apexomnihub.icu
```

Or use online tools:
- https://securityheaders.com/
- https://observatory.mozilla.org/
