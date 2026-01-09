import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Mic, Zap, ShieldAlert, LucideIcon } from 'lucide-react';
import { Header } from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';

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

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
}

const StatCard = ({
  title,
  value,
  icon: Icon,
  color = "text-muted-foreground"
}: StatCardProps): JSX.Element => (
  <Card>
    <CardHeader className="flex flex-row justify-between pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className={`h-4 w-4 ${color}`} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

export default function VoiceHealth(): JSX.Element {
  const [metrics, setMetrics] = useState<VoiceMetrics>({
    handshakeAvg: 0,
    latencyP99: 0,
    activeSessions: 0,
    safetyViolations: 0
  });
  const [logs, setLogs] = useState<VoiceLog[]>([]);

  useEffect(() => {
    const fetchHealth = async (): Promise<void> => {
      const { data } = await supabase.functions.invoke<VoiceHealthResponse>(
        'ops-voice-health'
      );
      if (data) {
        setMetrics(data.metrics);
        setLogs(data.logs);
      }
    };
    fetchHealth();
    const timer = setInterval(fetchHealth, 5000);
    return (): void => {
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="pt-20 px-4 max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Mic className="text-primary" /> Voice Health
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Avg Handshake"
            value={`${metrics.handshakeAvg}ms`}
            icon={Activity}
          />
          <StatCard
            title="Latency P99"
            value={`${metrics.latencyP99}ms`}
            icon={Zap}
            color="text-yellow-500"
          />
          <StatCard
            title="Active Calls"
            value={metrics.activeSessions}
            icon={Mic}
            color="text-green-500"
          />
          <StatCard
            title="Safety Blocks"
            value={metrics.safetyViolations}
            icon={ShieldAlert}
            color="text-red-500"
          />
        </div>

        <Card className="bg-black/95 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Live Telemetry</CardTitle>
          </CardHeader>
          <CardContent className="h-64 overflow-y-auto font-mono text-xs text-green-400">
            {logs.map((l, i) => (
              <div key={i} className="border-b border-green-900/30 py-1">
                <span className="text-gray-500">
                  [{new Date(l.timestamp).toLocaleTimeString()}]
                </span>{' '}
                {l.msg}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
