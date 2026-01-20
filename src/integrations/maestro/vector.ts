/**
 * MAESTRO Vector Utilities
 * 
 * Mathematical operations for semantic search.
 * Runs on the main thread for now, but heavy lifting should move to worker if scaling.
 */

export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function rank(queryVector: number[], candidates: { id: string; vector: number[] }[]): { id: string; score: number }[] {
    return candidates
        .map(candidate => ({
            id: candidate.id,
            score: cosineSimilarity(queryVector, candidate.vector)
        }))
        .sort((a, b) => b.score - a.score);
}
