/**
 * Wallet Verification Hook
 *
 * Purpose: React hook for wallet connection and signature verification
 *
 * Features:
 *   - Connect wallet via wagmi
 *   - Request nonce from edge function
 *   - Sign message with wallet
 *   - Verify signature on backend
 *   - Track verification status
 *
 * Author: OmniLink APEX
 * Date: 2026-01-01
 */

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useSignMessage, useDisconnect } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { logError, logAnalyticsEvent } from '@/lib/monitoring';
import type { WalletState, NonceResponse, VerifyResponse, Web3Error } from '@/lib/web3/types';

export function useWalletVerification() {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();

  const [walletState, setWalletState] = useState<WalletState>({
    status: 'disconnected',
    isVerified: false,
  });

  // Check if wallet is already verified on mount
  useEffect(() => {
    if (address && isConnected) {
      checkVerificationStatus(address);
    } else {
      setWalletState({
        status: 'disconnected',
        isVerified: false,
      });
    }
  }, [address, isConnected]);

  /**
   * Check if wallet is already verified
   */
  const checkVerificationStatus = async (walletAddress: string) => {
    const resolvedChainId = chainId ?? 1;
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        setWalletState((prev) => ({ ...prev, status: 'connected', isVerified: false }));
        return;
      }

      const { data, error } = await supabase
        .from('wallet_identities')
        .select('*')
        .eq('wallet_address', walletAddress.toLowerCase())
        .eq('chain_id', resolvedChainId)
        .eq('user_id', session.session.user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking verification status:', error);
        setWalletState({
          status: 'connected',
          address: walletAddress,
          chainId: resolvedChainId,
          isVerified: false,
        });
        return;
      }

      if (data) {
        // Update last_used_at
        await supabase
          .from('wallet_identities')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', data.id);

        setWalletState({
          status: 'verified',
          address: walletAddress,
          chainId: resolvedChainId,
          walletIdentityId: data.id,
          isVerified: true,
        });

        await logAnalyticsEvent('wallet_auto_verified', {
          wallet: walletAddress,
          chainId: resolvedChainId,
        });
      } else {
        setWalletState({
          status: 'connected',
          address: walletAddress,
          chainId: resolvedChainId,
          isVerified: false,
        });
      }
    } catch (error) {
      console.error('Error checking verification:', error);
      setWalletState({
        status: 'connected',
        address: walletAddress,
        chainId: resolvedChainId,
        isVerified: false,
      });
    }
  };

  /**
   * Request nonce from backend
   */
  const requestNonce = async (walletAddress: string): Promise<NonceResponse> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const resolvedChainId = chainId ?? 1;
    const response = await fetch(`${supabaseUrl}/functions/v1/web3-nonce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wallet_address: walletAddress,
        chain_id: resolvedChainId,
        domain: window.location.host,
        uri: window.location.origin,
      }),
    });

    if (!response.ok) {
      const error: Web3Error = await response.json();
      throw new Error(error.message || 'Failed to request nonce');
    }

    return response.json();
  };

  /**
   * Verify signed message on backend
   */
  const verifySignature = async (
    walletAddress: string,
    signature: string,
    message: string
  ): Promise<VerifyResponse> => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) {
      throw new Error('Authentication required');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const resolvedChainId = chainId ?? 1;
    const response = await fetch(`${supabaseUrl}/functions/v1/web3-verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.session.access_token}`,
      },
      body: JSON.stringify({
        wallet_address: walletAddress,
        signature,
        message,
        chain_id: resolvedChainId,
      }),
    });

    if (!response.ok) {
      const error: Web3Error = await response.json();
      throw new Error(error.message || 'Verification failed');
    }

    return response.json();
  };

  /**
   * Main verification flow
   */
  const verify = useCallback(async () => {
    if (!address || !isConnected) {
      setWalletState((prev) => ({
        ...prev,
        status: 'error',
        error: 'Wallet not connected',
      }));
      return;
    }

    try {
      setWalletState((prev) => ({ ...prev, status: 'verifying', error: undefined }));

      // Step 1: Request nonce
      await logAnalyticsEvent('wallet_verify_started', { wallet: address });
      const nonceResponse = await requestNonce(address);

      // Step 2: Sign message
      const signature = await signMessageAsync({
        message: nonceResponse.message,
      });

      // Step 3: Verify signature on backend
      const verifyResponse = await verifySignature(address, signature, nonceResponse.message);

      // Step 4: Update state
      setWalletState({
        status: 'verified',
        address,
        chainId,
        walletIdentityId: verifyResponse.wallet_identity_id,
        isVerified: true,
        error: undefined,
      });

      await logAnalyticsEvent('wallet_verified', {
        wallet: address,
        chainId,
        walletIdentityId: verifyResponse.wallet_identity_id,
      });
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('Verification error:', error);

      await logError(error as Error, {
        wallet: address,
        chainId,
        action: 'wallet_verification',
      });

      setWalletState((prev) => ({
        ...prev,
        status: 'error',
        error: errorMessage,
        isVerified: false,
      }));
    }
  }, [address, isConnected, chainId, signMessageAsync]);

  /**
   * Disconnect wallet
   */
  const handleDisconnect = useCallback(() => {
    disconnect();
    setWalletState({
      status: 'disconnected',
      isVerified: false,
    });
  }, [disconnect]);

  return {
    walletState,
    verify,
    disconnect: handleDisconnect,
    address,
    isConnected,
    chainId,
  };
}
