import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/lib/monitoring';
import { recordAuditEvent } from '@/security/auditLog';
import { Incident, KpiDaily, PipelineItem, TodayItem, OmniDashSettings } from './types';

async function handleError<T>(promise: Promise<{ data: T | null; error: unknown }>, context: string): Promise<T> {
  const { data, error } = await promise;
  if (error) {
    logError(error, { action: `omnidash_${context}` });
    throw new Error(error.message || `Failed to ${context}`);
  }
  if (!data) {
    throw new Error(`No data returned for ${context}`);
  }
  return data;
}

export async function fetchSettings(userId: string): Promise<OmniDashSettings> {
  const { data, error } = await supabase
    .from('omnidash_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logError(error, { action: 'omnidash_fetch_settings' });
    throw error;
  }

  if (!data) {
    const insert = await supabase
      .from('omnidash_settings')
      .insert({
        user_id: userId,
      })
      .select('*')
      .single();
    if (insert.error) {
      logError(insert.error, { action: 'omnidash_seed_settings' });
      throw insert.error;
    }
    return insert.data;
  }

  return data;
}

export async function updateSettings(userId: string, patch: Partial<OmniDashSettings>): Promise<OmniDashSettings> {
  const result = await supabase
    .from('omnidash_settings')
    .upsert({
      user_id: userId,
      ...patch,
    })
    .select('*')
    .single();

  if (result.error) {
    logError(result.error, { action: 'omnidash_update_settings' });
    throw result.error;
  }

  recordAuditEvent({
    actorId: userId,
    actionType: 'omnidash.settings.updated',
    resourceType: 'omnidash_settings',
    resourceId: userId,
    metadata: patch,
  });

  return result.data;
}

export async function fetchTodayItems(userId: string): Promise<TodayItem[]> {
  return handleError(
    supabase
      .from('omnidash_today_items')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('order_index', { ascending: true }),
    'fetch_today_items'
  );
}

export async function upsertTodayItem(item: Partial<TodayItem> & { user_id: string; title: string }): Promise<TodayItem> {
  const result = await supabase
    .from('omnidash_today_items')
    .upsert(item)
    .select('*')
    .single();
  if (result.error) {
    logError(result.error, { action: 'omnidash_upsert_today_item' });
    throw result.error;
  }
  return result.data;
}

export async function restartRitual(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('omnidash_today_items')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    logError(error, { action: 'omnidash_restart_ritual' });
    throw error;
  }

  const categories: Array<'outcome' | 'outreach' | 'metric'> = ['outcome', 'outreach', 'metric'];
  const keepIds = categories
    .map((cat) => data?.find((row) => row.category === cat)?.id)
    .filter(Boolean) as string[];

  await supabase.from('omnidash_today_items').update({ is_active: false }).eq('user_id', userId);
  if (keepIds.length) {
    await supabase.from('omnidash_today_items').update({ is_active: true }).in('id', keepIds);
  }
}

export async function fetchPipelineItems(userId: string): Promise<PipelineItem[]> {
  return handleError(
    supabase
      .from('omnidash_pipeline_items')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
    'fetch_pipeline_items'
  );
}

export async function upsertPipelineItem(item: Partial<PipelineItem> & { user_id: string; account_name: string; product: string; owner: string; stage: PipelineItem['stage'] }): Promise<PipelineItem> {
  if (item.stage !== 'lost' && !item.next_touch_at) {
    throw new Error('Next touch is required unless stage is Lost.');
  }

  const result = await supabase
    .from('omnidash_pipeline_items')
    .upsert(item)
    .select('*')
    .single();
  if (result.error) {
    logError(result.error, { action: 'omnidash_upsert_pipeline_item' });
    throw result.error;
  }
  return result.data;
}

export async function fetchKpiDaily(userId: string, days = 7): Promise<KpiDaily[]> {
  return handleError(
    supabase
      .from('omnidash_kpi_daily')
      .select('*')
      .eq('user_id', userId)
      .order('day', { ascending: false })
      .limit(days),
    'fetch_kpi_daily'
  );
}

export async function upsertKpiDailyEntry(row: Partial<KpiDaily> & { user_id: string; day: string }): Promise<KpiDaily> {
  const result = await supabase
    .from('omnidash_kpi_daily')
    .upsert(row)
    .select('*')
    .single();
  if (result.error) {
    logError(result.error, { action: 'omnidash_upsert_kpi_daily' });
    throw result.error;
  }
  return result.data;
}

export async function fetchIncidents(userId: string, limit = 20): Promise<Incident[]> {
  return handleError(
    supabase
      .from('omnidash_incidents')
      .select('*')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(limit),
    'fetch_incidents'
  );
}

export async function addIncident(incident: Partial<Incident> & { user_id: string; title: string; severity: Incident['severity'] }): Promise<Incident> {
  const result = await supabase
    .from('omnidash_incidents')
    .insert({
      status: 'open',
      ...incident,
    })
    .select('*')
    .single();
  if (result.error) {
    logError(result.error, { action: 'omnidash_add_incident' });
    throw result.error;
  }
  return result.data;
}

export async function fetchHealthSnapshot(userId: string): Promise<{ lastUpdated: string | null }> {
  const latest = await Promise.all(
    ['omnidash_today_items', 'omnidash_pipeline_items', 'omnidash_kpi_daily', 'omnidash_incidents', 'omnidash_settings'].map(
      async (table) => {
        const res = await supabase
          .from(table)
          .select('updated_at')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1);
        return res.data?.[0]?.updated_at ?? null;
      }
    )
  );

  const lastUpdated = latest.filter(Boolean).sort().reverse()[0] ?? null;
  return { lastUpdated };
}

