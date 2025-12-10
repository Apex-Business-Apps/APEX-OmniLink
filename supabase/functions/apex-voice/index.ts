import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { RateLimiter, RATE_LIMITS } from '../_shared/rate-limit.ts';

// Initialize rate limiter for voice endpoints (10 req/min)
const rateLimiter = new RateLimiter(RATE_LIMITS.AI_VOICE);

const APEX_SYSTEM_PROMPT = `You are APEX, an AI assistant with deep knowledge about APEX internal operations.

Your role is to:
- Answer questions about internal APEX knowledge, systems, and processes
- Help locate information in GitHub repositories
- Find and reference Canva assets
- Provide clear, structured guidance

Source Priority:
1. Internal documentation (Notion, Confluence, etc.)
2. GitHub repositories and code
3. Canva design assets
4. General knowledge (only when specific sources unavailable)

Keep responses conversational, clear, and helpful.`;

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  console.log("APEX Voice: WebSocket connection initiated");

  // Get user ID for rate limiting before upgrading to WebSocket
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = headers.get('authorization');

  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'Invalid authentication' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Rate limiting check (10 requests per minute for voice)
  const rateCheck = rateLimiter.check(userId);

  if (!rateCheck.allowed) {
    console.warn(`APEX Voice: Rate limit exceeded for user ${userId}`);
    const retryAfter = Math.ceil((rateCheck.resetAt - Date.now()) / 1000);
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded for Voice AI. Please wait before starting a new session.',
        retryAfter
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': RATE_LIMITS.AI_VOICE.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(rateCheck.resetAt).toISOString(),
        }
      }
    );
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not configured");
    socket.close(1008, "API key not configured");
    return response;
  }

  console.log(`APEX Voice: WebSocket upgraded for user ${userId} (${rateCheck.remaining} requests remaining)`)

  let openAISocket: WebSocket | null = null;
  let sessionConfigured = false;

  socket.onopen = () => {
    console.log("APEX Voice: Client WebSocket opened");
    
    // Connect to OpenAI Realtime API
    const openAIUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;
    openAISocket = new WebSocket(openAIUrl, {
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    });

    openAISocket.onopen = () => {
      console.log("APEX Voice: Connected to OpenAI Realtime API");
    };

    openAISocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("APEX Voice: Received event type:", data.type);

        // Configure session after receiving session.created
        if (data.type === "session.created" && !sessionConfigured) {
          console.log("APEX Voice: Configuring session");
          sessionConfigured = true;
          
          const sessionConfig = {
            type: "session.update",
            session: {
              modalities: ["text", "audio"],
              instructions: APEX_SYSTEM_PROMPT,
              voice: "alloy",
              input_audio_format: "pcm16",
              output_audio_format: "pcm16",
              input_audio_transcription: {
                model: "whisper-1"
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 1000
              },
              temperature: 0.8,
              max_response_output_tokens: "inf"
            }
          };
          
          openAISocket?.send(JSON.stringify(sessionConfig));
          console.log("APEX Voice: Session configuration sent");
        }

        // Forward all events to client
        socket.send(event.data);
      } catch (error) {
        console.error("APEX Voice: Error processing OpenAI message:", error);
      }
    };

    openAISocket.onerror = (error) => {
      console.error("APEX Voice: OpenAI WebSocket error:", error);
      socket.send(JSON.stringify({ 
        type: "error", 
        error: "OpenAI connection error" 
      }));
    };

    openAISocket.onclose = () => {
      console.log("APEX Voice: OpenAI WebSocket closed");
      socket.close();
    };
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("APEX Voice: Client event type:", data.type);
      
      // Forward client messages to OpenAI
      if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.send(event.data);
      } else {
        console.error("APEX Voice: OpenAI socket not ready");
      }
    } catch (error) {
      console.error("APEX Voice: Error processing client message:", error);
    }
  };

  socket.onclose = () => {
    console.log("APEX Voice: Client WebSocket closed");
    openAISocket?.close();
  };

  socket.onerror = (error) => {
    console.error("APEX Voice: Client WebSocket error:", error);
    openAISocket?.close();
  };

  return response;
});
