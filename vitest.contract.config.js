// Contract (Pact) tests — real HTTP against the Pact mock provider, so
// node environment, no jsdom, and OUTSIDE the unit/mutation suites.
// `npm run test:contract` runs them; CI publishes the emitted pacts.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/contract/**/*.pact.test.js'],
    testTimeout: 30000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
