/**
 * Security utilities for production
 */

import { logSecurityEvent } from './monitoring';
import { startGuardianLoops } from '@/guardian/loops';
import { createDebugLogger } from './debug-logger';

/**
 * Generate CSRF token
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Store CSRF token
 */
export function storeCsrfToken(token: string): void {
  sessionStorage.setItem('csrf_token', token);
}

/**
 * Get CSRF token
 */
export function getCsrfToken(): string | null {
  return sessionStorage.getItem('csrf_token');
}

/**
 * Validate CSRF token
 */
export function validateCsrfToken(token: string): boolean {
  const storedToken = getCsrfToken();
  if (!storedToken || storedToken !== token) {
    logSecurityEvent('csrf_attempt', { providedToken: token ? 'present' : 'missing' });
    return false;
  }
  return true;
}

/**
 * Initialize CSRF protection
 */
export function initializeCsrfProtection(): void {
  if (!getCsrfToken()) {
    const token = generateCsrfToken();
    storeCsrfToken(token);
  }
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

/**
 * Validate URL to prevent open redirect attacks
 */
export function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Check for suspicious activity patterns
 */
export function detectSuspiciousActivity(): boolean {
  const failedAttempts = sessionStorage.getItem('failed_auth_attempts');
  const count = failedAttempts ? parseInt(failedAttempts, 10) : 0;
  
  if (count > 5) {
    logSecurityEvent('suspicious_activity', {
      type: 'excessive_failed_attempts',
      count,
    });
    return true;
  }
  
  return false;
}

/**
 * Record failed authentication attempt
 */
export function recordFailedAuthAttempt(): void {
  const current = sessionStorage.getItem('failed_auth_attempts');
  const count = current ? parseInt(current, 10) + 1 : 1;
  sessionStorage.setItem('failed_auth_attempts', count.toString());
  
  if (count > 5) {
    logSecurityEvent('auth_failed', { consecutiveFailures: count });
  }
}

/**
 * Clear failed authentication attempts
 */
export function clearFailedAuthAttempts(): void {
  sessionStorage.removeItem('failed_auth_attempts');
}

/**
 * Account lockout management
 */
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

export interface LockoutStatus {
  isLocked: boolean;
  remainingTime?: number;
  attemptsRemaining?: number;
}

/**
 * Check if account is locked out
 */
export function checkAccountLockout(identifier: string): LockoutStatus {
  const key = `lockout_${identifier}`;
  const lockoutData = localStorage.getItem(key);
  
  if (!lockoutData) {
    return { isLocked: false, attemptsRemaining: MAX_ATTEMPTS };
  }
  
  const { timestamp, attempts } = JSON.parse(lockoutData);
  const now = Date.now();
  
  // Check if lockout period has expired
  if (now - timestamp > LOCKOUT_DURATION) {
    localStorage.removeItem(key);
    return { isLocked: false, attemptsRemaining: MAX_ATTEMPTS };
  }
  
  const remainingTime = LOCKOUT_DURATION - (now - timestamp);
  
  if (attempts >= MAX_ATTEMPTS) {
    return { isLocked: true, remainingTime };
  }
  
  return { isLocked: false, attemptsRemaining: MAX_ATTEMPTS - attempts };
}

/**
 * Record login attempt
 */
export function recordLoginAttempt(identifier: string, success: boolean): void {
  const key = `lockout_${identifier}`;
  
  if (success) {
    localStorage.removeItem(key);
    clearFailedAuthAttempts();
    return;
  }
  
  const lockoutData = localStorage.getItem(key);
  const now = Date.now();
  
  if (!lockoutData) {
    localStorage.setItem(key, JSON.stringify({ timestamp: now, attempts: 1 }));
    recordFailedAuthAttempt();
    return;
  }
  
  const { timestamp, attempts } = JSON.parse(lockoutData);
  
  // Reset if outside lockout window
  if (now - timestamp > LOCKOUT_DURATION) {
    localStorage.setItem(key, JSON.stringify({ timestamp: now, attempts: 1 }));
  } else {
    localStorage.setItem(
      key,
      JSON.stringify({ timestamp, attempts: attempts + 1 })
    );
  }
  
  recordFailedAuthAttempt();
}

/**
 * Generate secure request signature
 */
export async function generateRequestSignature(
  data: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify request signature
 */
export async function verifyRequestSignature(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expected = await generateRequestSignature(data, secret);
  return signature === expected;
}

/**
 * Initialize security features
 */
export function initializeSecurity(): void {
  const log = createDebugLogger('security.ts', 'A');
  
  // #region agent log
  log('initializeSecurity entry');
  // #endregion
  
  try {
    // #region agent log
    log('Before initializeCsrfProtection');
    // #endregion
    initializeCsrfProtection();
    
    // #region agent log
    log('Before detectSuspiciousActivity');
    // #endregion
    // Detect and log suspicious activity
    if (detectSuspiciousActivity()) {
      if (import.meta.env.DEV) {
        console.warn('⚠️ Suspicious activity detected');
      }
    }
    
    // #region agent log
    log('Before startGuardianLoops');
    // #endregion
    startGuardianLoops();
    
    // #region agent log
    log('Security initialized successfully');
    // #endregion
    if (import.meta.env.DEV) {
      console.log('✅ Security initialized');
    }
  } catch (error) {
    // #region agent log
    log('Security initialization error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    // #endregion
    if (import.meta.env.DEV) {
      console.error('Failed to initialize security:', error);
    }
  }
}
