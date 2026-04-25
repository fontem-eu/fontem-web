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
    // Vitest defaults to 5s; under load on the act-runner we routinely
    // see legitimately-passing tests spend 5–7s in the
    // mountMap/mountHomeAt/Sigma init paths and trip the timeout. 15s
    // gives headroom without masking real hangs.
    testTimeout: 15000,
    coverage: {
      // Match the already-installed @vitest/coverage-istanbul — Vitest's
      // default provider is v8, which we don't ship and which pulled the
      // CI `analyze` job down with a MISSING DEPENDENCY.
      provider: 'istanbul',
      // Include lcov so sonar-project.properties'
      // sonar.javascript.lcov.reportPaths=coverage/lcov.info actually
      // finds something. Without it Sonar logged "No LCOV files were
      // found" and the gate went red at 0% coverage even though the
      // CI `analyze` job itself reported success.
      reporter: ['text', 'html', 'lcov'],
    },
  },
})
