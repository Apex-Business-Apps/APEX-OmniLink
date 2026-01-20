/**
 * MAESTRO E2EE (End-to-End Encryption) Tests
 *
 * Tests for encryption, decryption, and key management.
 */

import { describe, it, expect } from 'vitest';

// Mock crypto utilities
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

async function mockGenerateKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

async function mockEncrypt(
  data: string,
  key: CryptoKey
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = textEncoder.encode(data);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return { ciphertext, iv };
}

async function mockDecrypt(
  ciphertext: ArrayBuffer,
  iv: Uint8Array,
  key: CryptoKey
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return textDecoder.decode(decrypted);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCodePoint(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

describe('MAESTRO E2EE Tests', () => {
  describe('Key Generation', () => {
    it('should generate a valid AES-GCM key', async () => {
      const key = await mockGenerateKey();
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('should generate unique keys', async () => {
      const key1 = await mockGenerateKey();
      const key2 = await mockGenerateKey();

      const exported1 = await crypto.subtle.exportKey('raw', key1);
      const exported2 = await crypto.subtle.exportKey('raw', key2);

      expect(arrayBufferToBase64(exported1)).not.toBe(arrayBufferToBase64(exported2));
    });

    it('should generate keys with correct length', async () => {
      const key = await mockGenerateKey();
      const exported = await crypto.subtle.exportKey('raw', key);
      expect(exported.byteLength).toBe(32); // 256 bits = 32 bytes
    });
  });

  describe('Encryption', () => {
    it('should encrypt plaintext', async () => {
      const key = await mockGenerateKey();
      const plaintext = 'Secret message';

      const { ciphertext, iv } = await mockEncrypt(plaintext, key);

      expect(ciphertext.byteLength).toBeGreaterThan(0);
      expect(iv.byteLength).toBe(12);
    });

    it('should produce different ciphertext for same input', async () => {
      const key = await mockGenerateKey();
      const plaintext = 'Same message';

      const result1 = await mockEncrypt(plaintext, key);
      const result2 = await mockEncrypt(plaintext, key);

      // Different IVs should produce different ciphertext
      expect(arrayBufferToBase64(result1.ciphertext))
        .not.toBe(arrayBufferToBase64(result2.ciphertext));
    });

    it('should handle empty string', async () => {
      const key = await mockGenerateKey();
      const { ciphertext } = await mockEncrypt('', key);
      expect(ciphertext.byteLength).toBeGreaterThan(0); // GCM adds auth tag
    });

    it('should handle long input', async () => {
      const key = await mockGenerateKey();
      const longText = 'a'.repeat(10000);
      const { ciphertext } = await mockEncrypt(longText, key);
      expect(ciphertext.byteLength).toBeGreaterThan(longText.length);
    });
  });

  describe('Decryption', () => {
    it('should decrypt ciphertext correctly', async () => {
      const key = await mockGenerateKey();
      const original = 'Hello, encrypted world!';

      const { ciphertext, iv } = await mockEncrypt(original, key);
      const decrypted = await mockDecrypt(ciphertext, iv, key);

      expect(decrypted).toBe(original);
    });

    it('should fail with wrong key', async () => {
      const key1 = await mockGenerateKey();
      const key2 = await mockGenerateKey();
      const plaintext = 'Secret';

      const { ciphertext, iv } = await mockEncrypt(plaintext, key1);

      await expect(mockDecrypt(ciphertext, iv, key2)).rejects.toThrow();
    });

    it('should fail with wrong IV', async () => {
      const key = await mockGenerateKey();
      const plaintext = 'Secret';

      const { ciphertext } = await mockEncrypt(plaintext, key);
      const wrongIv = crypto.getRandomValues(new Uint8Array(12));

      await expect(mockDecrypt(ciphertext, wrongIv, key)).rejects.toThrow();
    });

    it('should fail with tampered ciphertext', async () => {
      const key = await mockGenerateKey();
      const plaintext = 'Secret';

      const { ciphertext, iv } = await mockEncrypt(plaintext, key);

      // Tamper with ciphertext
      const tampered = new Uint8Array(ciphertext);
      tampered[0] ^= 0xff;

      await expect(mockDecrypt(tampered.buffer, iv, key)).rejects.toThrow();
    });
  });

  describe('Base64 Encoding', () => {
    it('should encode and decode correctly', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5, 255, 0, 128]);
      const base64 = arrayBufferToBase64(original.buffer);
      const decoded = new Uint8Array(base64ToArrayBuffer(base64));

      expect(Array.from(decoded)).toEqual(Array.from(original));
    });

    it('should handle empty buffer', () => {
      const empty = new Uint8Array(0);
      const base64 = arrayBufferToBase64(empty.buffer);
      const decoded = base64ToArrayBuffer(base64);

      expect(decoded.byteLength).toBe(0);
    });
  });

  describe('Round Trip', () => {
    it('should preserve data through full encryption cycle', async () => {
      const key = await mockGenerateKey();
      const testCases = [
        'Simple text',
        'Unicode: 你好世界 🎉',
        'Special chars: !@#$%^&*()',
        'Numbers: 12345.67890',
        'Empty line:\n\nEnd',
      ];

      for (const original of testCases) {
        const { ciphertext, iv } = await mockEncrypt(original, key);
        const decrypted = await mockDecrypt(ciphertext, iv, key);
        expect(decrypted).toBe(original);
      }
    });
  });
});
