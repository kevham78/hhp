import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name:        'unit',
          include:     ['tests/unit/**/*.test.{ts,tsx}'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name:            'integration',
          include:         ['tests/integration/**/*.test.ts'],
          environment:     'node',
          // Starts a throwaway Postgres (or uses TEST_DATABASE_URL in CI)
          globalSetup:     ['tests/integration/global-setup.ts'],
          setupFiles:      ['tests/integration/setup.ts'],
          // All files share one database, so run them one at a time
          fileParallelism: false,
          testTimeout:     30_000,
          hookTimeout:     180_000,
        },
      },
    ],
  },
})
