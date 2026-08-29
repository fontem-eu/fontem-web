// Vitest config for Stryker mutation testing.
//
// A curated include list rather than tests/unit/**: component suites that
// mount WebGL/map/chart components (GraphExplorer, EntityNutsMap, Atlas,
// StudioMap, GeoChoropleth) break under Stryker's instrumented sandbox,
// and architecture.test reads raw .vue sources off disk. Everything here
// is proven stable under instrumentation — it is the union of the
// per-part mutation suites (utils / api / composables / core / widgets).
//
// Mirrors the stability knobs from vitest.config.js (testTimeout/retry/
// single-fork); without them the dry run flakes on timing-sensitive specs
// and aborts the whole mutation run.
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      // utils
      'tests/unit/articleQuality.test.js', 'tests/unit/buildTree.test.js',
      'tests/unit/format.test.js', 'tests/unit/investigationRole.test.js',
      'tests/unit/readingTime.test.js', 'tests/unit/reportContext.test.js',
      'tests/unit/sanitize.test.js', 'tests/unit/tedUrl.test.js',
      'tests/unit/translationDefault.test.js', 'tests/unit/vizPalette.test.js',
      'tests/unit/privilege.test.js', 'tests/unit/dataQuality.test.js',
      'tests/unit/DataConfidenceIcon.test.js', 'tests/unit/DataConfidenceModal.test.js',
      'tests/unit/DataQualityBadge.test.js',
      // api
      'tests/unit/api.test.js', 'tests/unit/atlasApi.test.js',
      'tests/unit/community-api.test.js', 'tests/unit/communityApi.test.js',
      'tests/unit/geoApi.test.js', 'tests/unit/session.test.js',
      'tests/unit/sessionEmailFlows.test.js', 'tests/unit/sessionContract.test.js',
      'tests/unit/silentRefresh.test.js', 'tests/unit/tickers.api.test.js',
      'tests/unit/mcpTokens.test.js', 'tests/unit/providerKeys.test.js',
      'tests/unit/PublicSpendingView.test.js', 'tests/unit/applyFlowIntegration.test.js',
      'tests/unit/searchApi.test.js', 'tests/unit/studioApi.test.js',
      'tests/unit/petitionsApi.test.js', 'tests/unit/euroTrackerApi.test.js',
      'tests/unit/apiErrorTails.test.js',
      // composables
      'tests/unit/composables.test.js', 'tests/unit/useAnalytics.test.js',
      'tests/unit/useDocumentMeta.test.js', 'tests/unit/useFollowedTags.test.js',
      'tests/unit/useLang.test.js', 'tests/unit/usePocket.test.js',
      'tests/unit/useQuerySchema.test.js', 'tests/unit/useSidebar.test.js',
      'tests/unit/useStoriesTagFilter.test.js', 'tests/unit/useStudio.test.js',
      'tests/unit/useTheme.test.js', 'tests/unit/useToast.test.js',
      'tests/unit/useVisibleViewportHeight.test.js', 'tests/unit/visibleViewportGap.test.js',
      'tests/unit/withLang.test.js', 'tests/unit/nutsDetect.test.js',
      'tests/unit/schemaCompletions.test.js', 'tests/unit/studioPlot.test.js',
      'tests/unit/studioPlotEvents.test.js', 'tests/unit/editProposals.test.js',
      'tests/unit/parseProposals.test.js',
      // core (agent / ssr / router / app / i18n)
      'tests/unit/routeManifest.test.js', 'tests/unit/routerAuthGate.test.js',
      'tests/unit/ssrMeta.test.js', 'tests/unit/coreSsrI18n.test.js',
      'tests/ssr/render.test.js',
      // widgets + chart helpers
      'tests/unit/chartSnapshot.test.js', 'tests/unit/DqChartEmbed.test.js',
      'tests/unit/PocketableChart.test.js', 'tests/unit/widgets.test.js',
      'tests/unit/colorScale.test.js', 'tests/unit/chartEvents.test.js',
      'tests/unit/timeSeriesAggregation.test.js', 'tests/unit/vizRegistry.test.js',
      'tests/unit/dqChartsRegistry.test.js',
    ],
    setupFiles: ['tests/setup.js'],
    testTimeout: 15000,
    retry: 2,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
