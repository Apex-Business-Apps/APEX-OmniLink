/**
 * Web3 Type Definitions
 *
 * Purpose: Centralized type definitions for Web3 verification module
 *
 * Author: OmniLink APEX
 * Date: 2026-01-01
 */

export interface WalletIdentity {
  id: string;
  user_id: string;
  wallet_address: string;
  chain_id: number;
  signature: string;
  message: string;
  verified_at: string;
  last_used_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface NonceResponse {
  nonce: string;
  expires_at: string;
  message: string;
  wallet_address: string;
  chain_id: number;
  reused: boolean;
}

export interface VerifyResponse {
  success: boolean;
  wallet_identity_id: string;
  wallet_address: string;
  chain_id: number;
  verified_at: string;
}

export interface Web3Error {
  error: string;
  message: string;
  retry_after?: number;
}

export type WalletConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'verifying'
  | 'verified'
  | 'error';

export interface WalletState {
  status: WalletConnectionStatus;
  address?: string;
  chainId?: number;
  walletIdentityId?: string;
  error?: string;
  isVerified: boolean;
}
