export interface VoiceSafetyResult {
  safe: boolean;
  violations: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

const MULTILANG_INJECTION_PATTERNS = [
  // English
  /ignore\s+(all\s+)?previous\s+(instructions?|rules?|prompts?)/i,
  /system\s+(override|message|reset)/i,
  /you\s+are\s+now\s+(unfiltered|developer|admin)/i,
  // Spanish
  /ignora\s+(todas\s+las\s+)?instrucciones\s+anteriores/i,
  /sistema\s+(anular|reemplazar)/i,
  /modo\s+(desarrollador|administrador)/i,
  // French
  /ignorez?\s+(toutes\s+les\s+)?instructions\s+pr[eé]c[eé]dentes/i,
  /mode\s+d[eé]veloppeur/i,
  // German
  /ignoriere\s+alle\s+vorherigen\s+anweisungen/i,
  // Portuguese
  /ignore\s+todas\s+as\s+instruções\s+anteriores/i,
  // Chinese & Russian
  /忽略(所有|之前的)指令/,
  /系统(覆盖|重置)/,
  /игнорируй\s+все\s+предыдущие\s+инструкции/i,
];

const PHONETIC_JAILBREAKS = [
  /hyphen\s+hyphen\s+begin/i,
  /slash\s+slash\s+system/i,
  /new\s+line\s+command/i,
];

const SENSITIVE_DATA_PATTERNS = [
  /sk-[a-z0-9]{20,}/i,             // OpenAI Keys
  /(password|contraseña)\s*[:=]/i, // Credentials
];

export function evaluateVoiceInputSafety(transcript: string): VoiceSafetyResult {
  const violations: string[] = [];
  let riskScore = 0;

  for (const pattern of MULTILANG_INJECTION_PATTERNS) {
    if (pattern.test(transcript)) {
      violations.push(`injection:${pattern.source}`);
      riskScore += 10;
    }
  }

  for (const pattern of PHONETIC_JAILBREAKS) {
    if (pattern.test(transcript)) {
      violations.push(`phonetic_risk:${pattern.source}`);
      riskScore += 5;
    }
  }

  for (const pattern of SENSITIVE_DATA_PATTERNS) {
    if (pattern.test(transcript)) {
      violations.push(`pii_leak:${pattern.source}`);
      riskScore += 20;
    }
  }

  let riskLevel: VoiceSafetyResult['riskLevel'] = 'low';
  if (riskScore >= 20) riskLevel = 'critical';
  else if (riskScore >= 10) riskLevel = 'high';
  else if (riskScore >= 5) riskLevel = 'medium';

  return { safe: riskScore === 0, violations, riskLevel };
}
