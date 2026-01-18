/**
 * Connector Registry Implementation
 * Manages available connectors by provider name
 */

import { Connector, ConnectorRegistry } from '../types/connector';
import { BarChart3, MessageCircle, Facebook, Mail, Youtube, Instagram, Music, Zap, Server, Globe, Smartphone, Bot } from 'lucide-react';

export interface IntegrationDef {
  id: string;
  name: string;
  type: string;
  description: string;
  icon: unknown;
  requiresApiKey: boolean;
  requiresUsername?: boolean;
  scopes?: string[];
}

export const availableIntegrations: IntegrationDef[] = [
  { id: '1', name: 'TradeLine 24/7', type: 'tradeline247', description: 'Analytics and business intelligence', icon: BarChart3, requiresApiKey: true },
  { id: '2', name: 'WhatsApp', type: 'whatsapp', description: 'Business messaging platform', icon: MessageCircle, requiresApiKey: true },
  { id: '3', name: 'Facebook', type: 'facebook', description: 'Social media integration', icon: Facebook, requiresApiKey: true },
  { id: '4', name: 'Messenger', type: 'messenger', description: 'Facebook Messenger integration', icon: MessageCircle, requiresApiKey: true },
  { id: '5', name: 'Google Apps', type: 'google', description: 'Google Workspace integration', icon: Mail, requiresApiKey: true },
  { id: '6', name: 'YouTube', type: 'youtube', description: 'Video platform integration', icon: Youtube, requiresApiKey: true },
  { id: '7', name: 'Instagram', type: 'instagram', description: 'Social media integration', icon: Instagram, requiresApiKey: true },
  { id: '8', name: 'TikTok', type: 'tiktok', description: 'Short video platform', icon: Music, requiresApiKey: true },
  { id: '9', name: 'Zapier', type: 'zapier', description: 'Automation platform', icon: Zap, requiresApiKey: true },
  { id: '10', name: 'Klaviyo', type: 'klaviyo', description: 'Email marketing automation', icon: Mail, requiresApiKey: true },
  { id: '11', name: 'Gmail', type: 'gmail', description: 'Email service integration', icon: Mail, requiresApiKey: true },
  { id: '12', name: 'IONOS.ca', type: 'ionos', description: 'Hosting and domain services', icon: Server, requiresApiKey: true, requiresUsername: true },
  { id: '13', name: 'Webnames.ca', type: 'webnames', description: 'Domain management', icon: Globe, requiresApiKey: true, requiresUsername: true },
  { id: '14', name: 'Samsung Apps', type: 'samsung', description: 'Native Samsung integrations', icon: Smartphone, requiresApiKey: false },
  { id: '15', name: 'ChatGPT', type: 'chatgpt', description: 'AI assistant integration', icon: Bot, requiresApiKey: true },
  { id: '16', name: 'Grok', type: 'grok', description: 'AI assistant by xAI', icon: Bot, requiresApiKey: true },
];

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