import { defineConfig, devices } from '@playwright/test'

if (!process.env.BASE_URL) {
  throw new Error(
    'BASE_URL environment variable is required for Playwright e2e tests.\n' +
    'Example: BASE_URL=https://gmr.void42.net npx playwright test'
  )
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'on-first-retry',
    // Private void42 PKI on the *.void42.internal envs (incl. DAST).
    ignoreHTTPSErrors: /\.void42\.internal(\/|$|:)/.test(process.env.BASE_URL || ''),
    // The DAST runner sets this to the in-cluster ZAP proxy so the e2e
    // traffic is captured for the passive scan.
    ...(process.env.PLAYWRIGHT_PROXY
      ? { proxy: { server: process.env.PLAYWRIGHT_PROXY } }
      : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'android-pixel7',
      use: { ...devices['Pixel 7'] }, // 412×915, Android Chrome UA
      testMatch: ['**/responsive.spec.js'], // mobile-only tests; functional tests run under chromium
    },
  ],
})
