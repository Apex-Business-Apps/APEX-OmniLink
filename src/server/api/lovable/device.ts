import { getDeviceRegistry, upsertDevice } from '@/integrations/lovable/client';
import type { DeviceInfo } from '@/integrations/lovable/types';
import { logError } from '@/lib/monitoring';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function unauthorized(): Response {
  return json({ error: 'unauthorized' }, 401);
}

export async function handleLovableDevice(request: Request): Promise<Response> {
  const userId = request.headers.get('x-user-id') ?? new URL(request.url).searchParams.get('user_id');
  if (!userId) return unauthorized();

  if (request.method === 'GET') {
    try {
      const registry = await getDeviceRegistry(userId);
      return json(registry, 200);
    } catch (error) {
      await logError(error as Error, { action: 'lovable_device_registry', metadata: { userId } });
      return json({ error: 'registry_fetch_failed' }, 500);
    }
  }

  if (request.method === 'POST') {
    try {
      const body = (await request.json()) as { device: DeviceInfo };
      if (!body?.device?.device_id) return json({ error: 'invalid_payload' }, 400);
      await upsertDevice(userId, body.device);
      return json({ status: 'ok' }, 200);
    } catch (error) {
      await logError(error as Error, { action: 'lovable_device_upsert', metadata: { userId } });
      return json({ error: 'upsert_failed' }, 500);
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
}

export default handleLovableDevice;

