// Re-defined for Edge environment to avoid direct dependency on src/
export type SOmniPortChannel = 'voice' | 'text' | 'api';

interface BaseInput {
  userId?: string;
  intentType?: string;
  requiresApproval?: boolean;
  notify?: boolean;
  traceId?: string;
}

export interface SOmniPortVoiceInput extends BaseInput {
  channel: 'voice';
  transcript: string;
  language?: string;
}

export interface SOmniPortTextInput extends BaseInput {
  channel: 'text';
  message: string;
  locale?: string;
}

export interface SOmniPortApiInput extends BaseInput {
  channel: 'api';
  payload: Record<string, unknown>;
}

export type SOmniPortInput = SOmniPortVoiceInput | SOmniPortTextInput | SOmniPortApiInput;

export interface CanonicalOmniPortIntent {
  channel: SOmniPortChannel;
  type: string;
  payload: Record<string, unknown>;
  traceId: string;
  createdAt: string;
  userId?: string;
  requiresApproval: boolean;
  notify: boolean;
  raw: SOmniPortInput;
}

const cleanText = (str: string): string => str.trim().replaceAll(/\s+/g, ' ');

function generateTraceId(existing?: string): string {
  if (existing) return existing;
  
  // Deno/Edge environment usually has crypto
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  
  // Fallback for unlikely environments
  const buf = new Uint8Array(16);
  globalThis.crypto.getRandomValues(buf);
  return [...buf].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Normalize heterogeneous OmniPort inputs (voice/text/API) into a canonical envelope.
 * Edge-optimized implementation.
 */
export function normalizeOmniPortIntent(input: SOmniPortInput): CanonicalOmniPortIntent {
  const traceId = generateTraceId(input.traceId);
  const now = new Date().toISOString();
  
  const meta = {
    requiresApproval: !!input.requiresApproval,
    notify: !!input.notify,
    userId: input.userId,
    createdAt: now,
    traceId
  };

  switch (input.channel) {
    case 'voice':
      return {
        channel: 'voice',
        type: input.intentType ?? 'voice.intent',
        payload: {
          message: cleanText(input.transcript),
          modality: 'voice',
          language: input.language ?? 'en',
        },
        raw: input,
        ...meta
      };

    case 'text':
      return {
        channel: 'text',
        type: input.intentType ?? 'text.intent',
        payload: {
          message: cleanText(input.message),
          modality: 'text',
          locale: input.locale ?? 'en',
        },
        raw: input,
        ...meta
      };

    case 'api':
    default: {
      const apiInput = input as SOmniPortApiInput;
      return {
        channel: 'api',
        type: (apiInput.payload?.type as string) ?? (apiInput.intentType ?? 'api.intent'),
        payload: { ...apiInput.payload },
        raw: input,
        ...meta
      };
    }
  }
}
