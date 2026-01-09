interface VoiceMetrics {
  handshakeAvg: number;
  latencyP99: number;
  activeSessions: number;
  safetyViolations: number;
}

interface VoiceLog {
  type: string;
  msg: string;
  timestamp: string;
}

interface VoiceHealthResponse {
  metrics: VoiceMetrics;
  logs: VoiceLog[];
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve((req: Request): Response => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const data: VoiceHealthResponse = {
    metrics: {
      handshakeAvg: 212,
      latencyP99: 780,
      activeSessions: 3,
      safetyViolations: 0
    },
    logs: [
      {
        type: 'info',
        msg: 'System initialized',
        timestamp: new Date().toISOString()
      },
      {
        type: 'metric',
        msg: 'Handshake: 212ms',
        timestamp: new Date().toISOString()
      }
    ]
  };

  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
