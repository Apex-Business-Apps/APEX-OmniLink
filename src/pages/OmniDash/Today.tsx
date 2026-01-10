import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Clock, Play, Pause, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { fetchTodayItems, restartRitual, upsertTodayItem, updateSettings } from '@/omnidash/api';
import { useOmniDashSettings } from '@/omnidash/hooks';
import { redactTodayItems } from '@/omnidash/redaction';
import { TodayItem } from '@/omnidash/types';
import { useToast } from '@/components/ui/use-toast';

export const Today = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const settings = useOmniDashSettings();
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [category, setCategory] = useState<'outcome' | 'outreach' | 'metric'>('outcome');

  const itemsQuery = useQuery({
    queryKey: ['omnidash-today', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) throw new Error('User required');
      const data = await fetchTodayItems(user.id);
      return settings.data?.demo_mode ? redactTodayItems(data) : data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User missing');
      if (!newTitle.trim()) throw new Error('Title required');
      const payload: Partial<TodayItem> & { user_id: string; title: string } = {
        user_id: user.id,
        title: newTitle.trim(),
        category,
        order_index: (itemsQuery.data?.length || 0) + 1,
      };
      await upsertTodayItem(payload);
    },
    onSuccess: () => {
      setNewTitle('');
      queryClient.invalidateQueries({ queryKey: ['omnidash-today', user?.id] });
    },
  });

  const restartMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User missing');
      await restartRitual(user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['omnidash-today', user?.id] });
    },
  });

  const powerBlockActive = !!settings.data?.power_block_started_at;
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!powerBlockActive || !settings.data) {
      setRemaining(null);
      return;
    }
    const start = new Date(settings.data.power_block_started_at as string).getTime();
    const durationMs = (settings.data.power_block_duration_minutes ?? 90) * 60 * 1000;
    const tick = () => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, durationMs - elapsed);
      setRemaining(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [powerBlockActive, settings.data]);

  const startPowerBlock = async () => {
    if (!user) return;
    await updateSettings(user.id, { power_block_started_at: new Date().toISOString() });
    await settings.refetch();
  };

  const stopPowerBlock = async () => {
    if (!user) return;
    await updateSettings(user.id, { power_block_started_at: null });
    await settings.refetch();
  };

  const formattedRemaining = useMemo(() => {
    if (remaining === null) return '90:00';
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [remaining]);

  const handleNextAction = async (item: TodayItem) => {
    if (!user) return;
    await upsertTodayItem({
      ...item,
      user_id: user.id,
      next_action: `Next action triggered at ${new Date().toLocaleTimeString()}`,
    });
    queryClient.invalidateQueries({ queryKey: ['omnidash-today', user.id] });
    toast({ title: 'Next action captured', description: item.title });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Top 3 Outcomes</CardTitle>
          <CardDescription>Today’s focus with a single next action each.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {itemsQuery.data?.map((item) => (
              <div key={item.id} className="border rounded-lg p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{item.category}</Badge>
                    <span className="font-semibold">{item.title}</span>
                  </div>
                  <Button size="sm" onClick={() => handleNextAction(item)}>Next Action</Button>
                </div>
                {item.next_action && (
                  <p className="text-sm text-muted-foreground">{item.next_action}</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col md:flex-row gap-2">
            <Input
              placeholder="Add outcome/outreach/metric"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Select value={category} onValueChange={(v) => setCategory(v as unknown)}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="outcome">Outcome</SelectItem>
                <SelectItem value="outreach">Outreach</SelectItem>
                <SelectItem value="metric">Metric</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending} className="w-full md:w-auto">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
            <Button
              variant="outline"
              onClick={() => restartMutation.mutate()}
              disabled={restartMutation.isPending}
              className="w-full md:w-auto"
            >
              <RefreshCcw className="h-4 w-4 mr-1" /> Restart Ritual
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Power Block</CardTitle>
          <CardDescription>90-minute focus block with start/stop controls.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-primary" />
            <div>
              <p className="text-3xl font-bold">{formattedRemaining}</p>
              <p className="text-sm text-muted-foreground">
                {powerBlockActive ? 'Power block running' : 'Not started'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={startPowerBlock} disabled={powerBlockActive}>
              <Play className="h-4 w-4 mr-1" /> Start
            </Button>
            <Button variant="outline" onClick={stopPowerBlock} disabled={!powerBlockActive}>
              <Pause className="h-4 w-4 mr-1" /> Stop
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Today;

