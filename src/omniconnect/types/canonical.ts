/**
 * Canonical Event Schema for OmniConnect
 * Standardized event format for all provider data ingestion
 */

export enum EventType {
  // Social Media Events
  SOCIAL_POST_VIEWED = 'social_post_viewed',
  SOCIAL_POST_SAVED = 'social_post_saved',
  SOCIAL_POST_SHARED = 'social_post_shared',
  COMMENT = 'comment',
  MESSAGE = 'message',
  REACTION = 'reaction',

  // Business/Advertising Events
  AD_INSIGHT = 'ad_insight',
  PAGE_INSIGHT = 'page_insight',
  CAMPAIGN_PERFORMANCE = 'campaign_performance',
  AUDIENCE_INSIGHT = 'audience_insight',

  // Engagement Events
  PROFILE_VIEW = 'profile_view',
  CONNECTION_REQUEST = 'connection_request',
  FOLLOW = 'follow',
  UNFOLLOW = 'unfollow',

  // Content Events
  CONTENT_PUBLISHED = 'content_published',
  CONTENT_UPDATED = 'content_updated',
  CONTENT_DELETED = 'content_deleted',
}

export enum ConsentType {
  ANALYTICS = 'analytics',
  MARKETING = 'marketing',
  PERSONALIZATION = 'personalization',
  THIRD_PARTY_SHARING = 'third_party_sharing',
}

export interface ConsentFlags {
  [ConsentType.ANALYTICS]?: boolean;
  [ConsentType.MARKETING]?: boolean;
  [ConsentType.PERSONALIZATION]?: boolean;
  [ConsentType.THIRD_PARTY_SHARING]?: boolean;
}

export interface CanonicalEvent {
  /** Unique event identifier */
  eventId: string;

  /** Correlation ID for tracing end-to-end */
  correlationId: string;

  /** Tenant isolation */
  tenantId: string;

  /** User isolation */
  userId: string;

  /** Data source identifier */
  source: string;

  /** Provider name (meta_business, linkedin, twitter, etc.) */
  provider: string;

  /** External system identifier */
  externalId: string;

  /** Standardized event type */
  eventType: EventType;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** User consent flags */
  consentFlags: ConsentFlags;

  /** Provider-specific metadata */
  metadata: Record<string, unknown>;

  /** Standardized payload */
  payload: Record<string, unknown>;
}

export interface EventEnvelope {
  eventId: string;
  correlationId: string;
  tenantId: string;
  userId: string;
  eventType: EventType;
  payload: CanonicalEvent;
  timestamp: string;
  schemaVersion: string;
}