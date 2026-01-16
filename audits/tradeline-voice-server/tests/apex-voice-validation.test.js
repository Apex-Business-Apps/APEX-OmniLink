/**
 * APEX Voice Function Validation Tests
 *
 * Tests the Supabase Edge Function implementation at apex-voice/index.ts
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const OMNIHUB_PATH = '/home/user/APEX-OmniHub';
const APEX_VOICE_PATH = join(OMNIHUB_PATH, 'supabase/functions/apex-voice/index.ts');
const VOICE_SAFETY_PATH = join(OMNIHUB_PATH, 'supabase/functions/_shared/voiceSafety.ts');

describe('APEX Voice Edge Function', () => {
  let apexVoiceCode;
  let voiceSafetyCode;

  beforeAll(() => {
    apexVoiceCode = readFileSync(APEX_VOICE_PATH, 'utf-8');
    voiceSafetyCode = readFileSync(VOICE_SAFETY_PATH, 'utf-8');
  });

  describe('WebSocket Handling', () => {
    it('Should check for WebSocket upgrade header', () => {
      expect(apexVoiceCode).toContain('upgrade');
      expect(apexVoiceCode).toContain("'websocket'");
    });

    it('Should upgrade to WebSocket using Deno', () => {
      expect(apexVoiceCode).toContain('Deno.upgradeWebSocket');
    });

    it('Should handle socket.onopen', () => {
      expect(apexVoiceCode).toContain('socket.onopen');
    });

    it('Should handle socket.onmessage', () => {
      expect(apexVoiceCode).toContain('socket.onmessage');
    });
  });

  describe('OpenAI Realtime Integration', () => {
    it('Should connect to OpenAI Realtime API', () => {
      expect(apexVoiceCode).toContain('wss://api.openai.com/v1/realtime');
    });

    it('Should use correct model (gpt-4o-realtime-preview-2024-12-17)', () => {
      expect(apexVoiceCode).toContain('gpt-4o-realtime-preview-2024-12-17');
    });

    it('Should send session.update configuration', () => {
      expect(apexVoiceCode).toContain('session.update');
    });

    it('Should use alloy voice', () => {
      expect(apexVoiceCode).toContain("voice: 'alloy'");
    });

    it('Should configure pcm16 audio format', () => {
      expect(apexVoiceCode).toContain("input_audio_format: 'pcm16'");
      expect(apexVoiceCode).toContain("output_audio_format: 'pcm16'");
    });

    it('Should enable server VAD', () => {
      expect(apexVoiceCode).toContain("type: 'server_vad'");
      expect(apexVoiceCode).toContain('threshold: 0.6');
    });
  });

  describe('System Prompt', () => {
    it('Should have APEX_SYSTEM_PROMPT constant', () => {
      expect(apexVoiceCode).toContain('APEX_SYSTEM_PROMPT');
    });

    it('Should identify as APEX AI Receptionist', () => {
      expect(apexVoiceCode).toContain('APEX');
      expect(apexVoiceCode).toContain('TradeLine247');
    });

    it('Should have conciseness constraint', () => {
      expect(apexVoiceCode).toContain('under 2 sentences');
    });
  });

  describe('Tools', () => {
    it('Should define update_context tool', () => {
      expect(apexVoiceCode).toContain("name: 'update_context'");
    });

    it('Should handle function_call_arguments.done event', () => {
      expect(apexVoiceCode).toContain('response.function_call_arguments.done');
    });

    it('MISSING: Should define check_availability tool', () => {
      const hasAvailability = apexVoiceCode.includes('check_availability');
      expect(hasAvailability).toBe(false); // Proves it's missing
    });

    it('MISSING: Should define book_appointment tool', () => {
      const hasBooking = apexVoiceCode.includes('book_appointment');
      expect(hasBooking).toBe(false); // Proves it's missing
    });

    it('MISSING: Should define transfer_call tool', () => {
      const hasTransfer = apexVoiceCode.includes('transfer_call');
      expect(hasTransfer).toBe(false); // Proves it's missing
    });
  });

  describe('Metrics & Observability', () => {
    it('Should track session metrics', () => {
      expect(apexVoiceCode).toContain('SessionMetrics');
      expect(apexVoiceCode).toContain('handshake_ms');
    });

    it('Should calculate handshake latency', () => {
      expect(apexVoiceCode).toContain('metrics.openai_connect - metrics.start');
    });

    it('Should track turn latency', () => {
      expect(apexVoiceCode).toContain('turn_latency');
      expect(apexVoiceCode).toContain('last_speech_stop');
    });

    it('Should log metrics as JSON', () => {
      expect(apexVoiceCode).toContain('JSON.stringify');
      expect(apexVoiceCode).toContain('"type": "metric"');
    });
  });

  describe('Security Integration', () => {
    it('Should import evaluateVoiceInputSafety', () => {
      expect(apexVoiceCode).toContain('evaluateVoiceInputSafety');
    });

    it('Should check safety on user messages', () => {
      expect(apexVoiceCode).toContain('evaluateVoiceInputSafety(text)');
    });

    it('Should log safety violations', () => {
      expect(apexVoiceCode).toContain('Safety Violation detected');
    });
  });

  describe('Session State Management', () => {
    it('Should maintain sessionState object', () => {
      expect(apexVoiceCode).toContain('sessionState');
    });

    it('Should update context when tool is called', () => {
      expect(apexVoiceCode).toContain("data.name === 'update_context'");
      expect(apexVoiceCode).toContain('sessionState = { ...sessionState, ...args }');
    });

    it('Should update instructions with context', () => {
      expect(apexVoiceCode).toContain('CONTEXT: ${JSON.stringify(sessionState)}');
    });
  });
});

describe('Voice Safety Module', () => {
  let voiceSafetyCode;

  beforeAll(() => {
    voiceSafetyCode = readFileSync(VOICE_SAFETY_PATH, 'utf-8');
  });

  describe('Multi-Language Injection Detection', () => {
    it('Should detect English injection patterns', () => {
      expect(voiceSafetyCode).toContain('ignore\\s+(all\\s+)?previous');
      expect(voiceSafetyCode).toContain('system\\s+(override|message|reset)');
    });

    it('Should detect Spanish injection patterns', () => {
      expect(voiceSafetyCode).toContain('ignora');
      expect(voiceSafetyCode).toContain('instrucciones\\s+anteriores');
    });

    it('Should detect French injection patterns', () => {
      expect(voiceSafetyCode).toContain('ignorez');
      expect(voiceSafetyCode).toContain('instructions\\s+pr');
    });

    it('Should detect German injection patterns', () => {
      expect(voiceSafetyCode).toContain('ignoriere');
      expect(voiceSafetyCode).toContain('vorherigen\\s+anweisungen');
    });

    it('Should detect Chinese injection patterns', () => {
      expect(voiceSafetyCode).toContain('忽略');
      expect(voiceSafetyCode).toContain('指令');
    });

    it('Should detect Russian injection patterns', () => {
      expect(voiceSafetyCode).toContain('игнорируй');
    });
  });

  describe('Phonetic Jailbreak Detection', () => {
    it('Should detect hyphen-based attacks', () => {
      expect(voiceSafetyCode).toContain('hyphen\\s+hyphen\\s+begin');
    });

    it('Should detect slash-based attacks', () => {
      expect(voiceSafetyCode).toContain('slash\\s+slash\\s+system');
    });

    it('Should detect newline attacks', () => {
      expect(voiceSafetyCode).toContain('new\\s+line\\s+command');
    });
  });

  describe('Sensitive Data Detection', () => {
    it('Should detect OpenAI API keys', () => {
      expect(voiceSafetyCode).toContain('sk-[a-z0-9]{20,}');
    });

    it('Should detect password disclosure', () => {
      expect(voiceSafetyCode).toContain('password|contraseña');
    });
  });

  describe('Risk Scoring', () => {
    it('Should calculate risk levels', () => {
      expect(voiceSafetyCode).toContain("riskLevel: 'low'");
      expect(voiceSafetyCode).toContain("'medium'");
      expect(voiceSafetyCode).toContain("'high'");
      expect(voiceSafetyCode).toContain("'critical'");
    });

    it('Should return VoiceSafetyResult interface', () => {
      expect(voiceSafetyCode).toContain('export interface VoiceSafetyResult');
      expect(voiceSafetyCode).toContain('safe: boolean');
      expect(voiceSafetyCode).toContain('violations: string[]');
    });
  });
});

describe('Architecture Gaps', () => {
  it('CONFIRMS: telephony-voice TwiML function does NOT exist', () => {
    const telephonyPath = join(OMNIHUB_PATH, 'supabase/functions/telephony-voice/index.ts');
    expect(existsSync(telephonyPath)).toBe(false);
  });

  it('CONFIRMS: No TwiML generation in apex-voice', () => {
    const apexVoiceCode = readFileSync(APEX_VOICE_PATH, 'utf-8');
    expect(apexVoiceCode).not.toContain('<Say>');
    expect(apexVoiceCode).not.toContain('<Connect>');
    expect(apexVoiceCode).not.toContain('TwiML');
  });

  it('CONFIRMS: apex-voice does NOT integrate with SkillRegistry', () => {
    const apexVoiceCode = readFileSync(APEX_VOICE_PATH, 'utf-8');
    expect(apexVoiceCode).not.toContain('SkillRegistry');
    expect(apexVoiceCode).not.toContain('skill-loader');
  });

  it('CONFIRMS: Two separate voice implementations exist', () => {
    // tradeline247-railway
    const tradelinePath = '/home/user/tradeline247-railway-audit/tradeline-voice-server/server.mjs';
    expect(existsSync(tradelinePath)).toBe(true);

    // apex-voice
    expect(existsSync(APEX_VOICE_PATH)).toBe(true);
  });
});
