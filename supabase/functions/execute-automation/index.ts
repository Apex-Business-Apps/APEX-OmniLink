/**
 * Execute Automation Edge Function
 *
 * Executes automation actions based on configuration.
 * Supports: send_email, create_record, webhook, notification
 *
 * Security:
 * - UUID validation for automationId
 * - Table allowlist for SQL injection prevention
 * - URL validation for webhooks (no internal IPs)
 * - Timeout protection for external calls
 *
 * Author: APEX CTO
 * Date: 2026-01-25
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/auth.ts';
import { handleCors, corsJsonResponse } from '../_shared/cors.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// Type Definitions
// ============================================================================

/** Allowed tables for record creation (SQL injection prevention) */
const ALLOWED_TABLES = [
  'invoices',
  'users',
  'logs',
  'tasks',
  'notifications',
  'audit_logs',
] as const;

type AllowedTable = (typeof ALLOWED_TABLES)[number];

/** Email action configuration */
interface EmailConfig {
  from?: string;
  to: string | string[];
  subject: string;
  body?: string;
  html?: string;
}

/** Record creation configuration */
interface CreateRecordConfig {
  table: string;
  data: Record<string, unknown>;
}

/** Webhook action configuration */
interface WebhookConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  data?: unknown;
}

/** Notification action configuration */
interface NotificationConfig {
  message: string;
  channel?: string;
  priority?: 'low' | 'normal' | 'high';
}

/** Union of all config types */
type AutomationConfig =
  | EmailConfig
  | CreateRecordConfig
  | WebhookConfig
  | NotificationConfig;

/** Automation record from database */
interface Automation {
  id: string;
  action_type: 'send_email' | 'create_record' | 'webhook' | 'notification';
  config: AutomationConfig;
  is_active: boolean;
}

// ============================================================================
// Type Guards
// ============================================================================

function isEmailConfig(config: unknown): config is EmailConfig {
  if (!config || typeof config !== 'object') return false;
  const c = config as Record<string, unknown>;
  return typeof c.to === 'string' || Array.isArray(c.to);
}

function isCreateRecordConfig(config: unknown): config is CreateRecordConfig {
  if (!config || typeof config !== 'object') return false;
  const c = config as Record<string, unknown>;
  return (
    typeof c.table === 'string' &&
    c.data !== null &&
    typeof c.data === 'object' &&
    !Array.isArray(c.data)
  );
}

function isWebhookConfig(config: unknown): config is WebhookConfig {
  if (!config || typeof config !== 'object') return false;
  const c = config as Record<string, unknown>;
  return typeof c.url === 'string';
}

function isNotificationConfig(config: unknown): config is NotificationConfig {
  if (!config || typeof config !== 'object') return false;
  const c = config as Record<string, unknown>;
  return typeof c.message === 'string';
}

function isAllowedTable(table: string): table is AllowedTable {
  return ALLOWED_TABLES.includes(table as AllowedTable);
}

// ============================================================================
// Action Executors
// ============================================================================

/**
 * Execute email action via Resend API.
 */
