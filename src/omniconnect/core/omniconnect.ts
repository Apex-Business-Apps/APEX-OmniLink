/**
 * OmniConnect Core Service
 * Main orchestration layer for all connector operations
 */

import { Connector, SessionToken } from '../types/connector';
import { CanonicalEvent } from '../types/canonical';
import { getConnector } from './registry';
import { generateCorrelationId } from '../utils/correlation';
import { EncryptedTokenStorage } from '../storage/encrypted-storage';
import { PolicyEngine } from '../policy/policy-engine';
import { SemanticTranslator } from '../translation/translator';
import { EntitlementsService } from '../entitlements/entitlements-service';
import { OmniLinkDelivery } from '../delivery/omnilink-delivery';

export interface OmniConnectConfig {
  tenantId: string;
  userId: string;
  appId: string;
  enableDemoMode?: boolean;
}

export class OmniConnect {
  private config: OmniConnectConfig;
  private tokenStorage: EncryptedTokenStorage;
  private policyEngine: PolicyEngine;
  private translator: SemanticTranslator;
  private entitlements: EntitlementsService;
  private delivery: OmniLinkDelivery;

  constructor(config: OmniConnectConfig) {
    this.config = config;

    // Initialize core services
    this.tokenStorage = new EncryptedTokenStorage();
    this.policyEngine = new PolicyEngine();
    this.translator = new SemanticTranslator();
    this.entitlements = new EntitlementsService();
    this.delivery = new OmniLinkDelivery();
  }

  /**
   * Check if OmniConnect is enabled for this user/app combination
   */
  async isEnabled(): Promise<boolean> {
    if (this.config.enableDemoMode) {
      return true; // Demo mode always enabled
    }

    return this.entitlements.checkEntitlement(
      this.config.tenantId,
      this.config.userId,
      this.config.appId,
      'omniconnect'
    );
  }

  /**
   * Get available connectors for this tenant/user
   */
  getAvailableConnectors(): string[] {
    // In demo mode, return mock connectors
    if (this.config.enableDemoMode) {
      return ['meta_business_demo', 'linkedin_demo'];
    }

    // TODO: Filter based on tenant entitlements
    return ['meta_business', 'linkedin'];
  }

  /**
   * Initiate OAuth handshake for a provider
   */
  async initiateHandshake(provider: string): Promise<string> {
    const correlationId = generateCorrelationId();
    console.log(`[${correlationId}] Initiating handshake for ${provider}`);

    const connector = getConnector(provider);
    if (!connector) {
      throw new Error(`Connector not found for provider: ${provider}`);
    }

    const state = this.generateState(correlationId);
    return connector.getAuthUrl(
      this.config.userId,
      this.config.tenantId,
      state
    );
  }

  /**
   * Complete OAuth handshake with authorization code
   */
  async completeHandshake(
    provider: string,
    code: string,
    codeVerifier: string,
    state: string
  ): Promise<SessionToken> {
    const correlationId = this.extractCorrelationId(state);
    console.log(`[${correlationId}] Completing handshake for ${provider}`);

    const connector = getConnector(provider);
    if (!connector) {
      throw new Error(`Connector not found for provider: ${provider}`);
    }

    // Complete the OAuth flow
    const sessionToken = await connector.completeHandshake(
      this.config.userId,
      this.config.tenantId,
      code,
      codeVerifier,
      state
    );

    // Store encrypted token
    await this.tokenStorage.store(sessionToken);

    console.log(`[${correlationId}] Handshake completed for ${provider}`);
    return sessionToken;
  }

