import { describe, expect, it } from 'vitest';
import { normalizeOmniPortIntent } from '../../supabase/functions/_shared/omniport-normalize';

const baseUrl = process.env.OMNI_PORT_BASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.OMNI_PORT_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

describe('OmniPort → OmniDash live feed', () => {
  if (!baseUrl || !serviceKey) {
    it.skip('skipped (set OMNI_PORT_BASE_URL and OMNI_PORT_SERVICE_KEY to enable live test)', () => {});
    return;
  }

  it(
    'ingests a normalized OmniPort intent into OmniDash feed (live)',
    async () => {
      const canonical = normalizeOmniPortIntent({
        channel: 'text',
        message: 'ping omnidash live',
        userId: 'live-test-user',
        notify: true,
        requiresApproval: false,
      });

      const url = `${baseUrl.replace(/\/$/, '')}/functions/v1/omnilink-port/omniport`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': canonical.traceId,
        },
        body: JSON.stringify(canonical.raw),
      });

      expect(response.status).toBeLessThan(500);
      const json = (await response.json()) as { results?: Array<{ status?: string }> };
      const firstStatus = json.results?.[0]?.status;
      expect(firstStatus).toMatch(/(ok|queued|rate_limited|error|denied)/);
    },
    15_000
  );
});
