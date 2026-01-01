/**
 * Wallet Integration Tests
 *
 * Purpose: Integration tests for wallet connection and verification flow
 *
 * Author: OmniLink APEX
 * Date: 2026-01-01
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletConnect } from '@/components/WalletConnect';
import { Web3Provider } from '@/providers/Web3Provider';

// Mock wagmi hooks
vi.mock('wagmi', async () => {
  const actual = await vi.importActual('wagmi');
  return {
    ...actual,
    useConnect: vi.fn(),
    useAccount: vi.fn(),
    useSignMessage: vi.fn(),
    useDisconnect: vi.fn(),
    WagmiProvider: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  };
});

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

// Mock monitoring
vi.mock('@/lib/monitoring', () => ({
  logError: vi.fn(),
  logAnalyticsEvent: vi.fn(),
}));

import { useConnect, useAccount, useSignMessage, useDisconnect } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';

describe('Wallet Integration Flow', () => {
  const mockAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
  const mockSignature =
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(useConnect).mockReturnValue({
      connectors: [{ id: 'injected', name: 'MetaMask' }] as any,
      connect: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useDisconnect).mockReturnValue({
      disconnect: vi.fn(),
    } as any);

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'user123' }, access_token: 'token123' } },
      error: null,
    } as any);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Wallet Connection', () => {
    it('should display connect button when disconnected', () => {
      vi.mocked(useAccount).mockReturnValue({
        address: undefined,
        isConnected: false,
        chainId: undefined,
      } as any);

      render(
        <Web3Provider>
          <WalletConnect />
        </Web3Provider>
      );

      expect(screen.getByText(/Connect MetaMask/i)).toBeInTheDocument();
    });

    it('should show connected state after connection', async () => {
      vi.mocked(useAccount).mockReturnValue({
        address: mockAddress,
        isConnected: true,
        chainId: 1,
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as any);

      render(
        <Web3Provider>
          <WalletConnect />
        </Web3Provider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Connected/i)).toBeInTheDocument();
      });
    });
  });

  describe('Wallet Verification', () => {
    it('should complete verification flow successfully', async () => {
      const user = userEvent.setup();

      vi.mocked(useAccount).mockReturnValue({
        address: mockAddress,
        isConnected: true,
        chainId: 1,
      } as any);

      vi.mocked(useSignMessage).mockReturnValue({
        signMessageAsync: vi.fn().mockResolvedValue(mockSignature),
      } as any);

      // Mock nonce request
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('web3-nonce')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                nonce: 'abc123',
                expires_at: new Date(Date.now() + 300000).toISOString(),
                message: 'Sign this message',
                wallet_address: mockAddress.toLowerCase(),
                reused: false,
              }),
          });
        }
        if (url.includes('web3-verify')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                wallet_identity_id: 'identity123',
                wallet_address: mockAddress.toLowerCase(),
                chain_id: 1,
                verified_at: new Date().toISOString(),
              }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis(),
      } as any);

      render(
        <Web3Provider>
          <WalletConnect />
        </Web3Provider>
      );

      // Wait for connected state
      await waitFor(() => {
        expect(screen.getByText(/Verify Wallet/i)).toBeInTheDocument();
      });

      // Click verify button
      const verifyButton = screen.getByText(/Verify Wallet/i);
      await user.click(verifyButton);

      // Should show verifying state
      await waitFor(() => {
        expect(screen.getByText(/Verifying/i)).toBeInTheDocument();
      });

      // Should eventually show verified state
      await waitFor(
        () => {
          expect(screen.getByText(/Wallet Verified/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should handle verification errors', async () => {
      const user = userEvent.setup();

      vi.mocked(useAccount).mockReturnValue({
        address: mockAddress,
        isConnected: true,
        chainId: 1,
      } as any);

      vi.mocked(useSignMessage).mockReturnValue({
        signMessageAsync: vi.fn().mockRejectedValue(new Error('User rejected signature')),
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            nonce: 'abc123',
            expires_at: new Date(Date.now() + 300000).toISOString(),
            message: 'Sign this message',
            wallet_address: mockAddress.toLowerCase(),
          }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as any);

      render(
        <Web3Provider>
          <WalletConnect />
        </Web3Provider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Verify Wallet/i)).toBeInTheDocument();
      });

      const verifyButton = screen.getByText(/Verify Wallet/i);
      await user.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText(/User rejected signature/i)).toBeInTheDocument();
      });
    });
  });

  describe('Verified State Persistence', () => {
    it('should auto-verify if wallet already verified', async () => {
      vi.mocked(useAccount).mockReturnValue({
        address: mockAddress,
        isConnected: true,
        chainId: 1,
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'identity123',
            wallet_address: mockAddress.toLowerCase(),
            verified_at: new Date().toISOString(),
          },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
      } as any);

      render(
        <Web3Provider>
          <WalletConnect />
        </Web3Provider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Wallet Verified/i)).toBeInTheDocument();
      });
    });
  });

  describe('Disconnect Flow', () => {
    it('should disconnect wallet and reset state', async () => {
      const user = userEvent.setup();
      const mockDisconnect = vi.fn();

      vi.mocked(useAccount).mockReturnValue({
        address: mockAddress,
        isConnected: true,
        chainId: 1,
      } as any);

      vi.mocked(useDisconnect).mockReturnValue({
        disconnect: mockDisconnect,
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'identity123',
            wallet_address: mockAddress.toLowerCase(),
          },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
      } as any);

      render(
        <Web3Provider>
          <WalletConnect />
        </Web3Provider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Disconnect Wallet/i)).toBeInTheDocument();
      });

      const disconnectButton = screen.getByText(/Disconnect Wallet/i);
      await user.click(disconnectButton);

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});
