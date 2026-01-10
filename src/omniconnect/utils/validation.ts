/**
 * Validation utilities for OmniConnect
 */

import { CanonicalEvent, EventType } from '../types/canonical';
import { SessionToken } from '../types/connector';

export function validateCanonicalEvent(event: unknown): event is CanonicalEvent {
  if (!event || typeof event !== 'object') return false;

  // Required fields
  if (!event.eventId || typeof event.eventId !== 'string') return false;
  if (!event.correlationId || typeof event.correlationId !== 'string') return false;
  if (!event.tenantId || typeof event.tenantId !== 'string') return false;
  if (!event.userId || typeof event.userId !== 'string') return false;
  if (!event.source || typeof event.source !== 'string') return false;
  if (!event.provider || typeof event.provider !== 'string') return false;
  if (!event.eventType || !Object.values(EventType).includes(event.eventType)) return false;
  if (!event.timestamp || typeof event.timestamp !== 'string') return false;

  // Optional fields with validation
  if (event.metadata && typeof event.metadata !== 'object') return false;
  if (event.payload && typeof event.payload !== 'object') return false;

  return true;
}

export function validateSessionToken(token: unknown): token is SessionToken {
  if (!token || typeof token !== 'object') return false;

  if (!token.token || typeof token.token !== 'string') return false;
  if (!token.connectorId || typeof token.connectorId !== 'string') return false;
  if (!token.userId || typeof token.userId !== 'string') return false;
  if (!token.tenantId || typeof token.tenantId !== 'string') return false;
  if (!token.provider || typeof token.provider !== 'string') return false;
  if (!Array.isArray(token.scopes)) return false;

  // expiresAt should be a Date or valid date string
  if (!(token.expiresAt instanceof Date) && typeof token.expiresAt !== 'string') return false;

  return true;
}

export function sanitizeEventPayload(payload: Record<string, unknown>): Record<string, unknown> {
  // TODO: Implement PII redaction and content sanitization
  return payload;
}

export function validateCorrelationId(id: string): boolean {
  // OmniConnect correlation IDs start with 'oc-'
  return id.startsWith('oc-') && id.length >= 39; // 'oc-' + UUID
}

export function validateTenantId(tenantId: string): boolean {
  // Basic validation - should be non-empty string
  return typeof tenantId === 'string' && tenantId.length > 0 && tenantId.length <= 100;
}

export function validateUserId(userId: string): boolean {
  // Basic validation - should be non-empty string
  return typeof userId === 'string' && userId.length > 0 && userId.length <= 100;
}