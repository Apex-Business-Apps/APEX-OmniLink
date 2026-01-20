/**
 * MAESTRO Phase 5-6 Tests
 * Tests ExecutionIntent wiring, idempotency, injection defense, and MAN mode
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MaestroExecutionAdapter } from '../../src/integrations/maestro/execution';
import { ExecutionIntent } from '../../src/integrations/maestro/orchestrator';
import { CryptoProvider, Ciphertext } from '../../src/integrations/maestro/crypto';

// Mock implementations
class MockCryptoProvider implements CryptoProvider {
    private uuidCounter = 0;

    async init(): Promise<void> {
        // Mock init - do nothing
    }

    async encrypt(data: unknown): Promise<Ciphertext> {
        const mockData = btoa(JSON.stringify(data));
        return {
            iv: new Uint8Array(12),
            data: new Uint8Array(Buffer.from(mockData)),
            version: 1
        };
    }

    async decrypt<T>(ciphertext: Ciphertext): Promise<T> {
        const mockString = Buffer.from(ciphertext.data).toString();
        return JSON.parse(atob(mockString)) as T;
    }

    randomUUID(): string {
        // Deterministic UUID for testing (no Math.random())
        this.uuidCounter++;
        return `mock-uuid-${this.uuidCounter}`;
    }
}

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('MAESTRO: Phase 5-6 Execution Tests', () => {
    let adapter: MaestroExecutionAdapter;
    let crypto: MockCryptoProvider;

    beforeEach(() => {
        vi.clearAllMocks();
        crypto = new MockCryptoProvider();
        adapter = new MaestroExecutionAdapter(
            crypto,
            'https://test.supabase.co/functions/v1/maestro-sync',
            'https://test.supabase.co/functions/v1/man-mode'
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('1) Duplicate Intent (Idempotency)', () => {
        it('should prevent duplicate side effects with same idempotency key', async () => {
            const intent: ExecutionIntent = {
                tenant_id: 'test-tenant',
                subject_id: 'user-123',
                trace_id: 'trace-456',
                created_at: new Date().toISOString(),
                locale: 'en-US',
                canonical_action_type: 'email.send',
                canonical_object_id: 'email-789',
                risk_lane: 'GREEN',
                translation_status: 'OK',
                confidence: 0.9,
                user_confirmed: true,
                idempotency_key: 'idem-key-123',
                params: { to: 'test@example.com', subject: 'Test' }
            };

            // Mock successful receipt claim (first time)
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ claimed: true })
            });

            // Mock successful sync
            mockFetch.mockResolvedValueOnce({
                ok: true
            });

            // First execution should succeed
            const result1 = await adapter.executeExecutionIntent(intent);
            expect(result1.success).toBe(true);
            expect(result1.receipt).toBe('idem-key-123');

            // Mock receipt claim failure (already claimed)
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ claimed: false })
            });

            // Second execution should return prior result without side effects
            const result2 = await adapter.executeExecutionIntent(intent);
            expect(result2.success).toBe(true);
            expect(result2.result).toEqual({ idempotent: true });
            expect(result2.receipt).toBe('idem-key-123');

            // Verify receipt claim was attempted twice
            expect(mockFetch).toHaveBeenCalledTimes(3); // claim + sync + claim again
        });
    });

    describe('2) Injection Defense (Fail-Closed)', () => {
        it('should block execution with injection payload and log risk event', async () => {
            const injectionIntent: ExecutionIntent = {
                tenant_id: 'test-tenant',
                subject_id: 'user-123',
                trace_id: 'trace-injection',
                created_at: new Date().toISOString(),
                locale: 'en-US',
                canonical_action_type: 'system.override', // Not in allowlist
                canonical_object_id: 'system',
                risk_lane: 'GREEN',
                translation_status: 'OK',
                confidence: 0.9,
                user_confirmed: true,
                idempotency_key: 'injection-key',
                params: { command: 'rm -rf /' }
            };

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = await adapter.executeExecutionIntent(injectionIntent);

            expect(result.success).toBe(false);
            expect(result.error).toContain('not allowlisted');

            // Verify risk event was logged
            expect(consoleSpy).toHaveBeenCalledWith(
                '[MAESTRO RISK]',
                expect.stringContaining('not allowlisted'),
                expect.objectContaining({ intent: 'trace-injection' })
            );

            consoleSpy.mockRestore();
        });

        it('should block when user_confirmed is false', async () => {
            const unconfirmedIntent = {
                tenant_id: 'test-tenant',
                subject_id: 'user-123',
                trace_id: 'trace-unconfirmed',
                created_at: new Date().toISOString(),
                locale: 'en-US',
                canonical_action_type: 'email.send',
                canonical_object_id: 'email-789',
                risk_lane: 'GREEN',
                translation_status: 'OK',
                confidence: 0.9,
                user_confirmed: false, // Not confirmed!
                idempotency_key: 'unconfirmed-key',
                params: { to: 'test@example.com' }
            } as unknown; // Cast for test purposes

            const result = await adapter.executeExecutionIntent(unconfirmedIntent);

            expect(result.success).toBe(false);
            expect(result.error).toContain('User confirmation required');
        });
    });

    describe('3) Translation Failure Blocking', () => {
        it('should block execution when translation_status is FAILED', async () => {
            const failedTranslationIntent: ExecutionIntent = {
                tenant_id: 'test-tenant',
                subject_id: 'user-123',
                trace_id: 'trace-failed-translation',
                created_at: new Date().toISOString(),
                locale: 'en-US',
                canonical_action_type: 'email.send',
                canonical_object_id: 'email-789',
                risk_lane: 'GREEN',
                translation_status: 'FAILED', // Translation failed!
                confidence: 0.9,
                user_confirmed: true,
                idempotency_key: 'failed-translation-key',
                params: { to: 'test@example.com' }
            };

            const result = await adapter.executeExecutionIntent(failedTranslationIntent);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Translation failed');
        });
    });

    describe('4) Risk Lane Routing', () => {
        it('should block BLOCKED risk lane', async () => {
            const blockedIntent: ExecutionIntent = {
                tenant_id: 'test-tenant',
                subject_id: 'user-123',
                trace_id: 'trace-blocked',
                created_at: new Date().toISOString(),
                locale: 'en-US',
                canonical_action_type: 'email.send',
                canonical_object_id: 'email-789',
                risk_lane: 'BLOCKED', // Explicitly blocked
                translation_status: 'OK',
                confidence: 0.9,
                user_confirmed: true,
                idempotency_key: 'blocked-key',
                params: { to: 'test@example.com' }
            };

            const result = await adapter.executeExecutionIntent(blockedIntent);

            expect(result.success).toBe(false);
            expect(result.error).toContain('BLOCKED');
        });

        it('should escalate RED risk lane to MAN mode', async () => {
            const redIntent: ExecutionIntent = {
                tenant_id: 'test-tenant',
                subject_id: 'user-123',
                trace_id: 'trace-red',
                created_at: new Date().toISOString(),
                locale: 'en-US',
                canonical_action_type: 'email.send',
                canonical_object_id: 'email-789',
                risk_lane: 'RED', // Requires human approval
                translation_status: 'OK',
                confidence: 0.9,
                user_confirmed: true,
                idempotency_key: 'red-key',
                params: { to: 'test@example.com' }
            };

            // Mock successful MAN mode escalation
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'man-task-123' })
            });

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const result = await adapter.executeExecutionIntent(redIntent);

            expect(result.success).toBe(true);
            expect(result.result).toEqual({ man_mode_escalated: true, task_id: 'pending' });

            // Verify MAN mode escalation was logged
            expect(consoleSpy).toHaveBeenCalledWith(
                '[MAESTRO] Escalating to MAN mode:',
                'RED risk lane requires human approval',
                expect.objectContaining({ intent: 'trace-red' })
            );

            consoleSpy.mockRestore();
        });

        it('should execute GREEN risk lane', async () => {
            const greenIntent: ExecutionIntent = {
                tenant_id: 'test-tenant',
                subject_id: 'user-123',
                trace_id: 'trace-green',
                created_at: new Date().toISOString(),
                locale: 'en-US',
                canonical_action_type: 'email.send',
                canonical_object_id: 'email-789',
                risk_lane: 'GREEN', // Should execute
                translation_status: 'OK',
                confidence: 0.9,
                user_confirmed: true,
                idempotency_key: 'green-key',
                params: { to: 'test@example.com' }
            };

            // Mock successful receipt claim and sync
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ claimed: true })
            });
            mockFetch.mockResolvedValueOnce({ ok: true });

            const result = await adapter.executeExecutionIntent(greenIntent);

            expect(result.success).toBe(true);
            expect(result.receipt).toBe('green-key');
            expect(result.result).toEqual({
                executed: true,
                action: 'email.send',
                object: 'email-789',
                timestamp: expect.any(String)
            });
        });
    });

    describe('5) Confidence Threshold Blocking', () => {
        it('should block execution when confidence is below 0.7', async () => {
            const lowConfidenceIntent: ExecutionIntent = {
                tenant_id: 'test-tenant',
                subject_id: 'user-123',
                trace_id: 'trace-low-confidence',
                created_at: new Date().toISOString(),
                locale: 'en-US',
                canonical_action_type: 'email.send',
                canonical_object_id: 'email-789',
                risk_lane: 'GREEN',
                translation_status: 'OK',
                confidence: 0.5, // Below threshold!
                user_confirmed: true,
                idempotency_key: 'low-confidence-key',
                params: { to: 'test@example.com' }
            };

            const result = await adapter.executeExecutionIntent(lowConfidenceIntent);

            expect(result.success).toBe(false);
            expect(result.error).toContain('below threshold 0.7');
        });
    });

    describe('6) Validation Tests', () => {
        it('should validate all required fields', async () => {
            const invalidIntent = {
                // Missing required fields
                canonical_action_type: 'email.send',
                params: {}
            } as unknown;

            const result = await adapter.executeExecutionIntent(invalidIntent);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Missing required identity fields');
        });

        it('should validate BCP-47 locale format', async () => {
            const invalidLocaleIntent: ExecutionIntent = {
                tenant_id: 'test-tenant',
                subject_id: 'user-123',
                trace_id: 'trace-invalid-locale',
                created_at: new Date().toISOString(),
                locale: 'invalid-locale', // Not BCP-47 format
                canonical_action_type: 'email.send',
                canonical_object_id: 'email-789',
                risk_lane: 'GREEN',
                translation_status: 'OK',
                confidence: 0.9,
                user_confirmed: true,
                idempotency_key: 'invalid-locale-key',
                params: { to: 'test@example.com' }
            };

            const result = await adapter.executeExecutionIntent(invalidLocaleIntent);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid locale format');
        });

        it('should validate confidence range', async () => {
            const invalidConfidenceIntent: ExecutionIntent = {
                tenant_id: 'test-tenant',
                subject_id: 'user-123',
                trace_id: 'trace-invalid-confidence',
                created_at: new Date().toISOString(),
                locale: 'en-US',
                canonical_action_type: 'email.send',
                canonical_object_id: 'email-789',
                risk_lane: 'GREEN',
                translation_status: 'OK',
                confidence: 1.5, // Invalid range
                user_confirmed: true,
                idempotency_key: 'invalid-confidence-key',
                params: { to: 'test@example.com' }
            };

            const result = await adapter.executeExecutionIntent(invalidConfidenceIntent);

            expect(result.success).toBe(false);
            expect(result.error).toContain('between 0 and 1');
        });
    });

    describe('7) MAN Mode Integration', () => {
        it('should handle MAN mode escalation failures gracefully', async () => {
            const redIntent: ExecutionIntent = {
                tenant_id: 'test-tenant',
                subject_id: 'user-123',
                trace_id: 'trace-man-fail',
                created_at: new Date().toISOString(),
                locale: 'en-US',
                canonical_action_type: 'email.send',
                canonical_object_id: 'email-789',
                risk_lane: 'RED',
                translation_status: 'OK',
                confidence: 0.9,
                user_confirmed: true,
                idempotency_key: 'man-fail-key',
                params: { to: 'test@example.com' }
            };

            // Mock MAN mode failure
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = await adapter.executeExecutionIntent(redIntent);

            expect(result.success).toBe(false);
            expect(result.error).toContain('MAN mode escalation failed');

            consoleSpy.mockRestore();
        });
    });

    describe('8) Receipt Claim Failure Handling', () => {
        it('should fail closed when receipt claim fails', async () => {
            const intent: ExecutionIntent = {
                tenant_id: 'test-tenant',
                subject_id: 'user-123',
                trace_id: 'trace-receipt-fail',
                created_at: new Date().toISOString(),
                locale: 'en-US',
                canonical_action_type: 'email.send',
                canonical_object_id: 'email-789',
                risk_lane: 'GREEN',
                translation_status: 'OK',
                confidence: 0.9,
                user_confirmed: true,
                idempotency_key: 'receipt-fail-key',
                params: { to: 'test@example.com' }
            };

            // Mock receipt claim failure
            mockFetch.mockRejectedValueOnce(new Error('Receipt service unavailable'));

            const result = await adapter.executeExecutionIntent(intent);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Receipt claim failed');
        });
    });
});
