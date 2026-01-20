/**
 * MAESTRO Locale Utilities
 *
 * BCP-47 locale handling and validation.
 */

import type { LocaleString } from '../types';

/**
 * Validate BCP-47 locale string
 * Format: language[-region][-script][-variant]
 * Examples: en, en-US, zh-Hans-CN, en-GB-oxendict
 */
export function isValidBcp47Locale(locale: string): boolean {
  // Basic BCP-47 pattern: lowercase language tag, optional region/script/variant
  const bcp47Pattern = /^[a-z]{2,3}(-[A-Z]{2})?(-[A-Z][a-z]{3})?(-[a-z0-9]{5,8})?$/;
  return bcp47Pattern.test(locale);
}

/**
 * Parse BCP-47 locale into components
 */
export interface LocaleComponents {
  language: string; // e.g., "en"
  region?: string; // e.g., "US"
  script?: string; // e.g., "Hans"
  variant?: string; // e.g., "oxendict"
}

export function parseBcp47Locale(locale: string): LocaleComponents | null {
  if (!isValidBcp47Locale(locale)) {
    return null;
  }

  const parts = locale.split('-');
  const components: LocaleComponents = {
    language: parts[0],
  };

  // Check for region (2 uppercase letters)
  if (parts[1] && /^[A-Z]{2}$/.test(parts[1])) {
    components.region = parts[1];
  }

  // Check for script (1 uppercase + 3 lowercase)
  if (parts[1] && /^[A-Z][a-z]{3}$/.test(parts[1])) {
    components.script = parts[1];
  } else if (parts[2] && /^[A-Z][a-z]{3}$/.test(parts[2])) {
    components.script = parts[2];
  }

  // Check for variant (5-8 alphanumeric)
  const lastPart = parts[parts.length - 1];
  if (lastPart && /^[a-z0-9]{5,8}$/.test(lastPart)) {
    components.variant = lastPart;
  }

  return components;
}

/**
 * Get language from locale
 * en-US → en
 * zh-Hans-CN → zh
 */
export function getLanguage(locale: LocaleString): string {
  const components = parseBcp47Locale(locale);
  return components?.language || locale.split('-')[0] || locale;
}

/**
 * Get region from locale
 * en-US → US
 * zh-Hans-CN → CN
 */
export function getRegion(locale: LocaleString): string | null {
  const components = parseBcp47Locale(locale);
  return components?.region || null;
}

/**
 * Check if two locales have the same language
 * en-US and en-GB → true
 * en-US and fr-FR → false
 */
export function sameLanguage(locale1: LocaleString, locale2: LocaleString): boolean {
  return getLanguage(locale1) === getLanguage(locale2);
}

/**
 * Get locale fallback chain
 * en-US-variant → [en-US-variant, en-US, en]
 */
export function getLocaleFallbackChain(locale: LocaleString): string[] {
  const parts = locale.split('-');
  const chain: string[] = [locale];

  // Build fallback chain from most specific to least specific
  for (let i = parts.length - 1; i > 0; i--) {
    chain.push(parts.slice(0, i).join('-'));
  }

  return chain;
}

/**
 * Normalize locale (lowercase language, uppercase region)
 * en-us → en-US
 * EN-US → en-US
 */
export function normalizeLocale(locale: string): string {
  const parts = locale.split('-');

  if (parts.length === 1) {
    return parts[0].toLowerCase();
  }

  const language = parts[0].toLowerCase();
  const region = parts[1].toUpperCase();

  if (parts.length === 2) {
    return `${language}-${region}`;
  }

  // Handle script/variant
  return parts
    .map((part, index) => {
      if (index === 0) return part.toLowerCase(); // language
      if (index === 1 && /^[A-Z]{2}$/.test(part)) return part.toUpperCase(); // region
      if (/^[A-Z][a-z]{3}$/.test(part)) {
        // script
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }
      return part.toLowerCase(); // variant
    })
    .join('-');
}

/**
 * Common locale mapping
 */
export const COMMON_LOCALES: Record<string, string> = {
  'en': 'English',
  'en-US': 'English (United States)',
  'en-GB': 'English (United Kingdom)',
  'en-CA': 'English (Canada)',
  'en-AU': 'English (Australia)',
  'fr': 'Français',
  'fr-FR': 'Français (France)',
  'fr-CA': 'Français (Canada)',
  'es': 'Español',
  'es-ES': 'Español (España)',
  'es-MX': 'Español (México)',
  'de': 'Deutsch',
  'de-DE': 'Deutsch (Deutschland)',
  'zh': '中文',
  'zh-CN': '中文 (中国)',
  'zh-TW': '中文 (台灣)',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  'ja': '日本語',
  'ja-JP': '日本語 (日本)',
  'ko': '한국어',
  'ko-KR': '한국어 (대한민국)',
  'ar': 'العربية',
  'ar-SA': 'العربية (السعودية)',
  'ru': 'Русский',
  'ru-RU': 'Русский (Россия)',
  'pt': 'Português',
  'pt-BR': 'Português (Brasil)',
  'pt-PT': 'Português (Portugal)',
  'it': 'Italiano',
  'it-IT': 'Italiano (Italia)',
  'hi': 'हिन्दी',
  'hi-IN': 'हिन्दी (भारत)',
  'th': 'ไทย',
  'th-TH': 'ไทย (ไทย)',
  'vi': 'Tiếng Việt',
  'vi-VN': 'Tiếng Việt (Việt Nam)',
};

/**
 * Get locale display name
 */
export function getLocaleDisplayName(locale: LocaleString): string {
  return COMMON_LOCALES[locale] || locale;
}

/**
 * Assert valid BCP-47 locale (throws on invalid)
 */
export function assertValidLocale(locale: string): asserts locale is LocaleString {
  if (!isValidBcp47Locale(locale)) {
    throw new Error(`Invalid BCP-47 locale: ${locale}`);
  }
}
