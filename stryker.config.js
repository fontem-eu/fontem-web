/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.stryker.config.js',
  },
  mutate: [
    'src/**/*.js',
    'src/**/*.vue',
    '!src/main.js',
    '!src/assets/**',
  ],
  reporters: ['html', 'clear-text', 'progress'],
  htmlReporter: {
    fileName: 'reports/mutation/mutation.html',
  },
  thresholds: {
    high: 80,
    low: 60,
    break: null,
  },
  timeoutMS: 60000,
  concurrency: 2,
}
