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
    // see legitimately-passing tests spend 5–15s in the
    // mountMap/mountHomeAt/Sigma init paths (dynamic imports + heavy
    // mocks) and trip the timeout. 15s default + retry: 2 handles both
    // the steady slowness AND the occasional 15s+ first-cold-import.
    testTimeout: 15000,
    retry: 2,
    // Run all tests in a single forked process. Vitest's default
    // multi-fork pool was thrashing the act-runner: workers timed out
    // calling back to the main process for module-fetch with errors
    // like `[vitest-worker]: Timeout calling "fetch" ...`. Single-fork
    // is slower wall-clock but eliminates cross-process IPC contention
    // entirely. Locally still parallelises by file via test isolation.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
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
