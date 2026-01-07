/**
 * Basic OmniConnect functionality tests
 */

import { describe, it, expect, vi } from 'vitest';
import { OmniConnect } from '../../src/omniconnect/core/omniconnect';
import { MetaBusinessConnector } from '../../src/omniconnect/connectors/meta-business';
import { registerConnector } from '../../src/omniconnect/core/registry';

// Mock the storage and other services as class constructors
vi.mock('../../src/omniconnect/storage/encrypted-storage', () => ({
  EncryptedTokenStorage: class {
    store = vi.fn();
    get = vi.fn();
    listActive = vi.fn().mockResolvedValue([]);
    delete = vi.fn();
  }
}));

vi.mock('../../src/omniconnect/policy/policy-engine', () => ({
  PolicyEngine: class {
    filter = vi.fn().mockResolvedValue([]);
  }
}));

vi.mock('../../src/omniconnect/translation/translator', () => ({
  SemanticTranslator: class {
    translate = vi.fn().mockResolvedValue([]);
  }
}));

vi.mock('../../src/omniconnect/entitlements/entitlements-service', () => ({
  EntitlementsService: class {
    checkEntitlement = vi.fn().mockResolvedValue(true);
  }
}));

vi.mock('../../src/omniconnect/delivery/omnilink-delivery', () => ({
  OmniLinkDelivery: class {
    deliverBatch = vi.fn().mockResolvedValue(0);
  }
}));

describe('OmniConnect Basic Functionality', () => {
  it('should create OmniConnect instance', () => {
    const config = {
      tenantId: 'test-tenant',
      userId: 'test-user',
      appId: 'test-app'
    };

    const omniconnect = new OmniConnect(config);
    expect(omniconnect).toBeDefined();
  });

  it('should check entitlements correctly', async () => {
    const config = {
      tenantId: 'test-tenant',
      userId: 'test-user',
      appId: 'test-app'
    };

    const omniconnect = new OmniConnect(config);
    const isEnabled = await omniconnect.isEnabled();
    expect(isEnabled).toBe(true);
  });

  it('should return available connectors', () => {
    const config = {
      tenantId: 'test-tenant',
      userId: 'test-user',
      appId: 'test-app'
    };

    const omniconnect = new OmniConnect(config);
    const connectors = omniconnect.getAvailableConnectors();
    expect(connectors).toContain('meta_business');
    expect(connectors).toContain('linkedin');
  });

  it('should return demo connectors in demo mode', () => {
    const config = {
      tenantId: 'test-tenant',
      userId: 'test-user',
      appId: 'test-app',
      enableDemoMode: true
    };

    const omniconnect = new OmniConnect(config);
    const connectors = omniconnect.getAvailableConnectors();
    expect(connectors).toContain('meta_business_demo');
    expect(connectors).toContain('linkedin_demo');
  });

  it('should register Meta Business connector', () => {
    const config = {
      provider: 'meta_business',
      clientId: 'test-client-id',
      clientSecret: 'test-secret',
      redirectUri: 'https://example.com/callback',
      scopes: ['pages_read_engagement', 'pages_show_list'],
      baseUrl: 'https://graph.facebook.com/v18.0'
    };

    const connector = new MetaBusinessConnector(config);
    expect(connector).toBeDefined();
    expect(connector.provider).toBe('meta_business');
  });
});
