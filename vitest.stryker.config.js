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
      // Instrumentation-hostile: WebGL/canvas/map components throw at import
      // under Stryker's instrumented sandbox (sigma.js, leaflet/maplibre),
      // which fails the dry run and aborts the whole mutation run. These
      // components are visual and covered by e2e, not unit mutation.
      'tests/unit/architecture.test.js',
      'tests/unit/GraphExplorer.test.js',
      'tests/unit/GraphExplorer.fullscreen.test.js',
      'tests/unit/GraphExplorer.tooltip-offset.test.js',
      'tests/unit/GraphExplorer.controls.test.js',
      'tests/unit/EntityNutsMap.test.js',
      'tests/unit/EntityNutsMapEmbed.test.js',
      'tests/unit/AtlasMapEmbed.test.js',
      'tests/unit/StudioMap.test.js',
      'tests/unit/GeoChoropleth.test.js',
    ],
    setupFiles: ['tests/setup.js'],
    testTimeout: 15000,
    retry: 2,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
