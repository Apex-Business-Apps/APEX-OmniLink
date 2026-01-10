import { getOmniLinkHealth } from '@/integrations/omnilink';

async function run() {
  const health = await getOmniLinkHealth();
  const payload = {
    status: health.status,
    checkedAt: health.checkedAt,
    lastError: health.lastError ?? null,
  };
  console.log(JSON.stringify(payload, null, 2));
  if (health.status === 'error') {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('OmniLink health check failed', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
