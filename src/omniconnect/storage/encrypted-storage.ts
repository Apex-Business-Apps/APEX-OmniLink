/**
 * Encrypted Token Storage
 * Secure storage for provider tokens with AES-GCM encryption
 */

import { SessionToken } from '../types/connector';

export interface StoredSession extends SessionToken {
  createdAt: Date;
  lastSyncAt?: Date;
  encryptedToken: string;
  encryptionKeyId: string;
}

/**
 * Encrypted storage for OAuth tokens
 * TODO: Implement actual AES-GCM encryption
 */
export class EncryptedTokenStorage {
  private storage = new Map<string, StoredSession>();

  async store(sessionToken: SessionToken): Promise<void> {
    // TODO: Implement AES-GCM encryption
    const storedSession: StoredSession = {
      ...sessionToken,
      createdAt: new Date(),
      encryptedToken: sessionToken.token, // Placeholder - should be encrypted
      encryptionKeyId: 'default-key'
    };

    this.storage.set(sessionToken.connectorId, storedSession);
  }

  async get(connectorId: string): Promise<StoredSession | null> {
    return this.storage.get(connectorId) || null;
  }

  async delete(connectorId: string): Promise<void> {
    this.storage.delete(connectorId);
  }

  async listActive(userId: string): Promise<StoredSession[]> {
    return Array.from(this.storage.values()).filter(
      session => session.userId === userId
    );
  }

  async listByProvider(userId: string, provider: string): Promise<StoredSession[]> {
    return Array.from(this.storage.values()).filter(
      session => session.userId === userId && session.provider === provider
    );
  }

  async getLastSync(connectorId: string): Promise<Date> {
    const session = this.storage.get(connectorId);
    return session?.lastSyncAt || new Date(0); // Return epoch if no sync yet
  }

  async updateLastSync(connectorId: string, lastSyncAt: Date): Promise<void> {
    const session = this.storage.get(connectorId);
    if (session) {
      session.lastSyncAt = lastSyncAt;
    }
  }
}