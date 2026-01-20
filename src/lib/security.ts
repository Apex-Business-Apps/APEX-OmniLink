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

// ===========================================================================
// MAESTRO E2EE FUNCTIONS (AES-GCM + PBKDF2)
// ===========================================================================

/**
 * Generate AES-GCM encryption key
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive encryption key from passphrase using PBKDF2
 * @param passphrase User passphrase
 * @param salt Salt for key derivation (store with key metadata)
 * @param iterations Number of PBKDF2 iterations (default: 100000)
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iterations = 100000
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    passphraseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate random salt for PBKDF2
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Encrypt memory content using AES-GCM
 * @param plaintext Content to encrypt
 * @param key AES-GCM key
 * @returns Base64-encoded ciphertext with IV prepended
 */
export async function encryptMemory(
  plaintext: string,
  key: CryptoKey
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    data
  );

  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Return base64-encoded
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt memory content using AES-GCM
 * @param ciphertext Base64-encoded ciphertext with IV prepended
 * @param key AES-GCM key
 * @returns Decrypted plaintext
 */
export async function decryptMemory(
  ciphertext: string,
  key: CryptoKey
): Promise<string> {
  // Decode base64
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));

  // Extract IV (first 12 bytes) and ciphertext
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    data
  );

  // Decode
  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

/**
 * Compute SHA-256 hash of content
 * @param content Content to hash
 * @returns Hex-encoded SHA-256 hash
 */
export async function computeContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Export encryption key to raw format (for storage)
 */
export async function exportKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('raw', key);
}

/**
 * Import encryption key from raw format
 */
export async function importKey(keyData: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    keyData,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Create passphrase verifier (for checking if passphrase is correct)
 * @param passphrase User passphrase
 * @param salt Salt used for key derivation
 * @returns Hex-encoded verifier (first 32 bytes of derived key hash)
 */
export async function createPassphraseVerifier(
  passphrase: string,
  salt: Uint8Array
): Promise<string> {
  const key = await deriveKeyFromPassphrase(passphrase, salt);
  const keyData = await exportKey(key);
  const hash = await crypto.subtle.digest('SHA-256', keyData);
  return Array.from(new Uint8Array(hash).slice(0, 32))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify passphrase against stored verifier
 */
export async function verifyPassphrase(
  passphrase: string,
  salt: Uint8Array,
  storedVerifier: string
): Promise<boolean> {
  const computedVerifier = await createPassphraseVerifier(passphrase, salt);
  return computedVerifier === storedVerifier;
}
