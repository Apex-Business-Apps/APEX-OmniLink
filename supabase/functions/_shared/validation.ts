/**
 * Shared Validation Utilities for Supabase Edge Functions
 *
 * Common validation functions used across web3 and other edge functions.
 */

/**
 * Validate Ethereum wallet address format
 */
export function isValidWalletAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate Ethereum signature format
 */
export function isValidSignature(signature: string): boolean {
    return /^0x[a-fA-F0-9]{130}$/.test(signature);
}

/**
 * Parse and validate chain ID from request body
 */
export function parseChainId(value: unknown): number {
    if (value === undefined || value === null) {
        return 1; // Default to Ethereum mainnet
    }

    const numeric = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    if (!Number.isInteger(numeric) || numeric <= 0) {
        throw new Error('Invalid chain_id');
    }
    return numeric;
}

/**
 * Resolve origin from a URI string
 */
export function resolveOriginFromUri(uri: string): string {
    return new URL(uri).origin.replace(/\/$/, '');
}
