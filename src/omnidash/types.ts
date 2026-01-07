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
];

export const OMNIDASH_SAFE_ENABLE_NOTE =
  'Enable OMNIDASH_ENABLED only for internal admins until stability is confirmed.';

