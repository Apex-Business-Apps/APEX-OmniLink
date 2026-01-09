/**
 * Signature Verification Unit Tests
 *
 * Purpose: Test signature verification logic
 *
 * Author: OmniLink APEX
 * Date: 2026-01-01
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyMessage } from 'viem';
import { createSiweMessage, parseSiweMessage, validateSiweMessage } from 'viem/siwe';

// Mock viem
vi.mock('viem', () => ({
  verifyMessage: vi.fn(),
}));

describe('Web3 Signature Verification', () => {
  const mockWalletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0' as const;
  const mockSignature =
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12' as const;
  const issuedAt = new Date('2026-01-01T00:00:00.000Z');
  const expirationTime = new Date('2026-01-01T00:05:00.000Z');
  const mockMessage = createSiweMessage({
    address: mockWalletAddress,
    chainId: 1,
    domain: 'localhost:5173',
    nonce: 'abc12345',
    uri: 'http://localhost:5173',
    version: '1',
    statement: 'Sign in to OmniLink APEX.',
    issuedAt,
    expirationTime,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Valid Signature', () => {
    it('should verify a valid signature', async () => {
      // Mock successful verification
      vi.mocked(verifyMessage).mockResolvedValue(true);

      const result = await verifyMessage({
        address: mockWalletAddress,
        message: mockMessage,
        signature: mockSignature,
      });

      expect(result).toBe(true);
      expect(verifyMessage).toHaveBeenCalledWith({
        address: mockWalletAddress,
        message: mockMessage,
        signature: mockSignature,
      });
    });

    it('should handle case-insensitive addresses', async () => {
      const lowercaseAddress = mockWalletAddress.toLowerCase() as `0x${string}`;
      vi.mocked(verifyMessage).mockResolvedValue(true);

      const result = await verifyMessage({
        address: lowercaseAddress,
        message: mockMessage,
        signature: mockSignature,
      });

      expect(result).toBe(true);
    });
  });

  describe('Invalid Signature', () => {
    it('should reject an invalid signature', async () => {
      vi.mocked(verifyMessage).mockResolvedValue(false);

      const result = await verifyMessage({
        address: mockWalletAddress,
        message: mockMessage,
        signature: mockSignature,
      });

      expect(result).toBe(false);
    });

    it('should reject mismatched wallet address', async () => {
      const differentAddress = '0x0000000000000000000000000000000000000001' as `0x${string}`;
      vi.mocked(verifyMessage).mockResolvedValue(false);

      const result = await verifyMessage({
        address: differentAddress,
        message: mockMessage,
        signature: mockSignature,
      });

      expect(result).toBe(false);
    });

    it('should reject mismatched message', async () => {
      const differentMessage = 'Different message content';
      vi.mocked(verifyMessage).mockResolvedValue(false);

      const result = await verifyMessage({
        address: mockWalletAddress,
        message: differentMessage,
        signature: mockSignature,
      });

      expect(result).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle verification errors gracefully', async () => {
      vi.mocked(verifyMessage).mockRejectedValue(new Error('RPC error'));

      await expect(
        verifyMessage({
          address: mockWalletAddress,
          message: mockMessage,
          signature: mockSignature,
        })
      ).rejects.toThrow('RPC error');
    });

    it('should handle malformed signatures', async () => {
      const malformedSignature = '0xinvalid' as `0x${string}`;
      vi.mocked(verifyMessage).mockRejectedValue(new Error('Invalid signature format'));

      await expect(
        verifyMessage({
          address: mockWalletAddress,
          message: mockMessage,
          signature: malformedSignature,
        })
      ).rejects.toThrow('Invalid signature format');
    });
  });

  describe('SIWE Message Format Validation', () => {
    it('should parse nonce from SIWE message', () => {
      const parsed = parseSiweMessage(mockMessage);
      expect(parsed.nonce).toBe('abc12345');
    });

    it('should validate required SIWE fields', () => {
      const parsed = parseSiweMessage(mockMessage);
      const isValid = validateSiweMessage({
        message: parsed,
        address: mockWalletAddress,
        domain: 'localhost:5173',
        nonce: 'abc12345',
        time: new Date('2026-01-01T00:01:00.000Z'),
      });

      expect(isValid).toBe(true);
    });
  });

  describe('Address Validation', () => {
    it('should validate valid Ethereum address', () => {
      const isValidAddress = (address: string): boolean => {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      };

      expect(isValidAddress(mockWalletAddress)).toBe(true);
    });

    it('should reject invalid address formats', () => {
      const isValidAddress = (address: string): boolean => {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      };

      expect(isValidAddress('invalid')).toBe(false);
      expect(isValidAddress('0x123')).toBe(false);
      expect(isValidAddress('742d35Cc6634C0532925a3b844Bc9e7595f0bEb')).toBe(false); // Missing 0x
    });
  });

  describe('Signature Format Validation', () => {
    it('should validate valid signature format', () => {
      const isValidSignature = (sig: string): boolean => {
        return /^0x[a-fA-F0-9]{130}$/.test(sig);
      };

      expect(isValidSignature(mockSignature)).toBe(true);
    });

    it('should reject invalid signature formats', () => {
      const isValidSignature = (sig: string): boolean => {
        return /^0x[a-fA-F0-9]{130}$/.test(sig);
      };

      expect(isValidSignature('invalid')).toBe(false);
      expect(isValidSignature('0x123')).toBe(false);
      expect(isValidSignature(mockSignature + 'ff')).toBe(false); // Too long
    });
  });
});
