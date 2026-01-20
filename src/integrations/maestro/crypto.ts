/**
 * MAESTRO Crypto Provider Types
 *
 * Abstraction for encryption operations to enable testing.
 */

/**
 * Ciphertext structure
 */
export interface Ciphertext {
  iv: Uint8Array;
  data: Uint8Array;
  version: number;
}

/**
 * Crypto provider interface for dependency injection
 */
export interface CryptoProvider {
  init(): Promise<void>;
  encrypt(data: unknown): Promise<Ciphertext>;
  decrypt<T>(ciphertext: Ciphertext): Promise<T>;
  randomUUID(): string;
}
