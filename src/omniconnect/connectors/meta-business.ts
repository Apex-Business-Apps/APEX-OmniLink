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

  async getAuthUrl(userId: string, tenantId: string, state: string): Promise<string> {
    // Generate PKCE challenge
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Store code verifier for later use (in session/state)
    // TODO: Store securely in session

    return this.buildAuthUrl({
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
  }

  async completeHandshake(
    userId: string,
    tenantId: string,
    code: string,
    codeVerifier: string,
    state: string
  ): Promise<SessionToken> {
    // Exchange authorization code for access token
    const tokenResponse = await this.exchangeCodeForToken(code, codeVerifier) as MetaTokenResponse;

    const connectorId = this.generateConnectorId(userId, tenantId);

    return this.createSessionToken(
      connectorId,
      userId,
      tenantId,
      tokenResponse.access_token,
      this.config.scopes,
      tokenResponse.expires_in
    );
  }

  async disconnect(connectorId: string): Promise<void> {
    // Meta doesn't have a revoke endpoint, just clean up local storage
    // The token will naturally expire
    console.log(`Disconnecting Meta Business connector: ${connectorId}`);
  }

  async refreshToken(connectorId: string): Promise<SessionToken> {
    // TODO: Implement token refresh using refresh_token
    // For now, throw error to indicate refresh needed
    throw new Error('Token refresh not implemented for Meta Business API');
  }

  async fetchDelta(connectorId: string, since: Date): Promise<RawEvent[]> {
    // Get stored session to retrieve access token
    // TODO: Get token from storage
    const accessToken = 'placeholder_token'; // TODO: Retrieve from storage

    try {
      // Fetch posts from Meta Graph API
      const postsResponse = await this.makeRequest('/me/posts', {
        method: 'GET',
        token: accessToken,
        headers: {
          // Request fields we need
          fields: 'id,message,created_time,type,likes.summary(true),comments.summary(true),shares'
        }
      }) as MetaApiResponse<MetaPost>;

      return postsResponse.data.map(post => ({
        id: post.id,
        type: 'post',
        timestamp: post.created_time,
        data: post,
        metadata: {
          platform: 'facebook',
          postType: post.type
        }
      }));
    } catch (error) {
      console.error('Failed to fetch Meta posts:', error);
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
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
  }
}