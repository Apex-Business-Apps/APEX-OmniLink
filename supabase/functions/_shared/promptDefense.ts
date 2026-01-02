export interface PromptDefenseResult {
  safe: boolean;
  violations: string[];
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+(instructions?|rules?|prompts?)/i,
  /system\s+(override|message|prompt)/i,
  /admin\s+(mode|override|access)/i,
  /developer\s+mode/i,
  /bypass\s+(security|filter|rules?)/i,
  /jailbreak/i,
];

const SECRET_PATTERNS = [
  /sk-[a-z0-9]{20,}/i,
  /AKIA[0-9A-Z]{16}/,
  /password\s*[:=]/i,
  /api[_-]?key\s*[:=]/i,
  /secret\s*[:=]/i,
  /-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/,
];

export function evaluatePromptSafety(content: string): PromptDefenseResult {
  const violations: string[] = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(content)) {
      violations.push(`injection:${pattern.source}`);
    }
  }
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      violations.push(`secret:${pattern.source}`);
    }
  }
  return {
    safe: violations.length === 0,
    violations,
  };
}

export function validateLLMOutput(content: string): PromptDefenseResult {
  const violations: string[] = [];
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      violations.push(`secret:${pattern.source}`);
    }
  }
  return {
    safe: violations.length === 0,
    violations,
  };
}
