import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Workspace-wide vitest config. Picks up `*.test.ts` co-located alongside
// source in apps/* and packages/*. Initial scope (PR 6 of the budget arc):
// pure utilities only — expression evaluator + rate-conversion helpers.
// React component tests would need a jsdom environment; deferred.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'apps/back-to-one/src'),
    },
  },
  test: {
    include: [
      'apps/**/src/**/*.test.ts',
      'packages/**/src/**/*.test.ts',
    ],
    environment: 'node',
  },
})