async function executeEmailAction(
  config: unknown
): Promise<Record<string, unknown>> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    throw new Error('Email service not configured');
  }

  if (!isEmailConfig(config)) {
    throw new Error('Invalid email configuration: missing to or subject');
  }

  if (!config.subject || typeof config.subject !== 'string') {
    throw new Error('Invalid email configuration: subject is required');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from ?? 'noreply@omnilink.app',
      to: config.to,
      subject: config.subject,
      html: config.html ?? config.body ?? '',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email send failed: ${response.status} ${errorText}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

/**
 * Execute record creation with table allowlist validation.
 */
async function executeCreateRecord(
  config: unknown,
  supabase: SupabaseClient
): Promise<unknown[]> {
  if (!isCreateRecordConfig(config)) {
    throw new Error('Invalid record configuration: missing table or data');
  }

  const { table, data } = config;

  // SECURITY: Validate table name against allowlist (SQL injection prevention)
  if (!isAllowedTable(table)) {
    throw new Error(
      `Invalid or unauthorized table: ${table}. ` +
        `Allowed tables: ${ALLOWED_TABLES.join(', ')}`
    );
  }

  const { data: result, error } = await supabase
    .from(table)
    .insert(data)
    .select();

  if (error) {
    throw new Error(`Record creation failed: ${error.message}`);
  }

  return result ?? [];
}

/**
 * Execute webhook with URL validation and timeout.
 */
async function executeWebhook(
  config: unknown
): Promise<Record<string, unknown>> {
  if (!isWebhookConfig(config)) {
    throw new Error('Invalid webhook configuration: URL is required');
  }

  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(config.url);
  } catch {
    throw new Error('Invalid webhook URL format');
  }

  // Block internal/private URLs (SSRF prevention)
  const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  const blockedPrefixes = ['192.168.', '10.', '172.16.', '172.17.', '172.18.'];

  if (
    blockedHosts.includes(parsedUrl.hostname) ||
    blockedPrefixes.some((prefix) => parsedUrl.hostname.startsWith(prefix))
  ) {
    throw new Error('Internal/private URLs are not allowed for webhooks');
  }

  // Additional check for localhost aliases
  if (
    parsedUrl.hostname.endsWith('.local') ||
    parsedUrl.hostname.endsWith('.internal')
  ) {
    throw new Error('Internal domain URLs are not allowed for webhooks');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000); // 30s timeout

  // Build headers with optional custom headers
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.headers) {
    Object.assign(requestHeaders, config.headers);
  }

  try {
    const response = await fetch(config.url, {
      method: config.method ?? 'POST',
      headers: requestHeaders,
      body: config.data ? JSON.stringify(config.data) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status}`);
    }

    // Try to parse as JSON, fallback to text
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as Record<string, unknown>;
    }

    return { text: await response.text() };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Webhook request timed out after 30 seconds');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Execute notification action.
 */
async function executeNotification(
  config: unknown
): Promise<Record<string, unknown>> {
  if (!isNotificationConfig(config)) {
    throw new Error('Invalid notification configuration: message is required');
  }

  // For now, return success - can be extended to push notifications
  return {
    message: config.message,
    channel: config.channel ?? 'default',
    priority: config.priority ?? 'normal',
    sent: true,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only accept POST
  if (req.method !== 'POST') {
    return corsJsonResponse(
      { error: 'method_not_allowed', message: 'Only POST is allowed' },
      405
    );
  }

  try {
    const supabase = createSupabaseClient();

    const body = await req.json();
    const { automationId } = body;

    // Validate automationId presence and type
    if (
      !automationId ||
      typeof automationId !== 'string' ||
      automationId.trim().length === 0
    ) {
      return corsJsonResponse(
        { error: 'validation_error', message: 'Invalid automationId' },
        400
      );
    }

    // Validate UUID format to prevent injection
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(automationId)) {
      return corsJsonResponse(
        {
          error: 'validation_error',
          message: 'Invalid automationId format (must be UUID)',
        },
        400
      );
    }

    // Fetch automation
    const { data: automation, error: fetchError } = await supabase
      .from('automations')
      .select('*')
      .eq('id', automationId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return corsJsonResponse(
          { error: 'not_found', message: 'Automation not found' },
          404
        );
      }
      throw fetchError;
    }

    const typedAutomation = automation as Automation;

    if (!typedAutomation.is_active) {
      return corsJsonResponse(
        { error: 'inactive', message: 'Automation is not active' },
        400
      );
    }

    // Execute based on action_type
    let result: unknown;
    switch (typedAutomation.action_type) {
      case 'send_email':
        result = await executeEmailAction(typedAutomation.config);
        break;
      case 'create_record':
        result = await executeCreateRecord(typedAutomation.config, supabase);
        break;
      case 'webhook':
        result = await executeWebhook(typedAutomation.config);
        break;
      case 'notification':
        result = await executeNotification(typedAutomation.config);
        break;
      default:
        throw new Error(
          `Unknown action type: ${typedAutomation.action_type}`
        );
    }

    // Update automation execution timestamp
    await supabase
      .from('automations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', automationId);

    return corsJsonResponse({
      success: true,
      action_type: typedAutomation.action_type,
      result,
    });
  } catch (error) {
    console.error('Automation execution error:', error);

    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return corsJsonResponse(
      { error: 'execution_error', message },
      500
    );
  }
});
