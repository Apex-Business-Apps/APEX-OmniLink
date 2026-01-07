/**
 * Basic OmniConnect functionality tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OmniConnect } from '../../src/omniconnect/core/omniconnect';
import { MetaBusinessConnector } from '../../src/omniconnect/connectors/meta-business';
import { registerConnector } from '../../src/omniconnect/core/registry';

// REMEDIATION: Use proper constructor function for mocks
vi.mock('../../src/omniconnect/storage/encrypted-storage', () => ({
  EncryptedTokenStorage: vi.fn().mockImplementation(function() {
    return {
      store: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      listActive: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };
  })
}));

vi.mock('../../src/omniconnect/policy/policy-engine', () => {
  return {
    PolicyEngine: class MockPolicyEngine {
      evaluate = vi.fn().mockReturnValue(true);
      loadRules = vi.fn().mockResolvedValue(undefined);
      validateEvent = vi.fn().mockReturnValue({ valid: true });
    }
  };
});

vi.mock('../../src/omniconnect/translation/translator', () => {
  return {
    SemanticTranslator: class MockSemanticTranslator {
      translate = vi.fn().mockImplementation((event) => ({...event, translated: true }));
    }
  };
});

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
  let omniConnect: OmniConnect;

  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure we create a fresh instance for every test
    omniConnect = new OmniConnect({
      tenantId: 'test-tenant',
      userId: 'test-user',
      appId: 'test-app'
    });
  });

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
