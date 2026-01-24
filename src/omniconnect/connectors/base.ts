/**
 * Base Connector Implementation
 * Provides common functionality for all connector implementations
 */

import { Connector, ConnectorConfig, SessionToken, RawEvent } from '../types/connector';
import { CanonicalEvent } from '../types/canonical';

export abstract class BaseConnector implements Connector {
  readonly provider: string;
  protected config: ConnectorConfig;

  constructor(provider: string, config: ConnectorConfig) {
    this.provider = provider;
    this.config = config;
  }

  abstract getAuthUrl(userId: string, tenantId: string, state: string): Promise<string>;
  abstract completeHandshake(
    userId: string,
    tenantId: string,
    code: string,
    codeVerifier: string,
    state: string
  ): Promise<SessionToken>;
  abstract disconnect(connectorId: string): Promise<void>;
  abstract refreshToken(connectorId: string): Promise<SessionToken>;
  abstract fetchDelta(connectorId: string, since: Date): Promise<RawEvent[]>;
  abstract normalizeToCanonical(rawEvents: RawEvent[]): Promise<CanonicalEvent[]>;
  abstract validateToken(connectorId: string): Promise<boolean>;

  protected generateConnectorId(userId: string, tenantId: string): string {
    const uuid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    return `${this.provider}_${userId}_${tenantId}_${uuid.substring(0, 8)}`;
  }

  protected createSessionToken(
    connectorId: string,
    userId: string,
    tenantId: string,
    token: string,
    scopes: string[],
    expiresIn?: number
  ): SessionToken {
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : new Date(Date.now() + 3600 * 1000); // Default 1 hour

    return {
      token,
      expiresAt,
      connectorId,
      userId,
      tenantId,
      provider: this.provider,
      scopes
    };
  }

  protected async makeRequest(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      headers?: Record<string, string>;
      body?: unknown;
      token?: string;
    } = {}
  ): Promise<unknown> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  protected async exchangeCodeForToken(
    code: string,
    codeVerifier: string
  ): Promise<unknown> {
    // Standard OAuth2 token exchange
    return this.makeRequest('/oauth/access_token', {
      method: 'POST',
      body: {
        grant_type: 'authorization_code',
        code,
        code_verifier: codeVerifier,
        client_id: this.config.clientId,
        redirect_uri: this.config.redirectUri
      }
    });
  }

  protected buildAuthUrl(params: Record<string, string>): string {
    const url = new URL(this.config.baseUrl);
    url.pathname = '/oauth/authorize';

    // Add required OAuth2 parameters
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('scope', this.config.scopes.join(' '));

    // Add custom parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return url.toString();
  }
}
