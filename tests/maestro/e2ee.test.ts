/**
 * MAESTRO E2EE Tests
 *
 * Tests for encryption/decryption and key derivation
 */

import { describe, it, expect } from 'vitest';
import {
  generateEncryptionKey,
  deriveKeyFromPassphrase,
  generateSalt,
  encryptMemory,
  decryptMemory,
  computeContentHash,
  exportKey,
  importKey,
  createPassphraseVerifier,
  verifyPassphrase,
} from '@/lib/security';

describe('MAESTRO E2EE', () => {
  describe('generateEncryptionKey', () => {
    it('should generate an AES-GCM key', async () => {
      const key = await generateEncryptionKey();
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
    });
  });

  describe('deriveKeyFromPassphrase', () => {
    it('should derive a key from passphrase using PBKDF2', async () => {
      const passphrase = 'test-passphrase-12345';
      const salt = generateSalt();

      const key = await deriveKeyFromPassphrase(passphrase, salt);
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('should derive the same key from same passphrase and salt', async () => {
      const passphrase = 'test-passphrase-12345';
      const salt = generateSalt();

      const key1 = await deriveKeyFromPassphrase(passphrase, salt);
      const key2 = await deriveKeyFromPassphrase(passphrase, salt);

      const key1Data = await exportKey(key1);
      const key2Data = await exportKey(key2);

      const key1Array = new Uint8Array(key1Data);
      const key2Array = new Uint8Array(key2Data);

      expect(key1Array).toEqual(key2Array);
    });

    it('should derive different keys from different salts', async () => {
      const passphrase = 'test-passphrase-12345';
      const salt1 = generateSalt();
      const salt2 = generateSalt();

      const key1 = await deriveKeyFromPassphrase(passphrase, salt1);
      const key2 = await deriveKeyFromPassphrase(passphrase, salt2);

      const key1Data = await exportKey(key1);
      const key2Data = await exportKey(key2);

      const key1Array = new Uint8Array(key1Data);
      const key2Array = new Uint8Array(key2Data);

      expect(key1Array).not.toEqual(key2Array);
    });
  });

  describe('encryptMemory and decryptMemory', () => {
    it('should encrypt and decrypt content', async () => {
      const key = await generateEncryptionKey();
      const plaintext = 'This is sensitive memory content';

      const ciphertext = await encryptMemory(plaintext, key);
      expect(ciphertext).toBeDefined();
      expect(ciphertext).not.toBe(plaintext);

      const decrypted = await decryptMemory(ciphertext, key);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', async () => {
      const key = await generateEncryptionKey();
      const plaintext = 'Test content';

      const ciphertext1 = await encryptMemory(plaintext, key);
      const ciphertext2 = await encryptMemory(plaintext, key);

      expect(ciphertext1).not.toBe(ciphertext2); // Different IVs
      expect(await decryptMemory(ciphertext1, key)).toBe(plaintext);
      expect(await decryptMemory(ciphertext2, key)).toBe(plaintext);
    });

    it('should fail to decrypt with wrong key', async () => {
      const key1 = await generateEncryptionKey();
      const key2 = await generateEncryptionKey();
      const plaintext = 'Secret content';

      const ciphertext = await encryptMemory(plaintext, key1);

      await expect(decryptMemory(ciphertext, key2)).rejects.toThrow();
    });
  });

  describe('computeContentHash', () => {
    it('should compute SHA-256 hash', async () => {
      const content = 'Test content';
      const hash = await computeContentHash(content);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA-256 hex = 64 characters
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce same hash for same content', async () => {
      const content = 'Test content';
      const hash1 = await computeContentHash(content);
      const hash2 = await computeContentHash(content);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different content', async () => {
      const content1 = 'Test content 1';
      const content2 = 'Test content 2';
      const hash1 = await computeContentHash(content1);
      const hash2 = await computeContentHash(content2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('exportKey and importKey', () => {
    it('should export and import key', async () => {
      const key1 = await generateEncryptionKey();
      const exported = await exportKey(key1);
      const key2 = await importKey(exported);

      const plaintext = 'Test content';
      const ciphertext = await encryptMemory(plaintext, key1);
      const decrypted = await decryptMemory(ciphertext, key2);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('passphrase verifier', () => {
    it('should create and verify passphrase', async () => {
      const passphrase = 'my-secure-passphrase';
      const salt = generateSalt();

      const verifier = await createPassphraseVerifier(passphrase, salt);
      expect(verifier).toBeDefined();
      expect(verifier.length).toBe(64); // 32 bytes hex-encoded

      const isValid = await verifyPassphrase(passphrase, salt, verifier);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect passphrase', async () => {
      const correctPassphrase = 'my-secure-passphrase';
      const incorrectPassphrase = 'wrong-passphrase';
      const salt = generateSalt();

      const verifier = await createPassphraseVerifier(correctPassphrase, salt);

      const isValid = await verifyPassphrase(incorrectPassphrase, salt, verifier);
      expect(isValid).toBe(false);
    });
  });
});
