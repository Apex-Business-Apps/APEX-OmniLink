/**
 * MAESTRO Validation Tests
 *
 * Tests for JSON schema validation
 */

import { describe, it, expect } from 'vitest';
import {
  validateCanonicalEvent,
  validateExecutionIntent,
  validateGroundingResult,
} from '@/integrations/maestro/utils/validation';

describe('MAESTRO Validation', () => {
  describe('validateCanonicalEvent', () => {
    it('should validate a valid canonical event', () => {
      const validEvent = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        subject_id: 'conversation-1',
        scope: 'conversation',
        locale: 'en-CA',
        type: 'memory_write',
        created_at: new Date().toISOString(),
        trace_id: crypto.randomUUID(),
        source: 'user_input',
        content_hash: 'a'.repeat(64), // Valid SHA-256 hash
        provenance_refs: [],
        risk_lane: 'GREEN',
      };

      const result = validateCanonicalEvent(validEvent);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject event with invalid locale', () => {
      const invalidEvent = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        subject_id: 'conversation-1',
        scope: 'conversation',
        locale: 'invalid-locale', // Invalid BCP-47
        type: 'memory_write',
        created_at: new Date().toISOString(),
        trace_id: crypto.randomUUID(),
        source: 'user_input',
        content_hash: 'a'.repeat(64),
        provenance_refs: [],
        risk_lane: 'GREEN',
      };

      const result = validateCanonicalEvent(invalidEvent);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should reject event with invalid content_hash', () => {
      const invalidEvent = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        subject_id: 'conversation-1',
        scope: 'conversation',
        locale: 'en-US',
        type: 'memory_write',
        created_at: new Date().toISOString(),
        trace_id: crypto.randomUUID(),
        source: 'user_input',
        content_hash: 'invalid', // Not a valid SHA-256 hash
        provenance_refs: [],
        risk_lane: 'GREEN',
      };

      const result = validateCanonicalEvent(invalidEvent);
      expect(result.valid).toBe(false);
    });

    it('should reject event with invalid risk_lane', () => {
      const invalidEvent = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        subject_id: 'conversation-1',
        scope: 'conversation',
        locale: 'en-US',
        type: 'memory_write',
        created_at: new Date().toISOString(),
        trace_id: crypto.randomUUID(),
        source: 'user_input',
        content_hash: 'a'.repeat(64),
        provenance_refs: [],
        risk_lane: 'INVALID', // Not GREEN, YELLOW, or RED
      };

      const result = validateCanonicalEvent(invalidEvent);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateExecutionIntent', () => {
    it('should validate a valid execution intent', () => {
      const validIntent = {
        intent_id: crypto.randomUUID(),
        tenant_id: crypto.randomUUID(),
        idempotency_key: 'a'.repeat(64), // Valid SHA-256
        canonical_action: 'send_email',
        canonical_object: 'email',
        parameters: { to: 'test@example.com', subject: 'Test' },
        risk_lane: 'GREEN',
        trace_id: crypto.randomUUID(),
        source_event_id: crypto.randomUUID(),
        user_confirmed: true,
        created_at: new Date().toISOString(),
      };

      const result = validateExecutionIntent(validIntent);
      expect(result.valid).toBe(true);
    });

    it('should reject intent with missing required fields', () => {
      const invalidIntent = {
        intent_id: crypto.randomUUID(),
        tenant_id: crypto.randomUUID(),
        // Missing idempotency_key
        canonical_action: 'send_email',
        canonical_object: 'email',
        parameters: {},
        risk_lane: 'GREEN',
        trace_id: crypto.randomUUID(),
        source_event_id: crypto.randomUUID(),
        user_confirmed: true,
        created_at: new Date().toISOString(),
      };

      const result = validateExecutionIntent(invalidIntent);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateGroundingResult', () => {
    it('should validate a valid grounding result', () => {
      const validResult = {
        items: [
          {
            id: 'item-1',
            tier: 'core',
            locale: 'en-US',
            content: 'Test content',
            content_hash: 'a'.repeat(64),
            provenance_refs: [],
            created_at: new Date().toISOString(),
            key_version: 1,
          },
        ],
        query: 'test query',
        locale: 'en-US',
        similarity_scores: [0.95],
        trace_id: crypto.randomUUID(),
        retrieved_at: new Date().toISOString(),
      };

      const result = validateGroundingResult(validResult);
      expect(result.valid).toBe(true);
    });

    it('should reject result with invalid tier', () => {
      const invalidResult = {
        items: [
          {
            id: 'item-1',
            tier: 'invalid-tier', // Not a valid tier
            locale: 'en-US',
            content: 'Test content',
            content_hash: 'a'.repeat(64),
            provenance_refs: [],
            created_at: new Date().toISOString(),
            key_version: 1,
          },
        ],
        query: 'test query',
        locale: 'en-US',
        trace_id: crypto.randomUUID(),
        retrieved_at: new Date().toISOString(),
      };

      const result = validateGroundingResult(invalidResult);
      expect(result.valid).toBe(false);
    });
  });
});
