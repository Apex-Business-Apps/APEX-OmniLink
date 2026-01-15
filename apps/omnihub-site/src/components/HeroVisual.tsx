import { useSyncExternalStore } from 'react';

/**
 * Subscribe to theme changes using MutationObserver
 */
function subscribeToTheme(callback: () => void) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'data-theme') {
        callback();
      }
    }
  });
  observer.observe(document.documentElement, { attributes: true });
  return () => observer.disconnect();
}

/**
 * Get the current theme snapshot
 */
function getThemeSnapshot(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

/**
 * Server snapshot always returns false (light mode)
 */
function getServerSnapshot(): boolean {
  return false;
}

export function HeroVisual() {
  const isDark = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerSnapshot
  );

  // Use asset-based hero images for both themes
  const heroSrc = isDark ? '/assets/hero-night.png' : '/assets/hero-light.png';
  // Fallback to existing dark image if light doesn't exist yet
  const fallbackSrc = isDark ? '/hero-hub-dark.png' : '/assets/hero-night.png';

  return (
    <div className="hero-visual" aria-hidden="true">
      <img
        src={heroSrc}
        alt=""
        className="hero-visual__image"
        loading="eager"
        onError={(e) => {
          // Fallback if asset doesn't exist
          const target = e.target as HTMLImageElement;
          if (target.src !== fallbackSrc) {
            target.src = fallbackSrc;
          }
        }}
      />
    </div>
  );
}
