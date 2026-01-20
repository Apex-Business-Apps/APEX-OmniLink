/**
 * Meta Business API Connector
 * Handles OAuth2/PKCE flow and data ingestion from Meta Business APIs
 */

import { BaseConnector } from './base';
import { ConnectorConfig, SessionToken, RawEvent } from '../types/connector';
import { CanonicalEvent, EventType } from '../types/canonical';
import { generateCorrelationId } from '../utils/correlation';

interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface MetaPost {
  id: string;
  message?: string;
  created_time: string;
  type: string;
  likes?: { count: number };
  comments?: { count: number };
  shares?: { count: number };
}

interface MetaApiResponse<T> {
  data: T[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
  };
}

/**
 * Meta Business API Connector
 * Implements OAuth2/PKCE flow for Meta Business APIs
 */
export class MetaBusinessConnector extends BaseConnector {
  constructor(config: ConnectorConfig) {
    super('meta_business', config);
  }

  async getAuthUrl(_userId: string, _tenantId: string, state: string): Promise<string> {
    const params = {
      state,
      // If we needed to pass extra state, we could encode userId/tenantId here
    };
    return this.buildAuthUrl(params);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async completeHandshake(
    userId: string,
    tenantId: string,
    code: string,
    codeVerifier: string,
    _state: string
  ): Promise<SessionToken> {
    // Exchange authorization code for access token
    const tokenResponse = await this.exchangeCodeForToken(code, codeVerifier) as MetaTokenResponse;

    const connectorId = this._generateConnectorId(userId, tenantId);

    return this.createSessionToken(
      connectorId,
      userId,
      tenantId,
      tokenResponse.access_token,
      ['read_content', 'manage_content'],
      tokenResponse.expires_in
    );
  }

  async disconnect(connectorId: string): Promise<void> {
    // Meta doesn't have a revoke endpoint, just clean up local storage
    // The token will naturally expire
    console.log(`Disconnecting Meta Business connector: ${connectorId}`);
  }

  async createSession(_config: ConnectorConfig, code: string, codeVerifier: string, userId: string, tenantId: string): Promise<SessionToken> {
    // This method is typically used to complete the OAuth flow and create a session.
    // It often wraps or calls completeHandshake.
    // For now, let's assume it calls completeHandshake with placeholder state.
    // TODO: Implement proper state handling if createSession is to be used directly for OAuth completion.
    return this.completeHandshake(userId, tenantId, code, codeVerifier, 'placeholder_state');
  }

  async refreshToken(_connectorId: string): Promise<SessionToken> {
    // TODO: Implement token refresh using refresh_token
    // For now, throw error to indicate refresh needed
    throw new Error('Token refresh not implemented');
  }

  async fetchDelta(connectorId: string, since: Date): Promise<RawEvent[]> {
    try {
      // Get stored session to retrieve access token
      // TODO: Retrieve access token from storage using connectorId
      const accessToken = 'placeholder_token'; // Placeholder

      // Assuming config.accountId is available or can be derived.
      // For now, using a placeholder or assuming it's part of the connector config.
      // If `accountId` is meant to be a page ID, it needs to be stored/retrieved.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountId = (this.config as any).externalId || 'me'; // Using externalId as a potential page/user ID

      // Construct query parameters manually as makeRequest might not support 'params'
      const queryParams = new URLSearchParams({
        since: since.toISOString(),
        fields: 'id,message,created_time,type,likes.summary(true),comments.summary(true),shares,full_picture'
      });

      const postsResponse = await this.makeRequest(`/${accountId}/posts?${queryParams.toString()}`, {
        method: 'GET',
        token: accessToken, // Use the retrieved accessToken
      }) as MetaApiResponse<MetaPost>;

      return postsResponse.data.map((post: MetaPost) => ({
        id: post.id,
        type: 'social_post', // Changed from 'post' to 'social_post' as per instruction's syncEvents
        timestamp: post.created_time,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: post as unknown as Record<string, unknown>, // Cast to unknown first to avoid overlap error
        metadata: {
          platform: 'facebook', // Kept 'facebook' as it's more specific than 'meta'
          postType: post.type || 'post'
        }
      }));
    } catch (error) {
      console.warn(`Error fetching delta for connector ${connectorId}:`, error);
      return [];
    }
  }

  async normalizeToCanonical(rawEvents: RawEvent[]): Promise<CanonicalEvent[]> {
    const correlationId = generateCorrelationId();

    return rawEvents.map(event => {
      const post = event.data as MetaPost;

      return {
        eventId: `meta_${event.id}`,
        correlationId,
        tenantId: 'placeholder_tenant', // TODO: Get from context
        userId: 'placeholder_user', // TODO: Get from context
        source: 'meta_business_api',
        provider: 'meta_business',
        externalId: event.id,
        eventType: EventType.SOCIAL_POST_VIEWED,
        timestamp: new Date(event.timestamp).toISOString(),
        consentFlags: {
          analytics: true,
          marketing: false,
          personalization: false,
          third_party_sharing: false
        },
        metadata: {
          platform: 'facebook',
          postType: post.type,
          apiVersion: 'v18.0'
        },
        payload: {
          postId: post.id,
          content: post.message || '',
          engagement: {
            likes: post.likes?.count || 0,
            comments: post.comments?.count || 0,
            shares: post.shares?.count || 0
          },
          publishedAt: event.timestamp
        }
      };
    });
  }

  async validateState(_state: string): Promise<boolean> {
    try {
      // TODO: Get token from storage
      const accessToken = 'placeholder_token';

      // Make a lightweight API call to validate token
      await this.makeRequest('/me', {
        method: 'GET',
        token: accessToken,
        headers: { fields: 'id' }
      });

      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  async validateToken(connectorId: string): Promise<boolean> {
    try {
      // TODO: Get token from storage
      const accessToken = 'placeholder_token';

      // Make a lightweight API call to validate token
      await this.makeRequest('/me', {
        method: 'GET',
        token: accessToken,
        headers: { fields: 'id' }
      });

      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  private generateCodeVerifier(): string {
    // Generate random 32-byte string, base64url encoded
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    // SHA256 hash of verifier, base64url encoded
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(hash));
  }

  private base64UrlEncode(array: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...array));
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}