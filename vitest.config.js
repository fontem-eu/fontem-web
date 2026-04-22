// Separate config for Vitest — no Tailwind plugin needed (jsdom ignores CSS).
// vite.config.js still uses @tailwindcss/vite for the production build.
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.js', 'tests/ssr/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
    coverage: {
      // Match the already-installed @vitest/coverage-istanbul — Vitest's
      // default provider is v8, which we don't ship and which pulled the
      // CI `analyze` job down with a MISSING DEPENDENCY.
      provider: 'istanbul',
    },
  },
})
