import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL || 'https://gmr.void42.net',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'android-pixel7',
      use: { ...devices['Pixel 7'] }, // 412×915, Android Chrome UA
    },
  ],
})
