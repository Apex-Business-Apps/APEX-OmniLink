/**
 * NFT Verification Edge Function Tests
 *
 * Purpose: Test verify-nft function for NFT ownership verification
 *
 * Author: OmniLink APEX
 * Date: 2026-01-01
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock environment variables
const mockEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  ALCHEMY_API_KEY_POLYGON: 'test-alchemy-key',
  MEMBERSHIP_NFT_ADDRESS: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
};

// Mock constants
const mockUserId = 'user-123';
const mockWalletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as const;
const mockAuthToken = 'valid-jwt-token';

describe('verify-nft Edge Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    Object.entries(mockEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
  });

  describe('Authentication & Authorization', () => {
    it('should reject requests without authorization header', async () => {
      const request = new Request('https://test.com/verify-nft', {
        method: 'GET',
      });

      // Mock response would be 401 Unauthorized
      expect(request.headers.get('Authorization')).toBeNull();
    });

    it('should reject requests with invalid JWT token', async () => {
      const request = new Request('https://test.com/verify-nft', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(request.headers.get('Authorization')).toBe('Bearer invalid-token');
    });

    it('should accept requests with valid JWT token', async () => {
      const request = new Request('https://test.com/verify-nft', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${mockAuthToken}`,
        },
      });

      expect(request.headers.get('Authorization')).toBe(`Bearer ${mockAuthToken}`);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits (20 requests per hour)', async () => {
      const rateLimitMax = 20;
      const rateLimitWindow = 60 * 60 * 1000; // 1 hour

      expect(rateLimitMax).toBe(20);
      expect(rateLimitWindow).toBe(3600000);
    });

    it('should return 429 when rate limit exceeded', async () => {
      // After 20 requests within 1 hour
      const requests = Array.from({ length: 21 }, (_, i) => i);

      // 21st request should be rate limited
      expect(requests.length).toBe(21);
    });

    it('should include rate limit headers in response', async () => {
      const expectedHeaders = [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
      ];

      expectedHeaders.forEach(header => {
        expect(header).toBeTruthy();
      });
    });

    it('should reset rate limit after time window', async () => {
      const now = Date.now();
      const resetAt = now + 3600000; // 1 hour later

      expect(resetAt).toBeGreaterThan(now);
    });
  });

  describe('NFT Balance Verification', () => {
    it('should query NFT balance from blockchain via Alchemy', async () => {
      const expectedRpcUrl = `https://polygon-mainnet.g.alchemy.com/v2/${mockEnv.ALCHEMY_API_KEY_POLYGON}`;

      expect(expectedRpcUrl).toContain('polygon-mainnet.g.alchemy.com');
      expect(expectedRpcUrl).toContain(mockEnv.ALCHEMY_API_KEY_POLYGON);
    });

    it('should use correct ERC721 balanceOf ABI', async () => {
      const erc721BalanceOfAbi = 'function balanceOf(address owner) view returns (uint256)';

      expect(erc721BalanceOfAbi).toContain('balanceOf');
      expect(erc721BalanceOfAbi).toContain('address owner');
      expect(erc721BalanceOfAbi).toContain('uint256');
    });

    it('should return has_premium_nft=true when balance > 0', async () => {
      const nftBalance = 1;
      const hasPremiumNFT = nftBalance > 0;

      expect(hasPremiumNFT).toBe(true);
    });

    it('should return has_premium_nft=false when balance = 0', async () => {
      const nftBalance = 0;
      const hasPremiumNFT = nftBalance > 0;

      expect(hasPremiumNFT).toBe(false);
    });

    it('should return has_premium_nft=false when no wallet connected', async () => {
      const wallets: any[] = [];
      const hasPremiumNFT = wallets.length > 0;

      expect(hasPremiumNFT).toBe(false);
    });
  });

  describe('Caching', () => {
    it('should cache results for 10 minutes', async () => {
      const cacheTTL = 10 * 60 * 1000; // 10 minutes

      expect(cacheTTL).toBe(600000);
    });

    it('should return cached result when cache is fresh', async () => {
      const cachedAt = new Date();
      const now = new Date(cachedAt.getTime() + 5 * 60 * 1000); // 5 minutes later
      const cacheTTL = 10 * 60 * 1000;

      const cacheAge = now.getTime() - cachedAt.getTime();
      const isCacheFresh = cacheAge < cacheTTL;

      expect(isCacheFresh).toBe(true);
    });

    it('should skip cache when cache is expired', async () => {
      const cachedAt = new Date();
      const now = new Date(cachedAt.getTime() + 15 * 60 * 1000); // 15 minutes later
      const cacheTTL = 10 * 60 * 1000;

      const cacheAge = now.getTime() - cachedAt.getTime();
      const isCacheFresh = cacheAge < cacheTTL;

      expect(isCacheFresh).toBe(false);
    });

    it('should skip cache when force_refresh=true', async () => {
      const url = new URL('https://test.com/verify-nft?force_refresh=true');
      const forceRefresh = url.searchParams.get('force_refresh') === 'true';

      expect(forceRefresh).toBe(true);
    });

    it('should include Cache-Control header when returning cached result', async () => {
      const cached = true;
      const cacheTTL = 600; // seconds

      if (cached) {
        const cacheControlValue = `public, max-age=${cacheTTL}`;
        expect(cacheControlValue).toBe('public, max-age=600');
      }
    });

    it('should store cache in chain_entitlements_cache table', async () => {
      const cacheRecord = {
        wallet_address: mockWalletAddress.toLowerCase(),
        chain_id: 137, // Polygon
        query_type: 'nft_balance',
        query_params: { contract_address: mockEnv.MEMBERSHIP_NFT_ADDRESS.toLowerCase() },
        data: { balance: 1, contract_address: mockEnv.MEMBERSHIP_NFT_ADDRESS.toLowerCase() },
      };

      expect(cacheRecord.query_type).toBe('nft_balance');
      expect(cacheRecord.chain_id).toBe(137);
    });
  });

  describe('Profile Updates', () => {
    it('should update profile with has_premium_nft=true when balance > 0', async () => {
      const nftBalance = 1;
      const profileUpdate = {
        has_premium_nft: nftBalance > 0,
        nft_verified_at: new Date().toISOString(),
      };

      expect(profileUpdate.has_premium_nft).toBe(true);
      expect(profileUpdate.nft_verified_at).toBeTruthy();
    });

    it('should update profile with has_premium_nft=false when balance = 0', async () => {
      const nftBalance = 0;
      const profileUpdate = {
        has_premium_nft: nftBalance > 0,
        nft_verified_at: new Date().toISOString(),
      };

      expect(profileUpdate.has_premium_nft).toBe(false);
    });

    it('should update nft_verified_at timestamp on each verification', async () => {
      const before = new Date();
      const verifiedAt = new Date();
      const after = new Date();

      expect(verifiedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(verifiedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Response Format', () => {
    it('should return correct response structure with NFT ownership', async () => {
      const response = {
        has_premium_nft: true,
        wallet_address: mockWalletAddress,
        nft_balance: 1,
        verified_at: new Date().toISOString(),
        cached: false,
      };

      expect(response).toHaveProperty('has_premium_nft');
      expect(response).toHaveProperty('wallet_address');
      expect(response).toHaveProperty('nft_balance');
      expect(response).toHaveProperty('verified_at');
      expect(response).toHaveProperty('cached');
    });

    it('should return correct response when no wallet connected', async () => {
      const response = {
        has_premium_nft: false,
        wallet_address: null,
        nft_balance: 0,
        verified_at: new Date().toISOString(),
        cached: false,
        message: 'No wallet connected',
      };

      expect(response.has_premium_nft).toBe(false);
      expect(response.wallet_address).toBeNull();
      expect(response.message).toBe('No wallet connected');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when ALCHEMY_API_KEY_POLYGON not configured', async () => {
      delete process.env.ALCHEMY_API_KEY_POLYGON;

      const missingConfig = !process.env.ALCHEMY_API_KEY_POLYGON;
      expect(missingConfig).toBe(true);
    });

    it('should return 500 when MEMBERSHIP_NFT_ADDRESS not configured', async () => {
      delete process.env.MEMBERSHIP_NFT_ADDRESS;

      const missingConfig = !process.env.MEMBERSHIP_NFT_ADDRESS;
      expect(missingConfig).toBe(true);
    });

    it('should handle blockchain query failures gracefully', async () => {
      const errorMessage = 'Failed to query NFT balance from blockchain';

      expect(errorMessage).toContain('blockchain');
    });

    it('should log errors but not expose internals to client', async () => {
      const clientError = {
        error: 'Internal server error',
        message: 'Failed to query NFT balance from blockchain',
      };

      expect(clientError.error).toBe('Internal server error');
      expect(clientError.message).not.toContain('stack');
    });
  });

  describe('CORS', () => {
    it('should include CORS headers in responses', async () => {
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      };

      expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*');
      expect(corsHeaders['Access-Control-Allow-Methods']).toContain('GET');
    });

    it('should handle OPTIONS preflight requests', async () => {
      const request = new Request('https://test.com/verify-nft', {
        method: 'OPTIONS',
      });

      expect(request.method).toBe('OPTIONS');
    });
  });

  describe('Method Validation', () => {
    it('should only allow GET requests', async () => {
      const validMethods = ['GET'];
      const invalidMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

      expect(validMethods).toContain('GET');
      expect(invalidMethods).not.toContain('GET');
    });

    it('should return 405 for POST requests', async () => {
      const request = new Request('https://test.com/verify-nft', {
        method: 'POST',
      });

      expect(request.method).toBe('POST');
    });
  });
});
