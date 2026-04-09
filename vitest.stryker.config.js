// Vitest config for Stryker mutation testing.
// Excludes tests incompatible with Stryker instrumentation:
// - GraphExplorer: sigma.js requires WebGL at import time (unhandled rejections)
// - architecture: reads raw .vue source via fs, breaks when Stryker instruments it
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
  },
})
