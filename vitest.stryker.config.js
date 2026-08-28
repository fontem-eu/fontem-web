// Vitest config for Stryker mutation testing.
// Excludes tests incompatible with Stryker instrumentation:
// - GraphExplorer: sigma.js requires WebGL at import time (unhandled rejections)
// - architecture: reads raw .vue source via fs, breaks when Stryker instruments it
//
// Mirrors the stability knobs from vitest.config.js (testTimeout/retry/
// single-fork). Without them Stryker's initial dry run flaked on timing- and
// isolation-sensitive specs (e.g. AssistPanel's teleport-under-<body> check),
// which aborts the whole mutation run before any mutant is tested. The main
// suite never saw this because it already sets these.
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.js'],
    exclude: [
      'tests/unit/GraphExplorer.test.js',
      'tests/unit/architecture.test.js',
    ],
    setupFiles: ['tests/setup.js'],
    testTimeout: 15000,
    retry: 2,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
