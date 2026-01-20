/**
 * MAESTRO WebCrypto Implementation
 * 
 * rigorous E2EE using AES-GCM.
 * Keys are non-exportable by default for security.
 */

export interface Ciphertext {
    iv: Uint8Array;
    data: Uint8Array;
    version: number;
}

export interface CryptoProvider {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    encrypt(data: any): Promise<Ciphertext>;
    decrypt<T>(data: Ciphertext): Promise<T>;
    init(): Promise<void>;
    randomUUID(): string;
}

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const KEY_USAGE: KeyUsage[] = ['encrypt', 'decrypt'];

export class WebCryptoProvider implements CryptoProvider {
    private key: CryptoKey | null = null;
    private readonly version = 1;

    async init(): Promise<void> {
        if (this.key) return;

        // In a real scenario, this would load from a secure non-exportable storage (IndexedDB)
        // or derive from a user secret. For now, we generate a session key.
        // TODO: persist key in IDB 'secrets' store.
        this.key = await window.crypto.subtle.generateKey(
            {
                name: ALGORITHM,
                length: KEY_LENGTH,
            },
            false, // extractable
            KEY_USAGE
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async encrypt(data: any): Promise<Ciphertext> {
        if (!this.key) await this.init();
        if (!this.key) throw new Error('Crypto initialization failed');

        const encoder = new TextEncoder();
        const encodedData = encoder.encode(JSON.stringify(data));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        const encryptedContent = await window.crypto.subtle.encrypt(
            {
                name: ALGORITHM,
                iv,
            },
            this.key,
            encodedData
        );

        return {
            iv,
            data: new Uint8Array(encryptedContent),
            version: this.version,
        };
    }

    async decrypt<T>(ciphertext: Ciphertext): Promise<T> {
        if (!this.key) await this.init();
        if (!this.key) throw new Error('Crypto initialization failed');

        const decryptedContent = await window.crypto.subtle.decrypt(
            {
                name: ALGORITHM,
                iv: ciphertext.iv,
            },
            this.key,
            ciphertext.data as BufferSource
        );

        const decoder = new TextDecoder();
        const jsonString = decoder.decode(decryptedContent);
        return JSON.parse(jsonString) as T;
    }

    randomUUID(): string {
        return self.crypto.randomUUID();
    }
}
