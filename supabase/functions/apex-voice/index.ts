import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not configured");
    socket.close(1008, "API key not configured");
    return response;
  }

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
