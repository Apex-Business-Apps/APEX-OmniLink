/**
 * MAESTRO Prompt Injection Detection
 *
 * Rule-based detection for common prompt injection patterns.
 * Fail-closed: when injection is detected, execution is blocked.
 *
 * Phase 5: Execution & Safety
 */

export interface InjectionDetectionResult {
  detected: boolean;
  confidence: number; // 0.0 - 1.0
  patterns_matched: string[];
  risk_score: number; // 0-100
  blocked: boolean;
}

/**
 * Known injection patterns (regex)
 * Based on OWASP LLM Top 10 and common attack vectors
 */
const INJECTION_PATTERNS: Array<{ name: string; pattern: RegExp; severity: number }> = [
  // Ignore previous instructions
  { name: 'ignore_previous', pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i, severity: 90 },
  { name: 'disregard_previous', pattern: /disregard\s+(all\s+)?(previous|prior|above)\s+instructions?/i, severity: 90 },
  { name: 'forget_previous', pattern: /forget\s+(all\s+)?(previous|prior|above)\s+instructions?/i, severity: 85 },

  // Role manipulation
  { name: 'new_role', pattern: /you\s+are\s+now\s+(a|an)\s+\w+/i, severity: 85 },
  { name: 'act_as', pattern: /act\s+as\s+(a|an)\s+\w+/i, severity: 80 },
  { name: 'pretend', pattern: /pretend\s+(to\s+be|you\s+are)\s+/i, severity: 80 },
  { name: 'simulate', pattern: /simulate\s+(a|an)\s+\w+/i, severity: 75 },

  // System prompt extraction
  { name: 'show_prompt', pattern: /show\s+(me\s+)?(your\s+)?(system\s+)?(prompt|instructions?)/i, severity: 95 },
  { name: 'reveal_prompt', pattern: /reveal\s+(your\s+)?(system\s+)?(prompt|instructions?)/i, severity: 95 },
  { name: 'what_are_instructions', pattern: /what\s+are\s+your\s+(system\s+)?(instructions?|rules?)/i, severity: 90 },

  // Code execution attempts
  { name: 'execute_code', pattern: /execute\s+(the\s+following\s+)?(code|script|command)/i, severity: 95 },
  { name: 'run_command', pattern: /run\s+(the\s+following\s+)?(code|script|command)/i, severity: 95 },
  { name: 'eval', pattern: /\beval\s*\(/i, severity: 100 },

  // Delimiter confusion
  { name: 'end_instruction', pattern: /\[\/?(INST|SYS|SYSTEM|END)\]/i, severity: 85 },
  { name: 'xml_injection', pattern: /<\/?[a-z]+>/i, severity: 70 },
  { name: 'comment_injection', pattern: /(\/\*|\*\/|<!--|-->|\/\/\s*[A-Z]{3,})/i, severity: 65 },

  // Data exfiltration
  { name: 'send_to', pattern: /send\s+(this\s+)?(to|data|information)\s+to\s+/i, severity: 90 },
  { name: 'post_to', pattern: /post\s+(this\s+)?(to|data)\s+/i, severity: 85 },
  { name: 'email_to', pattern: /email\s+(this\s+)?to\s+/i, severity: 85 },

  // Bypass attempts
  { name: 'bypass', pattern: /bypass\s+(the\s+)?(security|filter|check|validation)/i, severity: 95 },
  { name: 'override', pattern: /override\s+(the\s+)?(security|policy|rule|restriction)/i, severity: 95 },
  { name: 'disable', pattern: /disable\s+(the\s+)?(security|filter|check|validation)/i, severity: 95 },

  // Encoded payloads (basic detection)
  { name: 'base64', pattern: /[A-Za-z0-9+/]{40,}={0,2}/i, severity: 60 },
  { name: 'hex_encoded', pattern: /0x[0-9a-fA-F]{20,}/i, severity: 60 },
  { name: 'unicode_escape', pattern: /\\u[0-9a-fA-F]{4}/i, severity: 55 },

  // Authority manipulation
  { name: 'admin', pattern: /\b(admin|root|superuser|sudo)\b/i, severity: 70 },
  { name: 'privilege_escalation', pattern: /elevate\s+(my\s+)?(privileges?|permissions?|access)/i, severity: 90 },

  // Jailbreak patterns
  { name: 'dan_jailbreak', pattern: /\bDAN\b.*mode/i, severity: 95 },
  { name: 'developer_mode', pattern: /developer\s+mode/i, severity: 85 },
  { name: 'jailbreak', pattern: /jailbreak/i, severity: 90 },
];

/**
 * Suspicious token sequences
 * High entropy or unusual character patterns
 */
function detectSuspiciousTokens(text: string): { detected: boolean; score: number } {
  // Check for high ratio of special characters
  const specialChars = (text.match(/[^a-zA-Z0-9\s]/g) || []).length;
  const specialRatio = specialChars / text.length;

  if (specialRatio > 0.4) {
    return { detected: true, score: 70 };
  }

  // Check for excessive capitalization
  const capitals = (text.match(/[A-Z]/g) || []).length;
  const capitalRatio = capitals / text.length;

  if (capitalRatio > 0.5 && text.length > 20) {
    return { detected: true, score: 60 };
  }

  // Check for repetitive patterns
  const words = text.split(/\s+/);
  const uniqueWords = new Set(words);
  const repetitionRatio = 1 - uniqueWords.size / words.length;

  if (repetitionRatio > 0.7 && words.length > 10) {
    return { detected: true, score: 65 };
  }

  return { detected: false, score: 0 };
}

/**
 * Detect prompt injection in input text
 *
 * @param text - User input to analyze
 * @param threshold - Detection threshold (0-100, default: 70)
 * @returns Detection result with matched patterns and risk score
 */
export function detectInjection(
  text: string,
  threshold: number = 70
): InjectionDetectionResult {
  const matchedPatterns: string[] = [];
  let maxSeverity = 0;
  let totalRiskScore = 0;

  // Check against known patterns
  for (const { name, pattern, severity } of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      matchedPatterns.push(name);
      maxSeverity = Math.max(maxSeverity, severity);
      totalRiskScore += severity;
    }
  }

  // Check for suspicious tokens
  const suspiciousTokens = detectSuspiciousTokens(text);
  if (suspiciousTokens.detected) {
    matchedPatterns.push('suspicious_tokens');
    totalRiskScore += suspiciousTokens.score;
  }

  // Normalize risk score (cap at 100)
  const riskScore = Math.min(totalRiskScore, 100);

  // Calculate confidence (based on number of patterns matched)
  const confidence = matchedPatterns.length > 0 ? Math.min(0.5 + matchedPatterns.length * 0.1, 1.0) : 0;

  // Determine if injection should be blocked
  const blocked = riskScore >= threshold;

  return {
    detected: matchedPatterns.length > 0,
    confidence,
    patterns_matched: matchedPatterns,
    risk_score: riskScore,
    blocked,
  };
}

