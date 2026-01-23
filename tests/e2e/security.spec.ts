import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * E2E SECURITY TESTS
 *
 * Tests security module functionality:
 * - CSRF protection
 * - Account lockout
 * - Suspicious activity detection
 */

// Mock browser APIs
beforeEach(() => {
  vi.resetModules();
  // Mock sessionStorage
  const sessionStore: Record<string, string> = {};
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => sessionStore[key] || null,
    setItem: (key: string, value: string) => { sessionStore[key] = value; },
    removeItem: (key: string) => { delete sessionStore[key]; },
    clear: () => { Object.keys(sessionStore).forEach(k => delete sessionStore[k]); },
  });

  // Mock localStorage
  const localStore: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => localStore[key] || null,
    setItem: (key: string, value: string) => { localStore[key] = value; },
    removeItem: (key: string) => { delete localStore[key]; },
    clear: () => { Object.keys(localStore).forEach(k => delete localStore[k]); },
  });

  // Mock crypto
  vi.stubGlobal('crypto', {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: {
      importKey: vi.fn().mockResolvedValue({}),
      sign: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
  });

  // Nuclear Mocking Option for Vitest/JSDOM consistency
  const mockLocation = {
    origin: 'https://example.com',
    hostname: 'example.com',
    href: 'https://example.com/',
    toString: () => 'https://example.com/'
  };

  // Force assignment to global scope
  Object.defineProperty(global, 'location', {
    writable: true,
    value: mockLocation,
  });

  Object.defineProperty(global, 'window', {
    writable: true,
    value: { location: mockLocation },
  });
});

describe('Security Module E2E Tests', () => {
  describe('CSRF Protection', () => {
    it('generates cryptographically secure CSRF token', async () => {
      const { generateCsrfToken } = await import('../../src/lib/security');
      const token = generateCsrfToken();

      expect(token).toBeDefined();
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars
      expect(/^[a-f0-9]+$/i.test(token)).toBe(true);
    });

    it('stores and retrieves CSRF token from session', async () => {
      const { generateCsrfToken, storeCsrfToken, getCsrfToken } = await import('../../src/lib/security');
      const token = generateCsrfToken();
      storeCsrfToken(token);

      const retrieved = getCsrfToken();
      expect(retrieved).toBe(token);
    });

    it('validates correct CSRF token', async () => {
      const { generateCsrfToken, storeCsrfToken, validateCsrfToken } = await import('../../src/lib/security');
      const token = generateCsrfToken();
      storeCsrfToken(token);

      expect(validateCsrfToken(token)).toBe(true);
    });

    it('rejects incorrect CSRF token', async () => {
      const { generateCsrfToken, storeCsrfToken, validateCsrfToken } = await import('../../src/lib/security');
      const token = generateCsrfToken();
      storeCsrfToken(token);

      expect(validateCsrfToken('wrong-token')).toBe(false);
    });

    it('rejects missing CSRF token', async () => {
      const { validateCsrfToken } = await import('../../src/lib/security');
      expect(validateCsrfToken('any-token')).toBe(false);
    });
  });

  describe('Open Redirect Prevention', () => {
    it('allows same-origin URLs', async () => {
      const { isValidRedirectUrl } = await import('../../src/lib/security');

      expect(isValidRedirectUrl('/dashboard')).toBe(true);
      expect(isValidRedirectUrl('/auth')).toBe(true);
      expect(isValidRedirectUrl('https://example.com/page')).toBe(true);
    });

    it('blocks cross-origin URLs', async () => {
      const { isValidRedirectUrl } = await import('../../src/lib/security');

      expect(isValidRedirectUrl('https://evil.com/phish')).toBe(false);
      expect(isValidRedirectUrl('//evil.com/path')).toBe(false);
    });

    it('handles malformed URLs gracefully', async () => {
      const { isValidRedirectUrl } = await import('../../src/lib/security');

      expect(isValidRedirectUrl('javascript:alert(1)')).toBe(false);
      expect(isValidRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });
  });

  describe('Account Lockout', () => {
    it('tracks failed login attempts', async () => {
      const { recordLoginAttempt, checkAccountLockout } = await import('../../src/lib/security');
      const identifier = 'test@example.com';

      // Record failed attempts
      for (let i = 0; i < 3; i++) {
        recordLoginAttempt(identifier, false);
      }

      const status = checkAccountLockout(identifier);
      expect(status.isLocked).toBe(false);
      expect(status.attemptsRemaining).toBe(2);
    });

    it('locks account after max attempts', async () => {
      const { recordLoginAttempt, checkAccountLockout } = await import('../../src/lib/security');
      const identifier = 'locked@example.com';

      // Record max failed attempts
      for (let i = 0; i < 5; i++) {
        recordLoginAttempt(identifier, false);
      }

      const status = checkAccountLockout(identifier);
      expect(status.isLocked).toBe(true);
      expect(status.remainingTime).toBeGreaterThan(0);
    });

    it('clears lockout on successful login', async () => {
      const { recordLoginAttempt, checkAccountLockout } = await import('../../src/lib/security');
      const identifier = 'success@example.com';

      // Record some failed attempts
      for (let i = 0; i < 3; i++) {
        recordLoginAttempt(identifier, false);
      }

      // Successful login
      recordLoginAttempt(identifier, true);

      const status = checkAccountLockout(identifier);
      expect(status.isLocked).toBe(false);
      expect(status.attemptsRemaining).toBe(5);
    });
  });

  describe('Suspicious Activity Detection', () => {
    it('detects excessive failed attempts', async () => {
      const { recordFailedAuthAttempt, detectSuspiciousActivity } = await import('../../src/lib/security');

      // Record excessive failed attempts
      for (let i = 0; i < 6; i++) {
        recordFailedAuthAttempt();
      }

      expect(detectSuspiciousActivity()).toBe(true);
    });

    it('allows normal failed attempt counts', async () => {
      const { recordFailedAuthAttempt, detectSuspiciousActivity, clearFailedAuthAttempts } = await import('../../src/lib/security');

      clearFailedAuthAttempts();

      // Record a few failed attempts
      for (let i = 0; i < 3; i++) {
        recordFailedAuthAttempt();
      }

      expect(detectSuspiciousActivity()).toBe(false);
    });
  });
});
