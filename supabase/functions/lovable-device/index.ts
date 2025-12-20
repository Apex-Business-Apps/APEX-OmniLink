import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
};

interface DeviceInfo {
  device_info: Record<string, any>;
  last_seen: string;
  device_id: string;
  user_id: string;
}

interface DeviceRegistryResponse {
  devices: DeviceInfo[];
}

function getEnv(name: string): string | undefined {
  return Deno.env.get(name);
}

function getConfig() {
  const baseUrl = getEnv('LOVABLE_API_BASE') ?? '';
  const apiKey = getEnv('LOVABLE_API_KEY') ?? '';
  const serviceRoleKey = getEnv('LOVABLE_SERVICE_ROLE_KEY');

  if (!baseUrl || !apiKey) {
    return null;
  }

  return { baseUrl, apiKey, serviceRoleKey };
}

async function requestLovable<T>(
  path: string,
  method: 'GET' | 'POST' = 'POST',
  body?: any
): Promise<T | undefined> {
  const config = getConfig();
  if (!config) {
    return undefined;
  }

  const { baseUrl, apiKey, serviceRoleKey } = config;
  const maxAttempts = 5;
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...(serviceRoleKey ? { 'X-Service-Role': serviceRoleKey } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        lastError = new Error(`Lovable request failed (${response.status}): ${text}`);
        if (response.status >= 500 && attempt < maxAttempts) {
          const delay = Math.min(500 * 2 ** (attempt - 1), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw lastError;
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return (await response.json()) as T;
      }
      return undefined as T;
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      const delay = Math.min(500 * 2 ** (attempt - 1), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unknown Lovable client error');
}

async function getDeviceRegistry(userId: string): Promise<DeviceRegistryResponse> {
  return requestLovable<DeviceRegistryResponse>(
    `/device-registry?user_id=${encodeURIComponent(userId)}`,
    'GET'
  ) as Promise<DeviceRegistryResponse>;
}

async function upsertDevice(userId: string, device: DeviceInfo): Promise<void> {
  await requestLovable<void>(
    '/device-registry',
    'POST',
    { ...device, user_id: userId }
  );
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function unauthorized(): Response {
  return json({ error: 'unauthorized' }, 401);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get userId from header or query params
    let userId = req.headers.get('x-user-id') ?? new URL(req.url).searchParams.get('user_id');
    
    // If no userId in header, try to get from Supabase auth
    if (!userId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          userId = user.id;
        } else {
          return unauthorized();
        }
      } else {
        return unauthorized();
      }
    }

    if (!userId) {
      return unauthorized();
    }

    if (req.method === 'GET') {
      const config = getConfig();
      if (!config) {
        return json(
          {
            error: 'lovable_not_configured',
            message: 'Lovable API credentials not configured',
          },
          503
        );
      }

      try {
        const registry = await getDeviceRegistry(userId);
        return json(registry, 200);
      } catch (error) {
        console.error('Device registry fetch failed:', error);
        return json(
          {
            error: 'registry_fetch_failed',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }

    if (req.method === 'POST') {
      const config = getConfig();
      if (!config) {
        return json(
          {
            error: 'lovable_not_configured',
            message: 'Lovable API credentials not configured',
          },
          503
        );
      }

      try {
        const body = (await req.json()) as { device: DeviceInfo };
        if (!body?.device?.device_id) {
          return json({ error: 'invalid_payload', message: 'Missing device_id' }, 400);
        }
        await upsertDevice(userId, body.device);
        return json({ status: 'ok' }, 200);
      } catch (error) {
        console.error('Device upsert failed:', error);
        return json(
          {
            error: 'upsert_failed',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }

    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error('Lovable device function error:', error);
    return json(
      {
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

