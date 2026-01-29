export type OmniPortChannel = 'voice' | 'text' | 'api';

export type OmniPortVoiceInput = {
  channel: 'voice';
  transcript: string;
  language?: string;
  userId?: string;
  intentType?: string;
  requiresApproval?: boolean;
  notify?: boolean;
  traceId?: string;
};

export type OmniPortTextInput = {
  channel: 'text';
  message: string;
  locale?: string;
  userId?: string;
  intentType?: string;
  requiresApproval?: boolean;
  notify?: boolean;
  traceId?: string;
};

export type OmniPortApiInput = {
  channel: 'api';
  payload: Record<string, unknown>;
  userId?: string;
  intentType?: string;
  requiresApproval?: boolean;
  notify?: boolean;
  traceId?: string;
};

export type OmniPortInput = OmniPortVoiceInput | OmniPortTextInput | OmniPortApiInput;

export interface CanonicalOmniPortIntent {
  channel: OmniPortChannel;
  type: string;
  payload: Record<string, unknown>;
  traceId: string;
  createdAt: string;
  userId?: string;
  requiresApproval: boolean;
  notify: boolean;
  raw: OmniPortInput;
}

function sanitizeText(text: string): string {
  return text.trim().replaceAll(/\s+/g, ' ');
}

function safeTraceId(preferred?: string): string {
  if (preferred) return preferred;
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback if randomUUID is not available but crypto is (unlikely in modern Deno/Browsers)
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  // This path should theoretically never be reached in Supabase Deno runtime
  throw new Error('Cryptographically secure random number generator not available');
}

/**
 * Normalize heterogeneous OmniPort inputs (voice/text/API) into a canonical envelope
 * that downstream orchestrators and dashboards can rely on.
 */
export function normalizeOmniPortIntent(input: OmniPortInput): CanonicalOmniPortIntent {
  const traceId = safeTraceId(input.traceId);
  const createdAt = new Date().toISOString();
  const requiresApproval = Boolean(input.requiresApproval);
  const notify = Boolean(input.notify);

  if (input.channel === 'voice') {
    const normalized = sanitizeText(input.transcript);
    return {
      channel: 'voice',
      type: input.intentType ?? 'voice.intent',
      payload: {
        message: normalized,
        modality: 'voice',
        language: input.language ?? 'en',
      },
      traceId,
      createdAt,
      userId: input.userId,
      requiresApproval,
      notify,
      raw: input,
    };
  }

  if (input.channel === 'text') {
    const normalized = sanitizeText(input.message);
    return {
      channel: 'text',
      type: input.intentType ?? 'text.intent',
      payload: {
        message: normalized,
        modality: 'text',
        locale: input.locale ?? 'en',
      },
      traceId,
      createdAt,
      userId: input.userId,
      requiresApproval,
      notify,
      raw: input,
    };
  }

  const payloadType =
    (input.payload.type as string | undefined) ??
    (input.intentType ?? 'api.intent');

  return {
    channel: 'api',
    type: payloadType,
    payload: { ...input.payload },
    traceId,
    createdAt,
    userId: input.userId,
    requiresApproval,
    notify,
    raw: input,
  };
}
