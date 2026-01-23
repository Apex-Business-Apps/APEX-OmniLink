import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'tests/**/*.spec.ts',
      'tests/**/*.spec.tsx',
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'sim/tests/**/*.test.ts',
      'sim/tests/**/*.spec.ts'
    ],
    exclude: [
      'tests/e2e-playwright/**',
      '**/playwright/**',
      'node_modules/**',
      // Skip integration tests in CI (require real Supabase infrastructure)
      ...(process.env.CI ? ['tests/integration/**'] : [])
    ],
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

