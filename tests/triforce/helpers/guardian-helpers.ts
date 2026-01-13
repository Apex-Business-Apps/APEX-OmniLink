/**
 * Guardian Test Helpers
 *
 * Utility functions for testing prompt injection detection and PII redaction.
 * Reduces duplication in guardian.spec.ts by providing reusable test patterns.
 */

/**
 * Expects all attack strings to be blocked by the detection function.
 */
export function expectAllBlocked(
    attacks: string[],
    detectFn: (input: string) => string[]
): void {
    for (const attack of attacks) {
        const violations = detectFn(attack);
        if (violations.length === 0) {
            throw new Error(`Expected attack to be blocked: "${attack}"`);
        }
    }
}

/**
 * Expects all request strings to be allowed by the detection function.
 */
export function expectAllAllowed(
    requests: string[],
    detectFn: (input: string) => string[]
): void {
    for (const request of requests) {
        const violations = detectFn(request);
        if (violations.length > 0) {
            throw new Error(
                `Expected request to be allowed: "${request}", but got violations: ${violations.join(', ')}`
            );
        }
    }
}
