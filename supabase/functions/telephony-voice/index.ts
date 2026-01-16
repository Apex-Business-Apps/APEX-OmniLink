/**
 * APEX TradeLine247 Telephony Voice Gateway
 *
 * This Supabase Edge Function serves as the TwiML gateway for incoming calls.
 * It provides:
 * 1. Neural greeting using Amazon Polly for instant response
 * 2. WebSocket handoff to the AI voice server
 * 3. Caller metadata embedding for context
 *
 * Architecture: Twilio -> This Function -> TwiML -> Railway WebSocket
 */

import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";

// Configuration - Override via environment variables
const VOICE_SERVER_URL = Deno.env.get('VOICE_SERVER_URL') || 'wss://tradeline-voice-server.railway.app/media-stream';
const NEURAL_VOICE = Deno.env.get('NEURAL_VOICE') || 'Polly.Joanna-Neural';
const COMPANY_NAME = Deno.env.get('COMPANY_NAME') || 'TradeLine 24/7';
const GREETING_MESSAGE = Deno.env.get('GREETING_MESSAGE') ||
  `Welcome to ${COMPANY_NAME}. Our AI assistant will be with you in just a moment. How can we help you today?`;

// Twilio signature validation
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

interface TwilioWebhookParams {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: string;
  Direction: string;
  CallerCity?: string;
  CallerState?: string;
  CallerCountry?: string;
}

/**
 * Validate Twilio webhook signature
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
async function validateTwilioSignature(
  request: Request,
  body: string
): Promise<boolean> {
  if (!TWILIO_AUTH_TOKEN) {
    console.warn('[telephony-voice] TWILIO_AUTH_TOKEN not set - skipping signature validation');
    return true; // Allow in development
  }

  const signature = request.headers.get('X-Twilio-Signature');
  if (!signature) {
    console.error('[telephony-voice] Missing X-Twilio-Signature header');
    return false;
  }

  const url = request.url;
  const params = new URLSearchParams(body);

  // Sort parameters and create validation string
  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}${value}`)
    .join('');

  const data = url + sortedParams;

  // Create HMAC-SHA1 signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(TWILIO_AUTH_TOKEN),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  return signature === computedSignature;
}

/**
 * Generate TwiML response with neural greeting and WebSocket connection
 */
function generateTwiML(params: TwilioWebhookParams): string {
  const { CallSid, From, CallerCity, CallerState } = params;

  // Build caller context for the AI
  const callerContext = JSON.stringify({
    callSid: CallSid,
    callerPhone: From,
    callerLocation: [CallerCity, CallerState].filter(Boolean).join(', ') || 'Unknown',
    timestamp: new Date().toISOString()
  });

  // Encode context for URL parameter
  const encodedContext = encodeURIComponent(callerContext);

  // Build WebSocket URL with context
  const wsUrl = `${VOICE_SERVER_URL}?context=${encodedContext}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- Neural greeting for instant, human-like response -->
  <Say voice="${NEURAL_VOICE}">${escapeXml(GREETING_MESSAGE)}</Say>

  <!-- Connect to AI voice server via WebSocket -->
  <Connect>
    <Stream url="${escapeXml(wsUrl)}">
      <Parameter name="callSid" value="${escapeXml(CallSid)}" />
      <Parameter name="callerPhone" value="${escapeXml(From)}" />
    </Stream>
  </Connect>

  <!-- Fallback if WebSocket fails -->
  <Say voice="${NEURAL_VOICE}">
    We're experiencing technical difficulties. Please try again later or call our support line.
  </Say>
</Response>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Main request handler
 */
Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handlePreflight(req);
  }

  const corsHeaders = buildCorsHeaders(req.headers.get('origin'));
  const url = new URL(req.url);

  // Health check endpoint
  if (url.pathname.endsWith('/health') || url.pathname.endsWith('/healthz')) {
    return new Response(JSON.stringify({
      status: 'healthy',
      service: 'telephony-voice',
      timestamp: new Date().toISOString(),
      voiceServer: VOICE_SERVER_URL
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Only accept POST for Twilio webhooks
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders
    });
  }

  try {
    // Parse form data from Twilio
    const body = await req.text();

    // Validate Twilio signature in production
    const isValid = await validateTwilioSignature(req, body);
    if (!isValid) {
      console.error('[telephony-voice] Invalid Twilio signature');
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      });
    }

    // Parse webhook parameters
    const formData = new URLSearchParams(body);
    const params: TwilioWebhookParams = {
      CallSid: formData.get('CallSid') || '',
      AccountSid: formData.get('AccountSid') || '',
      From: formData.get('From') || '',
      To: formData.get('To') || '',
      CallStatus: formData.get('CallStatus') || '',
      Direction: formData.get('Direction') || '',
      CallerCity: formData.get('CallerCity') || undefined,
      CallerState: formData.get('CallerState') || undefined,
      CallerCountry: formData.get('CallerCountry') || undefined
    };

    // Log incoming call
    console.log('[telephony-voice] Incoming call:', {
      callSid: params.CallSid,
      from: params.From,
      to: params.To,
      location: `${params.CallerCity || 'Unknown'}, ${params.CallerState || 'Unknown'}`,
      timestamp: new Date().toISOString()
    });

    // Generate and return TwiML
    const twiml = generateTwiML(params);

    return new Response(twiml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml'
      }
    });

  } catch (error) {
    console.error('[telephony-voice] Error processing request:', error);

    // Return error TwiML so caller hears something
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${NEURAL_VOICE}">
    We're sorry, but we're experiencing technical difficulties. Please try your call again.
  </Say>
  <Hangup />
</Response>`;

    return new Response(errorTwiml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml'
      }
    });
  }
});
