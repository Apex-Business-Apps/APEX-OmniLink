import { describe, it, expect } from 'vitest';
import { BATTERY_REGISTRY } from '../scripts/armageddon/registry';

describe('ATSC Registry', () => {
    it('should have unique battery names', () => {
        const names = new Set();
        BATTERY_REGISTRY.forEach(b => {
            expect(names.has(b.name)).toBe(false);
            names.add(b.name);
        });
    });

    it('should have valid categories', () => {
        const valid = ['lint', 'test', 'e2e', 'sim', 'build'];
        BATTERY_REGISTRY.forEach(b => {
            expect(valid).toContain(b.category);
        });
    });

    it('destructive batteries should differ from safe ones', () => {
        const destructive = BATTERY_REGISTRY.filter(b => b.destructive);
        expect(destructive.length).toBeGreaterThan(0);
        destructive.forEach(b => {
            expect(b.category).toBe('sim'); // Currently all destructive are sims
        });
    });
});
