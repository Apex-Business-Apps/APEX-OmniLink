/**
 * Shared validation utilities for Supabase Edge Functions
 *
 * Provides standardized validation functions for common data types
 * to eliminate duplication across functions.
 *
 * Author: OmniLink APEX
 * Date: 2026-01-19
 */

/**
 * Validate Ethereum wallet address format
 * @param address - The address to validate
 * @returns true if valid, false otherwise
 */
export function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate Ethereum signature format (65 bytes = 130 hex chars + 0x)
 * @param signature - The signature to validate
 * @returns true if valid, false otherwise
 */
export function isValidSignature(signature: string): boolean {
  return /^0x[a-fA-F0-9]{130}$/.test(signature);
}

/**
 * Validate email address format
 * @param email - The email to validate
 * @returns true if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate UUID format
 * @param uuid - The UUID to validate
 * @returns true if valid, false otherwise
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate URL format
 * @param url - The URL to validate
 * @returns true if valid, false otherwise
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate automation ID format
 * @param id - The automation ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidAutomationId(id: string): boolean {
  return typeof id === 'string' && id.trim().length > 0 && id.trim().length <= 100;
}

/**
 * Validate integration type
 * @param type - The integration type to validate
 * @returns true if valid, false otherwise
 */
export function isValidIntegrationType(type: string): boolean {
  const validTypes = ['slack', 'zapier', 'github', 'notion', 'google_drive'];
  return validTypes.includes(type);
}

/**
 * Sanitize and validate string input
 * @param input - The input string to sanitize
 * @param options - Validation options
 * @returns sanitized string or null if invalid
 */
export function sanitizeString(
  input: unknown,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  } = {}
): string | null {
  if (typeof input !== 'string') {
    return options.required ? null : '';
  }

  const trimmed = input.trim();

  if (options.required && trimmed.length === 0) {
    return null;
  }

  if (options.minLength && trimmed.length < options.minLength) {
    return null;
  }

  if (options.maxLength && trimmed.length > options.maxLength) {
    return null;
  }

  if (options.pattern && !options.pattern.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Validate request body structure
 * @param body - The request body to validate
 * @param requiredFields - Array of required field names
 * @returns validation result with errors if any
 */
export function validateRequestBody(body: unknown, requiredFields: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    errors.push('Request body must be a valid JSON object');
    return { valid: false, errors };
  }

  const bodyObj = body as Record<string, unknown>;

  for (const field of requiredFields) {
    if (!(field in bodyObj) || bodyObj[field] === null || bodyObj[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
