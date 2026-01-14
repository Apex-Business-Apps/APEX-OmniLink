import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, handlePreflight, isOriginAllowed } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitExceededResponse, RATE_LIMIT_PROFILES } from "../_shared/ratelimit.ts";

// Allowed tables for record creation (SQL injection prevention)
const ALLOWED_TABLES = ['automations', 'automation_logs', 'notifications', 'user_data'];

serve(async (req) => {
  // Handle CORS preflight with origin validation
  if (req.method === 'OPTIONS') {
    return handlePreflight(req);
  }

  const requestOrigin = req.headers.get('origin')?.replace(/\/$/, '') ?? null;
  const corsHeaders = buildCorsHeaders(requestOrigin);

  // Validate origin
  if (!isOriginAllowed(requestOrigin)) {
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { automationId } = body;

    // Validate automationId
    if (!automationId || typeof automationId !== 'string' || automationId.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid automationId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate UUID format to prevent injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(automationId)) {
      return new Response(JSON.stringify({ error: 'Invalid automationId format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch automation
    const { data: automation, error: fetchError } = await supabase
      .from('automations')
      .select('*')
      .eq('id', automationId)
      .single();

    if (fetchError) throw fetchError;
    if (!automation.is_active) {
      return new Response(JSON.stringify({ error: 'Automation is not active' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Execute based on action_type
    let result;
    switch (automation.action_type) {
      case 'send_email':
        result = await executeEmailAction(automation.config, supabase);
        break;
      case 'create_record':
        result = await executeCreateRecord(automation.config, supabase);
        break;
      case 'webhook':
        result = await executeWebhook(automation.config);
        break;
      case 'notification':
        result = await executeNotification(automation.config);
        break;
      default:
        throw new Error(`Unknown action type: ${automation.action_type}`);
    }

    // Update automation execution timestamp
    await supabase
      .from('automations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', automationId);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Automation execution error:', error);
    return new Response(JSON.stringify({ error: 'Automation execution failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function executeEmailAction(config: unknown, supabase: unknown) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) throw new Error('Email service not configured');

  // Validate email configuration
  if (!config.to || !config.subject) {
    throw new Error('Invalid email configuration');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from || 'noreply@omnilink.app',
      to: config.to,
      subject: config.subject,
      html: config.body,
    }),
  });

  if (!response.ok) {
    throw new Error('Email send failed');
  }

  return await response.json();
}

async function executeCreateRecord(config: unknown, supabase: unknown) {
  const { table, data } = config;

  // SECURITY: Validate table name against allowlist (SQL injection prevention)
  if (!table || typeof table !== 'string' || !ALLOWED_TABLES.includes(table)) {
    throw new Error('Invalid or unauthorized table');
  }

  // Validate data is an object
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid record data');
  }

  const { data: result, error } = await supabase
    .from(table)
    .insert(data)
    .select();

  if (error) throw error;
  return result;
}

async function executeWebhook(config: unknown) {
  if (!config.url || typeof config.url !== 'string') {
    throw new Error('Webhook URL is required');
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(config.url);
  } catch {
    throw new Error('Invalid webhook URL');
  }

  // Block internal/private URLs
  const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  if (blockedHosts.includes(parsedUrl.hostname) || parsedUrl.hostname.startsWith('192.168.') || parsedUrl.hostname.startsWith('10.')) {
    throw new Error('Internal URLs are not allowed');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000); // 30 second timeout

  try {
    const response = await fetch(config.url, {
      method: config.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: JSON.stringify(config.data),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error('Webhook request failed');
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Webhook request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function executeNotification(config: unknown) {
  // For now, just return success - can be extended to push notifications
  return {
    message: config.message,
    sent: true,
  };
}
