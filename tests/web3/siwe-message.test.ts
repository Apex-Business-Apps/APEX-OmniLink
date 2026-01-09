/**
 * SIWE Message Unit Tests
 *
 * Purpose: Validate SIWE message generation and validation logic
 *
 * Author: OmniLink APEX
 * Date: 2026-01-09
 */

import { describe, it, expect } from 'vitest';
import { createSiweMessage, parseSiweMessage, validateSiweMessage } from 'viem/siwe';

describe('SIWE Message Utilities', () => {
  const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0' as const;
  const chainId = 137;
  const domain = 'demo.omnihub.dev';
  const uri = 'https://demo.omnihub.dev';
  const nonce = 'abcdef1234';
  const issuedAt = new Date('2026-01-09T00:00:00.000Z');
  const expirationTime = new Date('2026-01-09T00:05:00.000Z');

  it('creates SIWE message with required fields', () => {
    const message = createSiweMessage({
      address,
      chainId,
      domain,
      nonce,
      uri,
      version: '1',
      statement: 'Sign in to OmniLink APEX.',
      issuedAt,
      expirationTime,
    });

    const parsed = parseSiweMessage(message);
    expect(parsed.domain).toBe(domain);
    expect(parsed.uri).toBe(uri);
    expect(parsed.nonce).toBe(nonce);
    expect(parsed.chainId).toBe(chainId);
    expect(parsed.issuedAt?.toISOString()).toBe(issuedAt.toISOString());
    expect(parsed.expirationTime?.toISOString()).toBe(expirationTime.toISOString());
  });

  it('rejects SIWE message with wrong domain', () => {
    const message = createSiweMessage({
      address,
      chainId,
      domain,
      nonce,
      uri,
      version: '1',
      issuedAt,
      expirationTime,
    });

    const parsed = parseSiweMessage(message);
    const isValid = validateSiweMessage({
      message: parsed,
      address,
      domain: 'wrong.omnihub.dev',
      nonce,
      time: new Date('2026-01-09T00:01:00.000Z'),
    });

    expect(isValid).toBe(false);
  });

  it('rejects SIWE message with wrong nonce', () => {
    const message = createSiweMessage({
      address,
      chainId,
      domain,
      nonce,
      uri,
      version: '1',
      issuedAt,
      expirationTime,
    });

    const parsed = parseSiweMessage(message);
    const isValid = validateSiweMessage({
      message: parsed,
      address,
      domain,
      nonce: 'badnonce123',
      time: new Date('2026-01-09T00:01:00.000Z'),
    });

    expect(isValid).toBe(false);
  });

  it('rejects SIWE message after expiration', () => {
    const message = createSiweMessage({
      address,
      chainId,
      domain,
      nonce,
      uri,
      version: '1',
      issuedAt,
      expirationTime,
    });

    const parsed = parseSiweMessage(message);
    const isValid = validateSiweMessage({
      message: parsed,
      address,
      domain,
      nonce,
      time: new Date('2026-01-09T00:06:00.000Z'),
    });

    expect(isValid).toBe(false);
  });
});
