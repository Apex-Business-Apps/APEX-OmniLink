export type OmniDashPipelineStage =
  | 'lead'
  | 'contacted'
  | 'meeting'
  | 'proposal'
  | 'negotiation'
  | 'paid'
  | 'live'
  | 'lost';

export type OmniDashIncidentSeverity = 'sev1' | 'sev2' | 'sev3';
export type OmniDashIncidentStatus = 'open' | 'monitoring' | 'resolved';

export interface OmniDashSettings {
  user_id: string;
  demo_mode: boolean;
  show_connected_ecosystem: boolean;
  anonymize_kpis: boolean;
  freeze_mode: boolean;
  power_block_started_at: string | null;
  power_block_duration_minutes: number;
  updated_at: string;
}

export interface TodayItem {
  id: string;
  user_id: string;
  title: string;
  next_action: string | null;
  category: 'outcome' | 'outreach' | 'metric';
  order_index: number;
  is_active: boolean;
  power_block_started_at: string | null;
  power_block_duration_minutes: number;
  created_at?: string;
  updated_at?: string;
}

export interface PipelineItem {
  id: string;
  user_id: string;
  account_name: string;
  product: string;
  owner: string;
  stage: OmniDashPipelineStage;
  last_touch_at: string | null;
  next_touch_at: string | null;
  expected_mrr: number | null;
  probability: number | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface KpiDaily {
  id: string;
  user_id: string;
  day: string;
  tradeline_paid_starts: number;
  tradeline_active_pilots: number;
  tradeline_churn_risks: number;
  flowbills_demos: number;
  flowbills_paid_accounts: number;
  cash_days_to_cash: number | null;
  ops_sev1_incidents: number;
  updated_at?: string;
}

export interface Incident {
  id: string;
  user_id: string;
  severity: OmniDashIncidentSeverity;
  status: OmniDashIncidentStatus;
  title: string;
  description: string | null;
  resolution_notes: string | null;
  occurred_at: string;
  resolved_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OmniLinkIntegration {
  id: string;
  user_id: string;
  name: string;
  type: string;
  status: string | null;
  created_at?: string | null;
}

export interface OmniLinkApiKey {
  id: string;
  tenant_id: string;
  integration_id: string;
  name: string | null;
  key_prefix: string;
  scopes: Record<string, unknown>;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface OmniLinkEvent {
  id: string;
  tenant_id: string;
  integration_id: string;
  api_key_id: string;
  envelope_id: string;
  idempotency_key: string;
  source: string;
  type: string;
  subject: string | null;
  time: string;
  data: Record<string, unknown>;
  entity?: Record<string, unknown> | null;
  received_at: string;
}

export interface OmniLinkEntity {
  id: string;
  tenant_id: string;
  integration_id: string;
  entity_type: string;
  external_id: string;
  display_name: string | null;
  last_event_id: string | null;
  updated_at: string;
}

export interface OmniLinkOrchestrationRequest {
  id: string;
  tenant_id: string;
  integration_id: string;
  api_key_id: string;
  request_type: string;
  envelope_id: string;
  idempotency_key: string;
  source: string;
  type: string;
  time: string;
  target?: Record<string, unknown> | null;
  params?: Record<string, unknown> | null;
  policy?: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

export interface OmniLinkRun {
  id: string;
  tenant_id: string;
  integration_id: string;
  orchestration_request_id: string | null;
  external_run_id: string | null;
  status: string;
  policy?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export const OMNIDASH_PIPELINE_STAGES: Array<{ id: OmniDashPipelineStage; label: string }> = [
  { id: 'lead', label: 'Lead' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'meeting', label: 'Meeting set' },
  { id: 'proposal', label: 'Proposal sent' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'paid', label: 'Paid' },
  { id: 'live', label: 'Live' },
  { id: 'lost', label: 'Lost' },
];

export const OMNIDASH_FLAG = (() => {
  const raw =
    import.meta.env.VITE_OMNIDASH_ENABLED ??
    import.meta.env.OMNIDASH_ENABLED ??
    import.meta.env.VITE_OMNIDASH_FLAG;
  return String(raw ?? '').toLowerCase() === 'true' || raw === '1';
})();

export const OMNIDASH_ADMIN_ALLOWLIST = (() => {
  const raw =
    import.meta.env.VITE_OMNIDASH_ADMIN_EMAILS ??
    import.meta.env.OMNIDASH_ADMIN_EMAILS ??
    '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
})();

export const OMNIDASH_NAV_ITEMS = [
  { key: "home", label: "OmniDash", to: "/omnidash", icon: "O" },
  { key: "pipeline", label: "Pipeline", to: "/omnidash/pipeline", icon: "P" },
  { key: "kpis", label: "KPIs", to: "/omnidash/kpis", icon: "K" },
  { key: "ops", label: "Ops", to: "/omnidash/ops", icon: "!" },
  { key: "integrations", label: "Integrations", to: "/omnidash/integrations", icon: "I" },
  { key: "events", label: "Events", to: "/omnidash/events", icon: "E" },
  { key: "entities", label: "Entities", to: "/omnidash/entities", icon: "N" },
  { key: "runs", label: "Runs", to: "/omnidash/runs", icon: "R" },
  { key: "approvals", label: "Approvals", to: "/omnidash/approvals", icon: "A" },
];

export const OMNIDASH_SAFE_ENABLE_NOTE =
  'Enable OMNIDASH_ENABLED only for internal admins until stability is confirmed.';

// =============================================================================
// OmniTrace Types
// =============================================================================

export interface OmniTraceRun {
  id: string;
  workflow_id: string;
  trace_id: string;
  user_id: string | null;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  input_redacted: Record<string, unknown>;
  output_redacted: Record<string, unknown> | null;
  input_hash: string;
  output_hash: string | null;
  event_count: number;
  created_at: string;
  updated_at: string;
}

export interface OmniTraceEvent {
  id: string;
  workflow_id: string;
  event_key: string;
  kind: 'tool' | 'model' | 'policy' | 'cache' | 'system';
  name: string;
  latency_ms: number | null;
  data_redacted: Record<string, unknown>;
  data_hash: string;
  created_at: string;
}

export interface OmniTraceRunsListResponse {
  runs: OmniTraceRun[];
  total: number;
  limit: number;
}

export interface OmniTraceRunDetailResponse {
  run: OmniTraceRun;
  events: OmniTraceEvent[];
  replay_bundle: {
    workflow_id: string;
    input_hash: string;
    output_hash: string | null;
    event_count: number;
    events_truncated: boolean;
  };
}
