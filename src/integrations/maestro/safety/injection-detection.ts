/**
 * MAESTRO Injection Detection Module
 * Detects prompt injection, jailbreak attempts, and suspicious patterns
 */

import type { InjectionDetectionResult } from '../types';

// High-risk injection patterns that always block
const HIGH_RISK_PATTERNS: Array<{ name: string; pattern: RegExp; score: number }> = [
  // Instruction override attempts
  { name: 'ignore_previous', pattern: /ignore\s+(all\s+)?(previous\s+|your\s+)?instructions/i, score: 90 },
  { name: 'disregard_previous', pattern: /disregard\s+(all\s+)?(previous\s+|your\s+)?instructions/i, score: 90 },
  { name: 'forget_previous', pattern: /forget\s+(all\s+)?(previous\s+|your\s+)?instructions/i, score: 90 },

  // Role manipulation
  { name: 'you_are_now', pattern: /you\s+are\s+now\s+(a|an|the)/i, score: 85 },
  { name: 'act_as', pattern: /act\s+as\s+(a|an|if)/i, score: 80 },
  { name: 'pretend', pattern: /pretend\s+(you\s*('re|are)|to\s+be)/i, score: 85 },

  // Prompt extraction - fixed regex to avoid catastrophic backtracking
  { name: 'show_prompt', pattern: /show\s+(me\s+)?(your\s+)?(system\s+)?prompt/i, score: 95 },
  { name: 'show_instructions', pattern: /show\s+(me\s+)?your\s+instructions/i, score: 95 },
  { name: 'reveal_instructions', pattern: /reveal\s+(your\s+)?(instructions|system\s+prompt)/i, score: 95 },
  { name: 'reveal_training', pattern: /reveal\s+(your\s+)?(\w+\s+){0,5}training\s+(data|methodology)/i, score: 95 },
  { name: 'what_instructions', pattern: /what\s+are\s+your\s+instructions/i, score: 90 },

  // Code execution attempts
  { name: 'execute_code', pattern: /execute\s+(this\s+)?code/i, score: 95 },
  { name: 'eval', pattern: /\beval\s*\(/i, score: 100 },
  { name: 'run_command', pattern: /run\s+(this\s+)?command/i, score: 90 },

  // Delimiter injection
  { name: 'delimiter_injection', pattern: /\[?(system|user|assistant)\]?\s*:/i, score: 85 },
  { name: 'xml_injection', pattern: /<\/?(?:system|prompt|instruction|context)>/i, score: 85 },
  { name: 'comment_injection', pattern: /(?:\/\*|\*\/|<!--|-->|#\s*system)/i, score: 80 },

  // Data exfiltration
  { name: 'send_to', pattern: /send\s+(it\s+|this\s+|data\s+)?to\s+/i, score: 75 },
  { name: 'post_to', pattern: /post\s+(it\s+|this\s+|data\s+)?to\s+/i, score: 75 },
  { name: 'email_to', pattern: /email\s+(it\s+|this\s+|data\s+)?to\s+/i, score: 75 },

  // Security bypass
  { name: 'bypass_security', pattern: /bypass\s+(the\s+)?security/i, score: 95 },
  { name: 'override_policy', pattern: /override\s+(the\s+)?policy/i, score: 90 },
  { name: 'disable_validation', pattern: /disable\s+(the\s+)?validation/i, score: 90 },

  // Jailbreak attempts
  { name: 'dan_jailbreak', pattern: /\bDAN\b.*mode|do\s+anything\s+now/i, score: 95 },
  { name: 'developer_mode', pattern: /developer\s+mode\s+(enabled|on|activated)/i, score: 90 },
  { name: 'jailbreak', pattern: /\bjailbreak\b/i, score: 90 },
];

// Medium-risk patterns that may be suspicious but could be legitimate
const MEDIUM_RISK_PATTERNS: Array<{ name: string; pattern: RegExp; score: number }> = [
  // Encoded payloads - base64 detection
  {
    name: 'base64_payload',
    pattern: /[A-Za-z0-9+/]{20,}={0,2}/,
    score: 60,
  },
  // Hex encoded payloads - fixed duplicate character class
  { name: 'hex_payload', pattern: /(?:0x[a-fA-F0-9]{16,}|\\x[a-fA-F0-9]{2}(?:\\x[a-fA-F0-9]{2}){7,})/i, score: 65 },
  // Unicode escapes - fixed duplicate character class
  { name: 'unicode_escape', pattern: /(?:\\u[0-9a-fA-F]{4}){4,}/i, score: 60 },
];

/**
 * Check for high special character ratio
 */
function hasHighSpecialCharRatio(input: string): boolean {
  const specialChars = input.replaceAll(/[a-zA-Z0-9\s]/g, '').length;
  const ratio = specialChars / input.length;
  return ratio > 0.3 && input.length > 20;
}

/**
 * Check for excessive capitalization
 */
function hasExcessiveCapitalization(input: string): boolean {
  const caps = input.replaceAll(/[^A-Z]/g, '').length;
  const letters = input.replaceAll(/[^a-zA-Z]/g, '').length;
  return letters > 20 && caps / letters > 0.7;
}

/**
 * Check for repetitive patterns (potential DoS or obfuscation)
 */
function hasRepetitivePattern(input: string): boolean {
  // Check for same character repeated many times
  if (/(.)\1{19,}/.test(input)) return true;
  // Check for same word/phrase repeated
  const words = input.toLowerCase().split(/\s+/);
  if (words.length < 5) return false;
  const wordCounts = new Map<string, number>();
  for (const word of words) {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  }
  for (const count of wordCounts.values()) {
    if (count >= 10 && count / words.length > 0.5) return true;
  }
  return false;
}

// Suspicious token patterns
const SUSPICIOUS_TOKEN_PATTERNS: Array<{ name: string; check: (input: string) => boolean; score: number }> = [
  { name: 'high_special_chars', check: hasHighSpecialCharRatio, score: 50 },
  { name: 'excessive_caps', check: hasExcessiveCapitalization, score: 45 },
  { name: 'repetitive_pattern', check: hasRepetitivePattern, score: 55 },
];

// Input validation constants
const MAX_INPUT_LENGTH = 10000;
const BLOCK_THRESHOLD = 70;

/**
 * Check patterns against input and update result
 */
function checkPatterns(
  input: string,
  patterns: Array<{ name: string; pattern: RegExp; score: number }>,
  result: InjectionDetectionResult,
  threshold: number,
  alwaysBlockHighScore: boolean
): void {
  for (const { name, pattern, score } of patterns) {
    if (pattern.test(input)) {
      result.detected = true;
      result.patterns_matched.push(name);
      result.risk_score = Math.max(result.risk_score, score);

      if (alwaysBlockHighScore && score >= 70) {
        result.blocked = true;
      } else if (result.risk_score >= threshold) {
        result.blocked = true;
      }
    }
  }
}

/**
 * Detect potential injection attacks in input
 */
export function detectInjection(
  input: string,
  options: { threshold?: number } = {}
): InjectionDetectionResult {
  const threshold = options.threshold ?? BLOCK_THRESHOLD;
  const result: InjectionDetectionResult = {
    detected: false,
    blocked: false,
    patterns_matched: [],
    risk_score: 0,
    warnings: [],
  };

  // Empty or whitespace-only input
  if (!input?.trim()) {
    return result;
  }

  // Check input length
  if (input.length > MAX_INPUT_LENGTH) {
    result.detected = true;
    result.blocked = true;
    result.patterns_matched.push('excessive_length');
    result.risk_score = 100;
    return result;
  }

  // Check high-risk patterns (always block if score >= 70)
  checkPatterns(input, HIGH_RISK_PATTERNS, result, threshold, true);

  // Check medium-risk patterns
  checkPatterns(input, MEDIUM_RISK_PATTERNS, result, threshold, false);

  // Check suspicious token patterns
  for (const { name, check, score } of SUSPICIOUS_TOKEN_PATTERNS) {
    if (check(input)) {
      result.detected = true;
      result.patterns_matched.push(name);
      result.risk_score = Math.max(result.risk_score, score);

      if (result.risk_score >= threshold) {
        result.blocked = true;
      }
    }
  }

  // Add warnings for detected but not blocked patterns
  if (result.detected && !result.blocked) {
    result.warnings.push(
      `Suspicious patterns detected: ${result.patterns_matched.join(', ')}. Risk score: ${result.risk_score}`
    );
  }

  return result;
}

/**
 * Validate input meets basic requirements
 */
export function validateInput(input: string): { valid: boolean; error?: string } {
  if (!input) {
    return { valid: false, error: 'Input is required' };
  }

  if (!input.trim()) {
    return { valid: false, error: 'Input cannot be empty or whitespace-only' };
  }

  if (input.length > MAX_INPUT_LENGTH) {
    return { valid: false, error: `Input exceeds maximum length of ${MAX_INPUT_LENGTH}` };
  }

  return { valid: true };
}

/**
 * Sanitize input by removing potentially dangerous patterns
 */
export function sanitizeInput(input: string): string {
  let sanitized = input;

  // Remove instruction delimiters
  sanitized = sanitized.replaceAll(/\[?(system|user|assistant)\]?\s*:/gi, '');

  // Remove eval patterns
  sanitized = sanitized.replaceAll(/\beval\s*\([^)]*\)/gi, '[REMOVED]');

  // Normalize special characters (remove non-ASCII printable)
  sanitized = sanitized.replaceAll(/[^\x20-\x7E\s]/g, '');

  // Normalize whitespace
  sanitized = sanitized.replaceAll(/\s+/g, ' ').trim();

  return sanitized;
}

/**
 * Full security scan with validation, detection, and sanitization
 */
export function securityScan(
  input: string,
  options: { threshold?: number; maxLength?: number } = {}
): {
  passed: boolean;
  input_valid: boolean;
  injection_result: InjectionDetectionResult;
  sanitized?: string;
  error?: string;
} {
  // Validate input
  const validation = validateInput(input);
  if (!validation.valid) {
    return {
      passed: false,
      input_valid: false,
      injection_result: {
        detected: false,
        blocked: false,
        patterns_matched: [],
        risk_score: 0,
        warnings: [],
      },
      error: validation.error,
    };
  }

  // Detect injection
  const injectionResult = detectInjection(input, options);

  // If blocked, fail the scan
  if (injectionResult.blocked) {
    return {
      passed: false,
      input_valid: true,
      injection_result: injectionResult,
    };
  }

  // Sanitize and return
  return {
    passed: true,
    input_valid: true,
    injection_result: injectionResult,
    sanitized: sanitizeInput(input),
  };
}
