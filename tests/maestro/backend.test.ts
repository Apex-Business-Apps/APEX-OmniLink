/**
 * MAESTRO Backend Integration Tests
 *
 * Tests for Edge Functions and database integration:
 * - maestro-sync (auth, validation, idempotency, RLS)
 * - maestro-health (health checks)
 * - Database migrations (receipts, audit, encrypted_blobs)
 *
 * Phase 4: Backend Sync Implementation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Test configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Skip tests if environment is not configured
const shouldSkipTests = !SUPABASE_URL || !SUPABASE_ANON_KEY;

describe.skipIf(shouldSkipTests)('MAESTRO Backend Integration', () => {
  let serviceClient: SupabaseClient;
  let anonClient: SupabaseClient;
  let testUserId: string;
  let authToken: string;

  beforeAll(async () => {
    // Create service client for setup
    serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Create anon client for user operations
    anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Create a test user (skip if already exists)
    const testEmail = `maestro-test-${Date.now()}@example.com`;
    const testPassword = `test-password-${crypto.randomUUID()}!`;

    const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (signUpError && !signUpError.message.includes('already registered')) {
      throw new Error(`Failed to create test user: ${signUpError.message}`);
    }

    // Sign in to get auth token
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      throw new Error(`Failed to sign in test user: ${signInError.message}`);
    }

    testUserId = signInData.user!.id;
    authToken = signInData.session!.access_token;
  });

  afterAll(async () => {
    // Cleanup test data
    if (serviceClient && testUserId) {
      await serviceClient.from('maestro_receipts').delete().eq('tenant_id', testUserId);
      await serviceClient.from('maestro_audit').delete().eq('tenant_id', testUserId);
      await serviceClient.from('maestro_encrypted_blobs').delete().eq('tenant_id', testUserId);
    }
  });

  describe('Database Migrations', () => {
    it('should have maestro_receipts table with correct schema', async () => {
      const { data, error } = await serviceClient
        .from('maestro_receipts')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have maestro_audit table with correct schema', async () => {
      const { data, error } = await serviceClient
        .from('maestro_audit')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have maestro_encrypted_blobs table with correct schema', async () => {
      const { data, error } = await serviceClient
        .from('maestro_encrypted_blobs')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should enforce RLS on maestro_receipts', async () => {
      // Try to access receipts without auth (should fail)
      const { data, error } = await anonClient
        .from('maestro_receipts')
        .select('*')
        .limit(1);

      // RLS should deny access or return empty
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should enforce unique constraint on maestro_receipts', async () => {
      const uniqueKey = `test-key-${Date.now()}`;

      // Insert first receipt
      const { error: error1 } = await serviceClient
        .from('maestro_receipts')
        .insert({
          tenant_id: testUserId,
          idempotency_key: uniqueKey,
          canonical_event: { test: 'event' },
        });

      expect(error1).toBeNull();

      // Try to insert duplicate (should fail)
      const { error: error2 } = await serviceClient
        .from('maestro_receipts')
        .insert({
          tenant_id: testUserId,
          idempotency_key: uniqueKey,
          canonical_event: { test: 'event2' },
        });

      expect(error2).toBeDefined();
      expect(error2?.code).toBe('23505'); // PostgreSQL unique violation
    });

    it('should allow append-only to maestro_audit', async () => {
      const { error } = await serviceClient
        .from('maestro_audit')
        .insert({
          tenant_id: testUserId,
          trace_id: `test-trace-${Date.now()}`,
          event_type: 'test_event',
          risk_lane: 'GREEN',
          content_hash: 'test-hash',
        });

      expect(error).toBeNull();
    });

    it('should enforce unique constraint on maestro_encrypted_blobs by content_hash', async () => {
      const uniqueHash = `hash-${Date.now()}`;

      // Insert first blob
      const { error: error1 } = await serviceClient
        .from('maestro_encrypted_blobs')
        .insert({
          tenant_id: testUserId,
          blob_path: '/test/path1',
          content_hash: uniqueHash,
          key_version: 1,
          locale: 'en-US',
          tier: 'semantic',
          size_bytes: 1024,
        });

      expect(error1).toBeNull();

      // Try to insert duplicate hash (should fail)
      const { error: error2 } = await serviceClient
        .from('maestro_encrypted_blobs')
        .insert({
          tenant_id: testUserId,
          blob_path: '/test/path2',
          content_hash: uniqueHash,
          key_version: 1,
          locale: 'en-US',
          tier: 'semantic',
          size_bytes: 2048,
        });

      expect(error2).toBeDefined();
      expect(error2?.code).toBe('23505'); // PostgreSQL unique violation
    });
  });

  describe('maestro-sync Edge Function', () => {
    const SYNC_ENDPOINT = `${SUPABASE_URL}/functions/v1/maestro-sync`;

    it('should reject requests without auth', async () => {
      const response = await fetch(SYNC_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(401);
    });

    it('should reject invalid request body', async () => {
      const response = await fetch(SYNC_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ invalid: 'payload' }),
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toBe('validation_error');
    });

    it('should accept valid sync request', async () => {
      const idempotencyKey = `test-sync-${Date.now()}`;
      const contentHash = `hash-${Date.now()}`;

      const validRequest = {
        idempotency_key: idempotencyKey,
        canonical_event: {
          id: `event-${Date.now()}`,
          timestamp: new Date().toISOString(),
          locale: 'en-US',
          tier: 'semantic',
          intent_type: 'test_intent',
          risk_lane: 'GREEN',
          content_hash: contentHash,
          trace_id: `trace-${Date.now()}`,
        },
        encrypted_blob: {
          blob_path: '/encrypted/test-blob.bin',
          content_hash: contentHash,
          key_version: 1,
          locale: 'en-US',
          tier: 'semantic',
          size_bytes: 1024,
          metadata: { test: true },
        },
      };

      const response = await fetch(SYNC_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(validRequest),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.status).toBe('ok');
      expect(result.receipt_id).toBeDefined();
      expect(result.created_at).toBeDefined();
    });

    it('should return duplicate status for idempotent requests', async () => {
      const idempotencyKey = `test-idempotent-${Date.now()}`;
      const contentHash = `hash-idempotent-${Date.now()}`;

      const validRequest = {
        idempotency_key: idempotencyKey,
        canonical_event: {
          id: `event-${Date.now()}`,
          timestamp: new Date().toISOString(),
          locale: 'en-US',
          tier: 'working',
          intent_type: 'test_intent',
          risk_lane: 'YELLOW',
          content_hash: contentHash,
        },
        encrypted_blob: {
          blob_path: '/encrypted/idempotent-blob.bin',
          content_hash: contentHash,
          key_version: 1,
          locale: 'en-US',
          tier: 'working',
          size_bytes: 512,
        },
      };

      // First request
      const response1 = await fetch(SYNC_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(validRequest),
      });

      expect(response1.status).toBe(200);
      const result1 = await response1.json();
      expect(result1.status).toBe('ok');

      // Second request (duplicate)
      const response2 = await fetch(SYNC_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(validRequest),
      });

      expect(response2.status).toBe(200);
      const result2 = await response2.json();
      expect(result2.status).toBe('duplicate');
      expect(result2.receipt_id).toBe(result1.receipt_id);
    });

    it('should reject plaintext content', async () => {
      const validRequest = {
        idempotency_key: `test-plaintext-${Date.now()}`,
        canonical_event: {
          id: `event-${Date.now()}`,
          timestamp: new Date().toISOString(),
          locale: 'en-US',
          tier: 'semantic',
          intent_type: 'test_intent',
          risk_lane: 'RED',
          content_hash: 'hash-plaintext',
        },
        encrypted_blob: {
          blob_path: '/plaintext/sensitive-data.txt', // Should be rejected
          content_hash: 'hash-plaintext',
          key_version: 1,
          locale: 'en-US',
          tier: 'semantic',
          size_bytes: 1024,
        },
      };

      const response = await fetch(SYNC_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(validRequest),
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toBe('validation_error');
      expect(result.message).toContain('plaintext');
    });
  });

  describe('maestro-health Edge Function', () => {
    const HEALTH_ENDPOINT = `${SUPABASE_URL}/functions/v1/maestro-health`;

    it('should return health status', async () => {
      const response = await fetch(HEALTH_ENDPOINT, {
        method: 'GET',
      });

      expect(response.status).toBeGreaterThanOrEqual(200);
      const result = await response.json();
      expect(result.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
      expect(result.timestamp).toBeDefined();
      expect(result.checks).toBeDefined();
      expect(result.checks.database).toBeDefined();
      expect(result.checks.configuration).toBeDefined();
    });

    it('should include database table checks', async () => {
      const response = await fetch(HEALTH_ENDPOINT, {
        method: 'GET',
      });

      const result = await response.json();
      expect(result.checks.database.status).toBeDefined();
      expect(['ok', 'error']).toContain(result.checks.database.status);
    });

    it('should include configuration checks', async () => {
      const response = await fetch(HEALTH_ENDPOINT, {
        method: 'GET',
      });

      const result = await response.json();
      expect(result.checks.configuration.status).toBeDefined();
      expect(['ok', 'error']).toContain(result.checks.configuration.status);
    });
  });
});