  /**
   * Sync data from all connected providers
   */
  async syncAll(): Promise<{ eventsProcessed: number; eventsDelivered: number }> {
    const correlationId = generateCorrelationId();
    console.log(`[${correlationId}] Starting sync for user ${this.config.userId}`);

    let totalProcessed = 0;
    let totalDelivered = 0;

    // Get all active connectors for this user
    const activeConnectors = await this.tokenStorage.listActive(this.config.userId);

    for (const connector of activeConnectors) {
      try {
        const result = await this.syncConnector(connector.connectorId, correlationId);
        totalProcessed += result.eventsProcessed;
        totalDelivered += result.eventsDelivered;
      } catch (error) {
        console.error(`[${correlationId}] Failed to sync connector ${connector.connectorId}:`, error);
        // Continue with other connectors
      }
    }

    console.log(`[${correlationId}] Sync completed: ${totalProcessed} processed, ${totalDelivered} delivered`);
    return { eventsProcessed: totalProcessed, eventsDelivered: totalDelivered };
  }

  /**
   * Sync data from a specific connector
   */
  private async syncConnector(
    connectorId: string,
    correlationId: string
  ): Promise<{ eventsProcessed: number; eventsDelivered: number }> {
    // Get stored session
    const session = await this.tokenStorage.get(connectorId);
    if (!session) {
      throw new Error(`No session found for connector: ${connectorId}`);
    }

    const connector = getConnector(session.provider);
    if (!connector) {
      throw new Error(`Connector not found for provider: ${session.provider}`);
    }

    // Validate token is still active
    const isValid = await connector.validateToken(connectorId);
    if (!isValid) {
      // Try to refresh token
      await connector.refreshToken(connectorId);
    }

    // Fetch new data since last sync
    const lastSync = await this.tokenStorage.getLastSync(connectorId);
    const rawEvents = await connector.fetchDelta(connectorId, lastSync);

    if (rawEvents.length === 0) {
      return { eventsProcessed: 0, eventsDelivered: 0 };
    }

    // Normalize to canonical events
    const canonicalEvents = await connector.normalizeToCanonical(rawEvents);

    // Apply policy filtering
    const filteredEvents = await this.policyEngine.filter(
      canonicalEvents,
      this.config.appId,
      correlationId
    );

    // Translate to app-specific format
    const translatedEvents = await this.translator.translate(
      filteredEvents,
      this.config.appId,
      correlationId
    );

    // Deliver to OmniLink
    const deliveredCount = await this.delivery.deliverBatch(
      translatedEvents,
      this.config.appId,
      correlationId
    );

    // Update last sync timestamp
    await this.tokenStorage.updateLastSync(connectorId, new Date());

    return {
      eventsProcessed: canonicalEvents.length,
      eventsDelivered: deliveredCount
    };
  }

  /**
   * Disconnect a connector
   */
  async disconnectConnector(connectorId: string): Promise<void> {
    const correlationId = generateCorrelationId();
    console.log(`[${correlationId}] Disconnecting connector ${connectorId}`);

    const session = await this.tokenStorage.get(connectorId);
    if (!session) {
      throw new Error(`No session found for connector: ${connectorId}`);
    }

    const connector = getConnector(session.provider);
    if (connector) {
      await connector.disconnect(connectorId);
    }

    // Clean up stored data
    await this.tokenStorage.delete(connectorId);

    console.log(`[${correlationId}] Connector ${connectorId} disconnected`);
  }

  /**
   * Get connection status for all providers
   */
  async getConnectionStatus(): Promise<Array<{
    provider: string;
    connected: boolean;
    lastSync?: Date;
  }>> {
    const connectors = this.getAvailableConnectors();
    const status = [];

    for (const provider of connectors) {
      const sessions = await this.tokenStorage.listByProvider(
        this.config.userId,
        provider
      );

      if (sessions.length > 0) {
        // Find the most recent session
        const latestSession = sessions.reduce((latest, current) =>
          current.createdAt > latest.createdAt ? current : latest
        );

        status.push({
          provider,
          connected: true,
          lastSync: latestSession.lastSyncAt
        });
      } else {
        status.push({
          provider,
          connected: false
        });
      }
    }

    return status;
  }

  private generateState(correlationId: string): string {
    // State includes correlation ID for tracing and CSRF protection
    const nonce = Math.random().toString(36).substring(2, 15);
    return `${correlationId}.${Date.now()}.${nonce}`;
  }

  private extractCorrelationId(state: string): string {
    return state.split('.')[0];
  }
}
