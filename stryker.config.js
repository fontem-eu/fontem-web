/**
 * Stryker mutation-testing config — JS-logic scope.
 *
 * We mutate the plain-JS logic tier (utils, api, composables, agent,
 * ssr, router, widgets, chart helpers) and deliberately NOT the .vue
 * SFCs: instrumenting the WebGL/map/chart components (sigma, leaflet,
 * maplibre, d3 canvas) throws at import inside Stryker's sandbox and
 * aborts the dry run, and UI markup is covered by the e2e suite.
 * useDuckDB (WASM) and downloadViz (canvas) are excluded for the same
 * reason. The weekly mutation-testing CronJob runs this config as-is.
 *
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export default {
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.stryker.config.js',
  },
  mutate: [
    'src/**/*.js',
    '!src/main.js',
    '!src/entry-server.js',
    '!src/assets/**',
    '!src/generated/**',
    '!src/locales/**',
    '!src/composables/useDuckDB.js',
    '!src/utils/downloadViz.js',
    '!src/extensions/**',
  ],
  reporters: ['html', 'json', 'clear-text', 'progress'],
  htmlReporter: {
    fileName: 'reports/mutation/mutation.html',
  },
  jsonReporter: {
    fileName: 'reports/mutation/mutation.json',
  },
  thresholds: {
    high: 80,
    low: 60,
    break: null,
  },
  timeoutMS: 60000,
  concurrency: 2,
}