/**
 * Sanitize input by removing detected injection patterns
 * USE WITH CAUTION: Prefer blocking over sanitization
 *
 * @param text - Input to sanitize
 * @returns Sanitized text
 */
export function sanitizeInput(text: string): string {
  let sanitized = text;

  // Remove known injection delimiters
  sanitized = sanitized.replace(/\[\/?(INST|SYS|SYSTEM|END)\]/gi, '');

  // Remove common code execution patterns
  sanitized = sanitized.replace(/eval\s*\(/gi, '');
  sanitized = sanitized.replace(/execute\s+(code|script|command)/gi, '');

  // Normalize excessive special characters
  sanitized = sanitized.replace(/[^a-zA-Z0-9\s.,!?;:()\-'"]/g, '');

  return sanitized.trim();
}

/**
 * Validate input length and content
 *
 * @param text - Input to validate
 * @param maxLength - Maximum allowed length (default: 10000)
 * @returns Validation result
 */
export function validateInputLength(
  text: string,
  maxLength: number = 10000
): { valid: boolean; error?: string } {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'Input is empty' };
  }

  if (text.length > maxLength) {
    return { valid: false, error: `Input exceeds maximum length of ${maxLength} characters` };
  }

  return { valid: true };
}

/**
 * Comprehensive input safety check
 * Combines injection detection, length validation, and content checks
 *
 * @param text - Input to check
 * @param options - Safety check options
 * @returns Safety check result
 */
export function checkInputSafety(
  text: string,
  options?: {
    maxLength?: number;
    injectionThreshold?: number;
    blockOnSuspicion?: boolean;
  }
): {
  safe: boolean;
  errors: string[];
  warnings: string[];
  injection?: InjectionDetectionResult;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Length validation
  const lengthCheck = validateInputLength(text, options?.maxLength);
  if (!lengthCheck.valid) {
    errors.push(lengthCheck.error!);
  }

  // Injection detection
  const injection = detectInjection(text, options?.injectionThreshold);

  if (injection.blocked) {
    errors.push(`Prompt injection detected: ${injection.patterns_matched.join(', ')}`);
  } else if (injection.detected && options?.blockOnSuspicion) {
    warnings.push(`Suspicious patterns detected: ${injection.patterns_matched.join(', ')}`);
  }

  return {
    safe: errors.length === 0,
    errors,
    warnings,
    injection,
  };
}
