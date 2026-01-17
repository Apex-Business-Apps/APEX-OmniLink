import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchKpiDaily, upsertKpiDailyEntry } from '@/omnidash/api';
import { useOmniDashSettings } from '@/omnidash/hooks';
import { redactKpiDaily, redactAmount } from '@/omnidash/redaction';

const today = () => new Date().toISOString().slice(0, 10);

export const Kpis = () => {
  const { user } = useAuth();
  const settings = useOmniDashSettings();
  const queryClient = useQueryClient();

  const kpiQuery = useQuery({
    queryKey: ['omnidash-kpis', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) throw new Error('User required');
      const data = await fetchKpiDaily(user.id, 14);
      return settings.data?.demo_mode && settings.data.anonymize_kpis ? redactKpiDaily(data) : data;
    },
  });

  const todayRow = useMemo(
    () => kpiQuery.data?.find((row) => row.day === today()),
    [kpiQuery.data]
  );

  const [form, setForm] = useState({
    tradeline_paid_starts: todayRow?.tradeline_paid_starts ?? 0,
    tradeline_active_pilots: todayRow?.tradeline_active_pilots ?? 0,
    tradeline_churn_risks: todayRow?.tradeline_churn_risks ?? 0,
    flowbills_demos: todayRow?.flowbills_demos ?? 0,
    flowbills_paid_accounts: todayRow?.flowbills_paid_accounts ?? 0,
    cash_days_to_cash: todayRow?.cash_days_to_cash ?? 0,
    ops_sev1_incidents: todayRow?.ops_sev1_incidents ?? 0,
  });

  useEffect(() => {
    if (todayRow) {
      setForm({
        tradeline_paid_starts: todayRow.tradeline_paid_starts,
        tradeline_active_pilots: todayRow.tradeline_active_pilots,
        tradeline_churn_risks: todayRow.tradeline_churn_risks,
        flowbills_demos: todayRow.flowbills_demos,
        flowbills_paid_accounts: todayRow.flowbills_paid_accounts,
        cash_days_to_cash: todayRow.cash_days_to_cash ?? 0,
        ops_sev1_incidents: todayRow.ops_sev1_incidents,
      });
    }
  }, [todayRow]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User missing');
      await upsertKpiDailyEntry({
        user_id: user.id,
        day: today(),
        ...form,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['omnidash-kpis', user?.id] });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Update today</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          {Object.entries(form).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <p className="text-sm font-medium capitalize">{key.replaceAll('_', ' ')}</p>
              <Input
                type="number"
                value={value ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
              />
            </div>
          ))}
          <div className="md:col-span-3">
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>Save KPI for today</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily KPIs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>TradeLine paid starts</TableHead>
                <TableHead>Active pilots</TableHead>
                <TableHead>Churn risks</TableHead>
                <TableHead>FLOWBills demos</TableHead>
                <TableHead>FLOWBills paid</TableHead>
                <TableHead>Days to cash</TableHead>
                <TableHead>Ops Sev-1</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(kpiQuery.data || []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.day}</TableCell>
                  <TableCell>{row.tradeline_paid_starts}</TableCell>
                  <TableCell>{row.tradeline_active_pilots}</TableCell>
                  <TableCell>{row.tradeline_churn_risks}</TableCell>
                  <TableCell>{row.flowbills_demos}</TableCell>
                  <TableCell>{row.flowbills_paid_accounts}</TableCell>
                  <TableCell>
                    {settings.data?.demo_mode && settings.data.anonymize_kpis
                      ? redactAmount(row.cash_days_to_cash) || '—'
                      : row.cash_days_to_cash ?? '—'}
                  </TableCell>
                  <TableCell>{row.ops_sev1_incidents}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Kpis;

