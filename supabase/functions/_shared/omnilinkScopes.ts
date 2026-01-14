export interface OmniLinkScopes {
  permissions?: string[];
  constraints?: {
    env_allowlist?: string[];
    max_rpm?: number;
    max_concurrency?: number;
    max_payload_kb?: number;
    allowed_adapters?: string[];
    allowed_workflows?: Array<{ name: string; version?: string }>;
    approvals_required_for?: string[];
  };
}

export function matchPermission(permissions: string[], required: string): boolean {
  if (permissions.includes('*')) return true;
  if (permissions.includes(required)) return true;
  const [prefix] = required.split(':');
  if (permissions.includes(`${prefix}:*`)) return true;
  return false;
}

export function enforcePermission(scopes: OmniLinkScopes, required: string): boolean {
  const permissions = scopes.permissions ?? [];
  return matchPermission(permissions, required);
}

export function enforceEnvAllowlist(source: string, allowlist: string[]): boolean {
  if (!allowlist.length) return true;
  const envSegment = source.split('/').pop();
  if (!envSegment) return false;
  return allowlist.includes(envSegment);
}

export function allowWorkflow(
  workflow: { name?: string; version?: string },
  allowlist: Array<{ name: string; version?: string }>
): boolean {
  if (!allowlist.length) return true;
  if (!workflow.name) return false;
  return allowlist.some((entry) => entry.name === workflow.name && (!entry.version || entry.version === workflow.version));
}

export function allowAdapter(target: { system?: string } | undefined, allowlist: string[]): boolean {
  if (!allowlist.length) return true;
  if (!target?.system) return false;
  return allowlist.includes(target.system);
}
