/**
 * Connection pooling and resource management utilities
 */
import { recordLoopHeartbeat } from '@/guardian/heartbeat';

interface PooledConnection {
  id: string;
  inUse: boolean;
  lastUsed: number;
  cleanup?: () => void;
}

class ConnectionPool {
  private connections: Map<string, PooledConnection> = new Map();
  private maxConnections: number;
  private idleTimeout: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxConnections = 10, idleTimeout = 60000) {
    this.maxConnections = maxConnections;
    this.idleTimeout = idleTimeout;

    // Clean up idle connections periodically
    this.cleanupInterval = setInterval(() => {
      try {
        this.cleanupIdleConnections();
        recordLoopHeartbeat('connection-pool-cleanup');
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error in connection pool cleanup:', error);
        }
      }
    }, 30000);
  }

  /**
   * Cleanup resources and stop interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    // Cleanup all connections
    for (const connection of this.connections.values()) {
      connection.cleanup?.();
    }
    this.connections.clear();
  }

  acquire(id: string): boolean {
    let connection = this.connections.get(id);

    if (!connection) {
      if (this.connections.size >= this.maxConnections) {
        return false;
      }
      // Assuming createConnection is a new method or connection creation logic is handled here
      // For now, creating a basic connection object
      connection = {
        id,
        inUse: false, // New connections are initially not in use
        lastUsed: Date.now(),
      };
      this.connections.set(id, connection);
    }

    connection.inUse = true;
    connection.lastUsed = Date.now();
    return true;
  }

  release(id: string): void {
    const connection = this.connections.get(id);
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
    }
  }

  remove(id: string): void {
    const connection = this.connections.get(id);
    if (connection) {
      connection.cleanup?.();
      this.connections.delete(id);
    }
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    for (const [id, connection] of this.connections.entries()) {
      if (!connection.inUse && now - connection.lastUsed > this.idleTimeout) {
        this.remove(id);
      }
    }
  }

  /* Method evictLeastRecentlyUsed removed as it is unused and connection strategy changed to reject on full */

  getStats() {
    const inUse = Array.from(this.connections.values()).filter(c => c.inUse).length;
    return {
      total: this.connections.size,
      inUse,
      idle: this.connections.size - inUse,
      maxConnections: this.maxConnections,
    };
  }
}

export const connectionPool = new ConnectionPool();
