/**
 * Site URL configuration
 * Single source of truth for the canonical base URL
 */

export function getSiteUrl(): string {
    // Production environment variable (highest priority)
    if (import.meta.env.VITE_SITE_URL) {
        return import.meta.env.VITE_SITE_URL;
    }

    // Preview environment (Vercel)
    if (import.meta.env.VITE_VERCEL_URL) {
        return `https://${import.meta.env.VITE_VERCEL_URL}`;
    }

    // Development fallback
    if (import.meta.env.DEV) {
        return 'http://localhost:5173';
    }

    // Default production URL
    return 'https://apexomnihub.icu';
}
