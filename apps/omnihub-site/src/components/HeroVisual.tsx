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
  return (
    <div className="hero-visual" aria-hidden="true">
      <img
        src="/assets/hero.svg"
        alt=""
        className="hero-visual__image"
        loading="eager"
      />
    </div>
  );
}
