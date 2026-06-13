import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: [
      'src/**/*.{test,spec}.{ts,js}',
      'tests/unit/**/*.{test,spec}.{ts,js}',
      'tests/integration/**/*.{test,spec}.{ts,js}',
    ],
    exclude: ['node_modules', 'dist', 'tests/e2e/**', 'web/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.{ts,js}'],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/node_modules/**',
        'src/types/**',
        'src/**/*.d.ts',
      ],
    },
  },
});
