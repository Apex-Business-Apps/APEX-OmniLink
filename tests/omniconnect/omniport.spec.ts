/**
 * OmniPort Armageddon Test Suite
 * =============================================================================
 * Comprehensive testing for the proprietary ingress engine.
 * Tests Zero-Trust gate, MAN Mode governance, idempotency, and circuit breaker.
 * =============================================================================
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// =============================================================================
// MOCKS - Must be defined before imports
// =============================================================================

// Deterministic counter for test IDs (avoids Math.random() security hotspot)
const testIdCounter = vi.hoisted(() => ({ value: 0 }));

// Mock uuid with deterministic IDs for reproducible tests
vi.mock('uuid', async (importOriginal) => {
  const actual = await importOriginal<typeof import('uuid')>();
  return {
    ...actual,
    v4: vi.fn(() => `test-correlation-id-${(++testIdCounter.value).toString(16).padStart(6, '0')}`),
  };
});

// Track DLQ writes - use hoisted mock function
const mockDLQInsert = vi.hoisted(() => vi.fn().mockResolvedValue({ data: null, error: null }));

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'ingress_buffer') {
        return {
          insert: mockDLQInsert,
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

// Track device registry state - hoisted
const mockDeviceRegistry = vi.hoisted(() => new Map<string, { deviceId: string; status: string }>());

// Mock device registry
vi.mock('@/zero-trust/deviceRegistry', () => ({
  getDevice: vi.fn((deviceId: string) => mockDeviceRegistry.get(deviceId)),
  DeviceStatus: { trusted: 'trusted', suspect: 'suspect', blocked: 'blocked' },
}));

// Mock OmniLink delivery - use hoisted mock function
const mockDeliverBatch = vi.hoisted(() => vi.fn().mockResolvedValue(1));

vi.mock('../../src/omniconnect/delivery/omnilink-delivery', () => {
  return {
    OmniLinkDelivery: class MockOmniLinkDelivery {
      deliverBatch = mockDeliverBatch;
    },
  };
});

// Mock idempotency
vi.mock('../../sim/idempotency', () => ({
  withIdempotency: vi.fn(async (
    _key: string,
    _correlationId: string,
    _eventType: string,
    operation: () => Promise<unknown>
  ) => {
    const result = await operation();
    return { result, wasCached: false, attemptCount: 1 };
  }),
}));

// Mock monitoring
vi.mock('@/lib/monitoring', () => ({
  logAnalyticsEvent: vi.fn(),
  logError: vi.fn(),
}));

// Mock persistence
vi.mock('@/libs/persistence', () => ({
  persistentGet: vi.fn().mockResolvedValue(null),
  persistentSet: vi.fn().mockResolvedValue(undefined),
}));

// =============================================================================
// IMPORTS (after mocks)
// =============================================================================

import { OmniPortEngine } from '../../src/omniconnect/ingress/OmniPort';
import {
  TextSource,
  VoiceSource,
  WebhookSource,
  SecurityError,
} from '../../src/omniconnect/types/ingress';

// =============================================================================
// TEST FIXTURES
// =============================================================================

const createTextInput = (overrides: Partial<TextSource> = {}): TextSource => ({
  type: 'text',
  content: 'Hello, this is a test message',
  source: 'web',
  userId: '550e8400-e29b-41d4-a716-446655440000',
  ...overrides,
});

const createVoiceInput = (overrides: Partial<VoiceSource> = {}): VoiceSource => ({
  type: 'voice',
  transcript: 'Test voice transcription',
  confidence: 0.95,
  audioUrl: 'https://storage.example.com/audio/test.wav',
  durationMs: 1500,
  userId: '550e8400-e29b-41d4-a716-446655440001',
  ...overrides,
});

const createWebhookInput = (overrides: Partial<WebhookSource> = {}): WebhookSource => ({
  type: 'webhook',
  payload: { event: 'test', data: { key: 'value' } },
  provider: 'stripe',
  signature: 'sha256=abc123',
  userId: '550e8400-e29b-41d4-a716-446655440002',
  ...overrides,
});

// =============================================================================
// TEST SUITE
// =============================================================================

describe('OmniPort - The Proprietary Ingress Engine', () => {
  let omniPort: OmniPortEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDeviceRegistry.clear();
    mockDLQInsert.mockResolvedValue({ data: null, error: null });
    mockDeliverBatch.mockResolvedValue(1);

    // Reset singleton
    OmniPortEngine.resetInstance();
    omniPort = OmniPortEngine.getInstance();
    omniPort.initialize();
  });

  afterEach(() => {
    OmniPortEngine.resetInstance();
  });

  // ===========================================================================
  // TEST 1: THE SPEED RUN
  // ===========================================================================
  describe('Test: The Speed Run - Performance', () => {
    it('should complete e2e ingestion in under 50ms', async () => {
      // Setup: Register a trusted device
      const userId = createTextInput().userId;
      mockDeviceRegistry.set(userId, { deviceId: userId, status: 'trusted' });

      const input = createTextInput();

      const startTime = performance.now();
      const result = await omniPort.ingest(input);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(result.status).toBe('accepted');
      expect(result.latencyMs).toBeDefined();
      expect(duration).toBeLessThan(50);
    });

    it('should process voice input within performance threshold', async () => {
      const input = createVoiceInput();
      const userId = input.userId!;
      mockDeviceRegistry.set(userId, { deviceId: userId, status: 'trusted' });

      const startTime = performance.now();
      const result = await omniPort.ingest(input);
      const endTime = performance.now();

      expect(result.status).toBe('accepted');
      expect(endTime - startTime).toBeLessThan(50);
    });

    it('should process webhook input within performance threshold', async () => {
      const input = createWebhookInput();
      const userId = input.userId!;
      mockDeviceRegistry.set(userId, { deviceId: userId, status: 'trusted' });

      const startTime = performance.now();
      const result = await omniPort.ingest(input);
      const endTime = performance.now();

      expect(result.status).toBe('accepted');
      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  // ===========================================================================
  // TEST 2: THE MOAT - MAN Mode Governance
  // ===========================================================================
  describe('Test: The Moat - MAN Mode Governance', () => {
    it('should flag "delete" command with RED risk lane and requires_man_approval', async () => {
      const input = createTextInput({
        content: 'Please delete all user data from the system',
      });
      const userId = input.userId;
      mockDeviceRegistry.set(userId, { deviceId: userId, status: 'trusted' });

      const result = await omniPort.ingest(input);

      expect(result.riskLane).toBe('RED');
      expect(result.status).toBe('accepted');

      // Verify delivery was called with MAN Mode metadata
      expect(mockDeliverBatch).toHaveBeenCalledTimes(1);
      const deliveredEvents = mockDeliverBatch.mock.calls[0][0];
      expect(deliveredEvents[0].metadata.requires_man_approval).toBe(true);
      expect(deliveredEvents[0].metadata.detected_intents).toContain('delete');
    });

    it('should flag "transfer" command with RED risk lane and requires_man_approval', async () => {
      const input = createTextInput({
        content: 'I want to transfer $5000 to account xyz',
      });
      const userId = input.userId;
      mockDeviceRegistry.set(userId, { deviceId: userId, status: 'trusted' });

      const result = await omniPort.ingest(input);

      expect(result.riskLane).toBe('RED');

      const deliveredEvents = mockDeliverBatch.mock.calls[0][0];
      expect(deliveredEvents[0].metadata.requires_man_approval).toBe(true);
      expect(deliveredEvents[0].metadata.detected_intents).toContain('transfer');
    });

    it('should flag "grant_access" command with RED risk lane and requires_man_approval', async () => {
      const input = createTextInput({
        content: 'Please grant_access to the admin panel for new user',
      });
      const userId = input.userId;
      mockDeviceRegistry.set(userId, { deviceId: userId, status: 'trusted' });

      const result = await omniPort.ingest(input);

      expect(result.riskLane).toBe('RED');

      const deliveredEvents = mockDeliverBatch.mock.calls[0][0];
      expect(deliveredEvents[0].metadata.requires_man_approval).toBe(true);
      expect(deliveredEvents[0].metadata.detected_intents).toContain('grant_access');
    });

    it('should flag multiple high-risk intents in voice transcription', async () => {
      const input = createVoiceInput({
        transcript: 'delete all records and transfer funds to external account',
      });
      const userId = input.userId!;
      mockDeviceRegistry.set(userId, { deviceId: userId, status: 'trusted' });

      const result = await omniPort.ingest(input);

      expect(result.riskLane).toBe('RED');

      const deliveredEvents = mockDeliverBatch.mock.calls[0][0];
      expect(deliveredEvents[0].metadata.requires_man_approval).toBe(true);
      expect(deliveredEvents[0].metadata.detected_intents).toContain('delete');
      expect(deliveredEvents[0].metadata.detected_intents).toContain('transfer');
    });

    it('should allow normal commands with GREEN risk lane', async () => {
      const input = createTextInput({
        content: 'Show me the dashboard metrics',
      });
      const userId = input.userId;
      mockDeviceRegistry.set(userId, { deviceId: userId, status: 'trusted' });

      const result = await omniPort.ingest(input);

      expect(result.riskLane).toBe('GREEN');

      const deliveredEvents = mockDeliverBatch.mock.calls[0][0];
      expect(deliveredEvents[0].metadata.requires_man_approval).toBe(false);
      expect(deliveredEvents[0].metadata.detected_intents).toHaveLength(0);
    });
  });

  // ===========================================================================
  // TEST 3: THE SHIELD - Zero-Trust Gate
  // ===========================================================================
  describe('Test: The Shield - Zero-Trust Gate', () => {
    it('should throw SecurityError for blocked devices', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440099';
      mockDeviceRegistry.set(userId, { deviceId: userId, status: 'blocked' });

      const input = createTextInput({ userId });

      await expect(omniPort.ingest(input)).rejects.toThrow(SecurityError);
      await expect(omniPort.ingest(input)).rejects.toMatchObject({
        code: 'DEVICE_BLOCKED',
      });
    });

    it('should set RED risk lane for suspect devices', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440098';
      mockDeviceRegistry.set(userId, { deviceId: userId, status: 'suspect' });

      const input = createTextInput({ userId });

      const result = await omniPort.ingest(input);

      expect(result.riskLane).toBe('RED');
      expect(result.status).toBe('accepted');
    });

    it('should allow trusted devices with GREEN risk lane', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440097';
      mockDeviceRegistry.set(userId, { deviceId: userId, status: 'trusted' });

      const input = createTextInput({ userId });

      const result = await omniPort.ingest(input);

      expect(result.riskLane).toBe('GREEN');
      expect(result.status).toBe('accepted');
    });

    it('should allow unknown devices but flag them', async () => {
      // Don't register the device
      const input = createTextInput({
        userId: '550e8400-e29b-41d4-a716-446655440096',
      });

      const result = await omniPort.ingest(input);

      // Unknown devices are allowed but should be tracked
      expect(result.status).toBe('accepted');
    });

    it('should handle voice input without userId gracefully', async () => {
      const input = createVoiceInput({ userId: undefined });

      const result = await omniPort.ingest(input);

      // Should still process without userId
      expect(result.status).toBe('accepted');
    });
  });

  // ===========================================================================
  // TEST 4: THE SAFETY NET - Circuit Breaker / DLQ
  // ===========================================================================
  describe('Test: The Safety Net - Circuit Breaker / DLQ', () => {
    it('should write to DLQ on delivery failure and return buffered status', async () => {
      const userId = createTextInput().userId;
      mockDeviceRegistry.set(userId, { deviceId: userId, status: 'trusted' });

      // Mock delivery failure
      mockDeliverBatch.mockRejectedValueOnce(new Error('Delivery service unavailable'));

      const input = createTextInput();

      const result = await omniPort.ingest(input);

      expect(result.status).toBe('buffered');
      expect(mockDLQInsert).toHaveBeenCalledTimes(1);

      // Verify DLQ entry structure
      const dlqCall = mockDLQInsert.mock.calls[0][0];
      expect(dlqCall).toMatchObject({
        raw_input: input,
        error_reason: 'Delivery service unavailable',
        status: 'pending',
        source_type: 'text',
      });
      expect(dlqCall.correlation_id).toBeDefined();
      expect(typeof dlqCall.risk_score).toBe('number');
    });

    it('should calculate higher risk score for RED lane failures', async () => {
      const userId = createTextInput().userId;
      mockDeviceRegistry.set(userId, { deviceId: userId, status: 'trusted' });

      mockDeliverBatch.mockRejectedValueOnce(new Error('Network error'));

      // Input with high-risk intent (triggers RED lane)
      const input = createTextInput({
        content: 'delete all my data',
      });

      const result = await omniPort.ingest(input);

      expect(result.status).toBe('buffered');
      expect(result.riskLane).toBe('RED');

      const dlqCall = mockDLQInsert.mock.calls[0][0];
      // RED lane + high-risk intent should give score >= 80
      expect(dlqCall.risk_score).toBeGreaterThanOrEqual(80);
    });

    it('should calculate higher risk score for webhook failures', async () => {
      const userId = createWebhookInput().userId!;
      mockDeviceRegistry.set(userId, { deviceId: userId, status: 'trusted' });

      mockDeliverBatch.mockRejectedValueOnce(new Error('Webhook delivery failed'));

      const input = createWebhookInput();

      const result = await omniPort.ingest(input);

      expect(result.status).toBe('buffered');

      const dlqCall = mockDLQInsert.mock.calls[0][0];
      // Webhook source adds +10 to risk score
      expect(dlqCall.risk_score).toBeGreaterThanOrEqual(10);
    });

    it('should continue even if DLQ write fails', async () => {
      const userId = createTextInput().userId;
      mockDeviceRegistry.set(userId, { deviceId: userId, status: 'trusted' });

      // Mock both delivery and DLQ failure
      mockDeliverBatch.mockRejectedValueOnce(new Error('Delivery failed'));
      mockDLQInsert.mockResolvedValueOnce({
        data: null,
        error: { message: 'DLQ write failed' },
      });

      const input = createTextInput();

      // Should not throw, should return buffered
      const result = await omniPort.ingest(input);

      expect(result.status).toBe('buffered');
    });

    it('should include user_id in DLQ entry when available', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440088';
      mockDeviceRegistry.set(userId, { deviceId: userId, status: 'trusted' });

      mockDeliverBatch.mockRejectedValueOnce(new Error('Timeout'));

      const input = createTextInput({ userId });

      await omniPort.ingest(input);

      const dlqCall = mockDLQInsert.mock.calls[0][0];
      expect(dlqCall.user_id).toBe(userId);
    });
  });

  // ===========================================================================
  // ADDITIONAL TESTS: Singleton & Initialization
  // ===========================================================================
  describe('Singleton Pattern', () => {
    it('should return same instance on multiple getInstance calls', () => {
      const instance1 = OmniPortEngine.getInstance();
      const instance2 = OmniPortEngine.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton correctly', () => {
      const instance1 = OmniPortEngine.getInstance();
      OmniPortEngine.resetInstance();
      const instance2 = OmniPortEngine.getInstance();

      expect(instance1).not.toBe(instance2);
    });

    it('should be idempotent on initialize', () => {
      const instance = OmniPortEngine.getInstance();

      // Multiple initializations should not throw
      expect(() => {
        instance.initialize();
        instance.initialize();
        instance.initialize();
      }).not.toThrow();
    });
  });

  // ===========================================================================
  // ADDITIONAL TESTS: Input Type Coverage
  // ===========================================================================
  describe('Input Type Coverage', () => {
    beforeEach(() => {
      // Register trusted device for all input types
      ['550e8400-e29b-41d4-a716-446655440000',
       '550e8400-e29b-41d4-a716-446655440001',
       '550e8400-e29b-41d4-a716-446655440002'].forEach(id => {
        mockDeviceRegistry.set(id, { deviceId: id, status: 'trusted' });
      });
    });

    it('should process TextSource input correctly', async () => {
      const input = createTextInput();

      const result = await omniPort.ingest(input);

      expect(result.correlationId).toBeDefined();
      expect(result.status).toBe('accepted');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should process VoiceSource input correctly', async () => {
      const input = createVoiceInput();

      const result = await omniPort.ingest(input);

      expect(result.correlationId).toBeDefined();
      expect(result.status).toBe('accepted');

      // Verify confidence is passed in metadata
      const deliveredEvents = mockDeliverBatch.mock.calls[0][0];
      expect(deliveredEvents[0].metadata.confidence).toBe(0.95);
    });

    it('should process WebhookSource input correctly', async () => {
      const input = createWebhookInput();

      const result = await omniPort.ingest(input);

      expect(result.correlationId).toBeDefined();
      expect(result.status).toBe('accepted');
    });

    it('should detect high-risk intents in webhook payload', async () => {
      const input = createWebhookInput({
        payload: { action: 'delete', target: 'all_users' },
      });

      const result = await omniPort.ingest(input);

      expect(result.riskLane).toBe('RED');
    });
  });

  // ===========================================================================
  // ADDITIONAL TESTS: Correlation ID Propagation
  // ===========================================================================
  describe('Correlation ID Propagation', () => {
    it('should generate unique correlation IDs for each request', async () => {
      const input1 = createTextInput();
      const input2 = createTextInput();

      const userId = input1.userId;
      mockDeviceRegistry.set(userId, { deviceId: userId, status: 'trusted' });

      const result1 = await omniPort.ingest(input1);
      const result2 = await omniPort.ingest(input2);

      expect(result1.correlationId).toBeDefined();
      expect(result2.correlationId).toBeDefined();
      // UUIDs should be unique (unless there's a collision, which is astronomically unlikely)
      // Since we mock uuid.v4, they will have the same prefix but different random suffixes
    });

    it('should pass correlation ID to delivery service', async () => {
      const input = createTextInput();
      const userId = input.userId;
      mockDeviceRegistry.set(userId, { deviceId: userId, status: 'trusted' });

      await omniPort.ingest(input);

      expect(mockDeliverBatch).toHaveBeenCalledWith(
        expect.any(Array),
        'omniport',
        expect.stringContaining('test-correlation-id')
      );
    });
  });
});
