/**
 * Connector Registry Implementation
 * Manages available connectors by provider name
 */

import { Connector, ConnectorRegistry } from '../types/connector';

class ConnectorRegistryImpl implements ConnectorRegistry {
  private connectors = new Map<string, Connector>();

  register(provider: string, connector: Connector): void {
    if (this.connectors.has(provider)) {
      throw new Error(`Connector for provider '${provider}' is already registered`);
    }
    this.connectors.set(provider, connector);
  }

  get(provider: string): Connector | undefined {
    return this.connectors.get(provider);
  }

  list(): string[] {
    return Array.from(this.connectors.keys());
  }

  has(provider: string): boolean {
    return this.connectors.has(provider);
  }

  unregister(provider: string): boolean {
    return this.connectors.delete(provider);
  }

  clear(): void {
    this.connectors.clear();
  }
}

// Global registry instance
export const connectorRegistry = new ConnectorRegistryImpl();

// Helper functions for common operations
export function registerConnector(provider: string, connector: Connector): void {
  connectorRegistry.register(provider, connector);
}

export function getConnector(provider: string): Connector | undefined {
  return connectorRegistry.get(provider);
}

export function hasConnector(provider: string): boolean {
  return connectorRegistry.has(provider);
}

export function listConnectors(): string[] {
  return connectorRegistry.list();
}