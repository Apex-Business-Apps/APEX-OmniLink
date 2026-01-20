/**
 * MAESTRO End-to-End Tests
 *
 * Tests full workflow:
 * Frontend (hooks) → Backend (Edge Functions) → Database
 *
 * Flow:
 * 1. useMemory.storeWithEmbedding → IndexedDB
 * 2. Sync to backend → maestro-sync
 * 3. Verify receipt → Database
 * 4. useGrounding.search → Retrieval
 *
 * Phase 4: Backend Sync Implementation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { useMemory } from '@/integrations/maestro/hooks/useMemory';
import { useGrounding } from '@/integrations/maestro/hooks/useGrounding';
import { MaestroProvider } from '@/integrations/maestro/providers/MaestroProvider';
import { generateEncryptionKey, encryptMemory, computeContentHash } from '@/lib/security';
import { createClient } from '@supabase/supabase-js';
import type { MemoryItem } from '@/integrations/maestro/types';

// Test configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const MAESTRO_ENABLED = process.env.VITE_MAESTRO_ENABLED === 'true';

// Skip tests if environment is not configured
const shouldSkipTests = !SUPABASE_URL || !SUPABASE_ANON_KEY || !MAESTRO_ENABLED;

describe.skipIf(shouldSkipTests)('MAESTRO E2E Integration', () => {
  let supabase: ReturnType<typeof createClient>;
  let testUserId: string;
  let authToken: string;
  let encryptionKey: CryptoKey;

  beforeAll(async () => {
    // Setup Supabase client
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Create test user
    const testEmail = `maestro-e2e-${Date.now()}@example.com`;
    const testPassword = 'test-password-123!';

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (signUpError && !signUpError.message.includes('already registered')) {
      throw new Error(`Failed to create test user: ${signUpError.message}`);
    }

    // Sign in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      throw new Error(`Failed to sign in: ${signInError.message}`);
    }

    testUserId = signInData.user!.id;
    authToken = signInData.session!.access_token;

    // Generate encryption key for E2EE
    encryptionKey = await generateEncryptionKey();
  });

  afterAll(async () => {
    // Cleanup
    if (supabase && testUserId) {
      await supabase.from('maestro_receipts').delete().eq('tenant_id', testUserId);
      await supabase.from('maestro_audit').delete().eq('tenant_id', testUserId);
      await supabase.from('maestro_encrypted_blobs').delete().eq('tenant_id', testUserId);
    }
  });

  describe('Full Sync Workflow', () => {
    it('should store memory item locally with embedding', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MaestroProvider>{children}</MaestroProvider>
      );

      const { result } = renderHook(() => useMemory(), { wrapper });

      const testItem: Omit<MemoryItem, 'embedding'> = {
        id: `test-item-${Date.now()}`,
        tier: 'semantic',
        content: 'This is a test memory item for E2E testing',
        locale: 'en-US',
        content_hash: await computeContentHash('This is a test memory item for E2E testing'),
        provenance_refs: ['test-source'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await waitFor(
        async () => {
          await result.current.storeWithEmbedding('semantic', testItem);
        },
        { timeout: 10000 }
      );

      // Verify item was stored
      const retrieved = await result.current.get('semantic', testItem.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(testItem.id);
      expect(retrieved?.embedding).toBeDefined();
      expect(Array.isArray(retrieved?.embedding)).toBe(true);
    });

    it('should sync encrypted memory to backend', async () => {
      const testContent = 'Sensitive data that must be encrypted';
      const contentHash = await computeContentHash(testContent);
      const encryptedContent = await encryptMemory(testContent, encryptionKey);

      // Simulate storing encrypted blob (in real app, would use Supabase Storage)
      const blobPath = `/encrypted/${testUserId}/${contentHash}.bin`;

      const syncRequest = {
        idempotency_key: `e2e-sync-${Date.now()}`,
        canonical_event: {
          id: `event-${Date.now()}`,
          timestamp: new Date().toISOString(),
          locale: 'en-US',
          tier: 'semantic',
          intent_type: 'memory_store',
          risk_lane: 'GREEN',
          content_hash: contentHash,
          trace_id: `trace-${Date.now()}`,
        },
        encrypted_blob: {
          blob_path: blobPath,
          content_hash: contentHash,
          key_version: 1,
          locale: 'en-US',
          tier: 'semantic',
          size_bytes: encryptedContent.length,
          metadata: {
            algorithm: 'AES-GCM-256',
            encrypted: true,
          },
        },
      };

      const response = await fetch(`${SUPABASE_URL}/functions/v1/maestro-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(syncRequest),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.status).toBe('ok');
      expect(result.receipt_id).toBeDefined();

      // Verify receipt in database
      const { data: receipt, error } = await supabase
        .from('maestro_receipts')
        .select('*')
        .eq('id', result.receipt_id)
        .single();

      expect(error).toBeNull();
      expect(receipt).toBeDefined();
      expect(receipt.tenant_id).toBe(testUserId);
      expect(receipt.idempotency_key).toBe(syncRequest.idempotency_key);
    });

    it('should verify audit log entry', async () => {
      const traceId = `e2e-trace-${Date.now()}`;
      const contentHash = await computeContentHash('Test audit content');

      const syncRequest = {
        idempotency_key: `e2e-audit-${Date.now()}`,
        canonical_event: {
          id: `event-${Date.now()}`,
          timestamp: new Date().toISOString(),
          locale: 'en-US',
          tier: 'episodic',
          intent_type: 'audit_test',
          risk_lane: 'YELLOW',
          content_hash: contentHash,
          trace_id: traceId,
        },
        encrypted_blob: {
          blob_path: `/encrypted/audit-test.bin`,
          content_hash: contentHash,
          key_version: 1,
          locale: 'en-US',
          tier: 'episodic',
          size_bytes: 256,
        },
      };

      await fetch(`${SUPABASE_URL}/functions/v1/maestro-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(syncRequest),
      });

      // Verify audit log entry
      const { data: auditLogs, error } = await supabase
        .from('maestro_audit')
        .select('*')
        .eq('trace_id', traceId)
        .eq('tenant_id', testUserId);

      expect(error).toBeNull();
      expect(auditLogs).toBeDefined();
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].event_type).toBe('audit_test');
      expect(auditLogs[0].risk_lane).toBe('YELLOW');
    });

    it('should verify encrypted blob metadata', async () => {
      const contentHash = `e2e-blob-${Date.now()}`;

      const syncRequest = {
        idempotency_key: `e2e-blob-${Date.now()}`,
        canonical_event: {
          id: `event-${Date.now()}`,
          timestamp: new Date().toISOString(),
          locale: 'fr-FR',
          tier: 'core',
          intent_type: 'blob_test',
          risk_lane: 'RED',
          content_hash: contentHash,
        },
        encrypted_blob: {
          blob_path: `/encrypted/core/${contentHash}.bin`,
          content_hash: contentHash,
          key_version: 2,
          locale: 'fr-FR',
          tier: 'core',
          size_bytes: 4096,
          metadata: {
            test: 'e2e',
            encrypted: true,
          },
        },
      };

      await fetch(`${SUPABASE_URL}/functions/v1/maestro-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(syncRequest),
      });

      // Verify blob metadata
      const { data: blobs, error } = await supabase
        .from('maestro_encrypted_blobs')
        .select('*')
        .eq('content_hash', contentHash)
        .eq('tenant_id', testUserId);

      expect(error).toBeNull();
      expect(blobs).toBeDefined();
      expect(blobs.length).toBeGreaterThan(0);
      expect(blobs[0].tier).toBe('core');
      expect(blobs[0].locale).toBe('fr-FR');
      expect(blobs[0].key_version).toBe(2);
      expect(blobs[0].size_bytes).toBe(4096);
    });
  });

  describe('Idempotency Enforcement', () => {
    it('should handle concurrent duplicate requests', async () => {
      const idempotencyKey = `e2e-concurrent-${Date.now()}`;
      const contentHash = `concurrent-hash-${Date.now()}`;

      const syncRequest = {
        idempotency_key: idempotencyKey,
        canonical_event: {
          id: `event-${Date.now()}`,
          timestamp: new Date().toISOString(),
          locale: 'en-US',
          tier: 'working',
          intent_type: 'concurrent_test',
          risk_lane: 'GREEN',
          content_hash: contentHash,
        },
        encrypted_blob: {
          blob_path: `/encrypted/concurrent.bin`,
          content_hash: contentHash,
          key_version: 1,
          locale: 'en-US',
          tier: 'working',
          size_bytes: 128,
        },
      };

      // Send 3 concurrent requests with same idempotency key
      const requests = Array.from({ length: 3 }, () =>
        fetch(`${SUPABASE_URL}/functions/v1/maestro-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(syncRequest),
        })
      );

      const responses = await Promise.all(requests);
      const results = await Promise.all(responses.map((r) => r.json()));

      // All should succeed
      expect(responses.every((r) => r.status === 200)).toBe(true);

      // First should be 'ok', others should be 'duplicate'
      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 'ok').length).toBe(1);
      expect(statuses.filter((s) => s === 'duplicate').length).toBe(2);

      // All should have same receipt_id
      const receiptIds = results.map((r) => r.receipt_id);
      expect(new Set(receiptIds).size).toBe(1);
    });
  });

  describe('RLS Enforcement', () => {
    it('should isolate tenant data', async () => {
      // Sync data for first user
      const contentHash = `rls-test-${Date.now()}`;
      const syncRequest = {
        idempotency_key: `rls-test-${Date.now()}`,
        canonical_event: {
          id: `event-${Date.now()}`,
          timestamp: new Date().toISOString(),
          locale: 'en-US',
          tier: 'semantic',
          intent_type: 'rls_test',
          risk_lane: 'GREEN',
          content_hash: contentHash,
        },
        encrypted_blob: {
          blob_path: `/encrypted/rls-test.bin`,
          content_hash: contentHash,
          key_version: 1,
          locale: 'en-US',
          tier: 'semantic',
          size_bytes: 512,
        },
      };

      await fetch(`${SUPABASE_URL}/functions/v1/maestro-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(syncRequest),
      });

      // Create second user
      const secondEmail = `maestro-rls-${Date.now()}@example.com`;
      const { data: secondUser } = await supabase.auth.signUp({
        email: secondEmail,
        password: 'test-password-123!',
      });

      const { data: secondSession } = await supabase.auth.signInWithPassword({
        email: secondEmail,
        password: 'test-password-123!',
      });

      // Query receipts as second user
      const secondClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
          headers: {
            Authorization: `Bearer ${secondSession!.session!.access_token}`,
          },
        },
      });

      const { data: receipts } = await secondClient
        .from('maestro_receipts')
        .select('*')
        .eq('content_hash', contentHash);

      // Should not see first user's data
      expect(receipts).toBeDefined();
      expect(receipts?.length).toBe(0);
    });
  });

  describe('Health Check Integration', () => {
    it('should report healthy status', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/maestro-health`, {
        method: 'GET',
      });

      expect(response.status).toBeGreaterThanOrEqual(200);
      const result = await response.json();
      expect(result.status).toBeDefined();
      expect(result.checks.database.status).toBe('ok');
      expect(result.checks.configuration.status).toBe('ok');
    });
  });
});
