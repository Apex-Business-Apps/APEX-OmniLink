import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { fetchPipelineItems, upsertPipelineItem } from '@/omnidash/api';
import { redactPipelineDisplay, redactNotes, redactAmount } from '@/omnidash/redaction';
import { OMNIDASH_PIPELINE_STAGES, PipelineItem } from '@/omnidash/types';
import { useOmniDashSettings } from '@/omnidash/hooks';
import { format } from 'date-fns';
import { AlertTriangle } from 'lucide-react';

const initialForm = {
  account_name: '',
  product: '',
  owner: '',
  stage: 'lead',
  last_touch_at: '',
  next_touch_at: '',
  expected_mrr: '',
  probability: '',
  notes: '',
};

export const Pipeline = () => {
  const { user } = useAuth();
  const settings = useOmniDashSettings();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);

  const pipelineQuery = useQuery({
    queryKey: ['omnidash-pipeline', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) throw new Error('User required');
      const data = await fetchPipelineItems(user.id);
      return settings.data?.demo_mode ? redactPipelineDisplay(data) : data;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User required');
      setError(null);
      const payload: Partial<PipelineItem> & { user_id: string; account_name: string; product: string; owner: string; stage: PipelineItem['stage'] } = {
        user_id: user.id,
        account_name: form.account_name.trim(),
        product: form.product.trim(),
        owner: form.owner.trim(),
        stage: form.stage as PipelineItem['stage'],
        last_touch_at: form.last_touch_at || null,
        next_touch_at: form.stage === 'lost' ? null : form.next_touch_at,
        expected_mrr: form.expected_mrr ? Number(form.expected_mrr) : null,
        probability: form.probability ? Number(form.probability) : null,
        notes: form.notes ? redactNotes(form.notes) : null,
      };

      if (payload.stage !== 'lost' && !payload.next_touch_at) {
        setError('Next touch date is required unless stage is Lost.');
        throw new Error('Next touch required');
      }

      await upsertPipelineItem(payload);
    },
    onSuccess: () => {
      setForm(initialForm);
      queryClient.invalidateQueries({ queryKey: ['omnidash-pipeline', user?.id] });
    },
    onError: (err: unknown) => {
      setError(err?.message || 'Failed to save');
    },
  });

  const grouped = useMemo(() => {
    const data = pipelineQuery.data || [];
    const map: Record<string, PipelineItem[]> = {};
    OMNIDASH_PIPELINE_STAGES.forEach(({ id }) => {
      map[id] = [];
    });
    data.forEach((item) => {
      map[item.stage] = map[item.stage] || [];
      map[item.stage].push(item as PipelineItem);
    });
    return map;
  }, [pipelineQuery.data]);

  const nextTouchDue = useMemo(() => {
    const today = new Date();
    return (pipelineQuery.data || [])
      .filter((item) => item.next_touch_at && new Date(item.next_touch_at) <= today && item.stage !== 'lost')
      .sort((a, b) => new Date(a.next_touch_at || '').getTime() - new Date(b.next_touch_at || '').getTime());
  }, [pipelineQuery.data]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Add / Update Pipeline Item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Validation</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Account / Lead</Label>
              <Input value={form.account_name} onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value }))} />
            </div>
            <div>
              <Label>Product</Label>
              <Input value={form.product} onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))} />
            </div>
            <div>
              <Label>Owner</Label>
              <Input value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} />
            </div>
            <div>
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={(v) => setForm((f) => ({ ...f, stage: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OMNIDASH_PIPELINE_STAGES.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Last touch</Label>
              <Input type="date" value={form.last_touch_at} onChange={(e) => setForm((f) => ({ ...f, last_touch_at: e.target.value }))} />
            </div>
            <div>
              <Label>Next touch (required unless Lost)</Label>
              <Input type="date" value={form.next_touch_at} onChange={(e) => setForm((f) => ({ ...f, next_touch_at: e.target.value }))} />
            </div>
            <div>
              <Label>Expected $/mo</Label>
              <Input type="number" value={form.expected_mrr} onChange={(e) => setForm((f) => ({ ...f, expected_mrr: e.target.value }))} />
            </div>
            <div>
              <Label>Probability %</Label>
              <Input type="number" value={form.probability} onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next Touch Due</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {nextTouchDue.length === 0 && <p className="text-sm text-muted-foreground">No items due.</p>}
          {nextTouchDue.map((item) => (
            <div key={item.id} className="border rounded-md p-3 w-full md:w-[280px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{item.account_name}</span>
                <Badge variant="outline">{format(new Date(item.next_touch_at as string), 'MMM d')}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Owner: {item.owner}</p>
              {item.notes && <p className="text-xs text-muted-foreground line-clamp-2">{item.notes}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
        {OMNIDASH_PIPELINE_STAGES.map((stage) => (
          <Card key={stage.id} className="min-h-[200px]">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>{stage.label}</span>
                <Badge variant="secondary">{grouped[stage.id]?.length || 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(grouped[stage.id] || []).map((item) => (
                <div key={item.id} className="border rounded-md p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{item.account_name}</span>
                    {item.expected_mrr !== null && (
                      <Badge variant="outline">
                        {settings.data?.demo_mode && settings.data.anonymize_kpis
                          ? (item as unknown).expected_mrr_bucket || redactAmount(item.expected_mrr) || '—'
                          : `$${item.expected_mrr}`}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Owner: {item.owner}</p>
                  {item.next_touch_at && (
                    <p className="text-xs text-muted-foreground">
                      Next touch: {format(new Date(item.next_touch_at), 'MMM d')}
                    </p>
                  )}
                  {item.notes && <p className="text-xs text-muted-foreground line-clamp-2">{item.notes}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Pipeline;

