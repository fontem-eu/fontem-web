import { defineConfig, devices } from '@playwright/test'

// Real-browser render checks against the BUILT client (`vite preview` over
// dist/client), with every network call stubbed by the specs. Separate from
// playwright.config.js, which drives the deployed-environment e2e suite and
// needs a BASE_URL: this one needs no backend, so it runs on every PR.
const PORT = 4179

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: `npx vite preview --outDir dist/client --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Headless CI runners have no GPU; SwiftShader gives maplibre a
        // software WebGL context to draw into.
        launchOptions: {
          args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
        },
      },
    },
  ],
})
