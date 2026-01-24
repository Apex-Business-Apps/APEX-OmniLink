/**
 * Guard Rails Tests
 */

import { describe, it, expect } from 'vitest';
import {
  checkGuardRails,
  isProductionUrl,
  generateSandboxConfig,
} from '../guard-rails';
import { buildGuardRailConfig } from './_helpers/guardRails';

describe('Guard Rails', () => {
  describe('isProductionUrl', () => {
    it('should detect production URLs', () => {
      expect(isProductionUrl('https://prod.apex.com')).toBe(true);
      expect(isProductionUrl('https://api.apexbiz.io')).toBe(true);
      expect(isProductionUrl('https://live.supabase.co')).toBe(true);
      expect(isProductionUrl('https://www.apex.com')).toBe(true);
    });

    it('should allow sandbox URLs', () => {
      expect(isProductionUrl('http://localhost:3000')).toBe(false);
      expect(isProductionUrl('http://127.0.0.1:54321')).toBe(false);
      expect(isProductionUrl('https://sandbox.supabase.co')).toBe(false);
      expect(isProductionUrl('https://dev.apex.test')).toBe(false);
    });
  });

  describe('checkGuardRails', () => {
    it('should pass with valid configuration', () => {
      const config = buildGuardRailConfig();

      const result = checkGuardRails(config);

      expect(result.safe).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail without SIM_MODE', () => {
      const config = buildGuardRailConfig({ simMode: undefined });

      const result = checkGuardRails(config);

      expect(result.safe).toBe(false);
      expect(result.errors).toContain('SIM_MODE environment variable is not set');
    });

    it('should fail with SIM_MODE=false', () => {
      const config = buildGuardRailConfig({ simMode: 'false' });

      const result = checkGuardRails(config);

      expect(result.safe).toBe(false);
      expect(result.errors.some(e => e.includes("must be 'true'"))).toBe(true);
    });

    it('should fail without SANDBOX_TENANT', () => {
      const config = buildGuardRailConfig({ sandboxTenant: undefined });

      const result = checkGuardRails(config);

      expect(result.safe).toBe(false);
      expect(result.errors).toContain('SANDBOX_TENANT environment variable is not set');
    });

    it('should fail with production URL', () => {
      const config = buildGuardRailConfig({ supabaseUrl: 'https://prod.supabase.co' });

      const result = checkGuardRails(config);

      expect(result.safe).toBe(false);
      expect(result.errors.some(e => e.includes('Production URL detected'))).toBe(true);
    });

    it('should warn about missing sandbox indicators', () => {
      const config = buildGuardRailConfig({ supabaseUrl: 'https://random-url.com' });

      const result = checkGuardRails(config);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('generateSandboxConfig', () => {
    it('should generate valid sandbox configuration', () => {
      const config = generateSandboxConfig('test-123');

      expect(config.SIM_MODE).toBe('true');
      expect(config.SANDBOX_TENANT).toBe('test-123');
      expect(config.SUPABASE_URL).toBe('http://localhost:54321');
      expect(config.NODE_ENV).toBe('test');
    });

    it('should generate unique tenant if not provided', () => {
      const config1 = generateSandboxConfig();
      const config2 = generateSandboxConfig();

      expect(config1.SANDBOX_TENANT).not.toBe(config2.SANDBOX_TENANT);
      expect(config1.SANDBOX_TENANT).toMatch(/^sandbox-\d+-\d+$/);
    });
  });
});
