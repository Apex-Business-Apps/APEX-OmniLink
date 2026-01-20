/**
 * MAESTRO Tiered Memory System
 * 
 * Implements local-first storage tiers using IndexedDB.
 * T1: Core (Stable Facts) - Trusted writes only.
 * T2: Working (Short-term) - TTL based.
 * T3: Episodic (Timeline) - Append only.
 * T4: Semantic (Embeddings) - Vector store.
 * T5: Procedural (Recipes) - Provenance tracking.
 */

import { CryptoProvider, Ciphertext } from './crypto';
import { cosineSimilarity } from './vector';

// Basic IndexedDB wrapper since we can't assume 'idb' package is installed yet.
// If 'idb' is added to package.json later, we can refactor.
// For now, raw IDB is safer to avoid dependency issues during this step.

const DB_NAME = 'maestro_memory_v1';
const STORES = ['t1_core', 't2_working', 't3_episodic', 't4_semantic', 't5_procedural'] as const;
type StoreName = typeof STORES[number];

export interface MemoryEntry {
    key: string;
    value: Ciphertext;
    embedding?: number[]; // Unencrypted local index for search
    metadata: {
        tenantId: string;
        locale: string;
        timestamp: number;
        ttl?: number;
        tags: string[];
    };
}

export class TieredMemory {
    private db: IDBDatabase | null = null;
    private readonly version = 2; // Bump version for potential schema changes

    constructor(private crypto: CryptoProvider) { }

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, this.version);

            request.onerror = () => reject(request.error);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                STORES.forEach(storeName => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        db.createObjectStore(storeName, { keyPath: 'key' });
                    }
                });
            };

            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                resolve();
            };
        });
    }

    async put(tier: StoreName, key: string, data: unknown, metadata: Omit<MemoryEntry['metadata'], 'timestamp'>, embedding?: number[]): Promise<void> {
        if (!this.db) await this.init();

        // Encrypt before storage
        const encryptedValue = await this.crypto.encrypt(data);

        const entry: MemoryEntry = {
            key,
            value: encryptedValue,
            embedding,
            metadata: {
                ...metadata,
                timestamp: Date.now(),
            }
        };

        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('DB not initialized'));

            const transaction = this.db.transaction([tier], 'readwrite');
            const store = transaction.objectStore(tier);
            const request = store.put(entry);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async get<T>(tier: StoreName, key: string): Promise<T | null> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('DB not initialized'));

            const transaction = this.db.transaction([tier], 'readonly');
            const store = transaction.objectStore(tier);
            const request = store.get(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = async () => {
                const entry = request.result as MemoryEntry | undefined;
                if (!entry) {
                    resolve(null);
                    return;
                }

                try {
                    // Decrypt on retrieval
                    const data = await this.crypto.decrypt<T>(entry.value);
                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            };
        });
    }

    /**
     * Semantic search using local cosine similarity scan.
     */
    async search(tier: StoreName, queryEmbedding: number[], limit = 5): Promise<{ key: string; score: number }[]> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('DB not initialized'));

            const transaction = this.db.transaction([tier], 'readonly');
            const store = transaction.objectStore(tier);
            const request = store.openCursor();

            const candidates: { key: string; score: number }[] = [];

            request.onerror = () => reject(request.error);
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
                if (cursor) {
                    const entry = cursor.value as MemoryEntry;
                    if (entry.embedding) {
                        const score = cosineSimilarity(queryEmbedding, entry.embedding);
                        candidates.push({ key: entry.key, score });
                    }
                    cursor.continue();
                } else {
                    // Finished iterating
                    // Sort descending by score
                    candidates.sort((a, b) => b.score - a.score);
                    resolve(candidates.slice(0, limit));
                }
            };
        });
    }
}
