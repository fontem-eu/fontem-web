/**
 * Theme registry — the investigative lens over the per-source dashboards.
 * The hub renders THEMES as tiles; the generic ThemeScaffoldView renders
 * SCAFFOLD[id] for every theme except procurement, which has its own
 * richer composed page. Sources reference DataSource registry ids
 * (SourcePipelinePanel resolves health/timeline by id); `route` is the
 * operational drill-down (omitted where no dashboard exists yet).
 *
 * Display strings (title/blurb/question/label/soon) are i18n KEYS resolved
 * with $t/t at the render sites (DataQualityHubView, ThemeScaffoldView).
 */
export const THEMES = [
  { id: 'procurement', title: 'dq_themes.procurement_title', icon: '💶',
    blurb: 'dq_themes.procurement_blurb' },
  { id: 'corporate', title: 'dq_themes.corporate_title', icon: '🏢',
    blurb: 'dq_themes.corporate_blurb' },
  { id: 'influence', title: 'dq_themes.influence_title', icon: '🏛',
    blurb: 'dq_themes.influence_blurb' },
  { id: 'securities', title: 'dq_themes.securities_title', icon: '📋',
    blurb: 'dq_themes.securities_blurb' },
  { id: 'geography', title: 'dq_themes.geography_title', icon: '🗺',
    blurb: 'dq_themes.geography_blurb' },
]

export const SCAFFOLD = {
  corporate: {
    questions: [
      'dq_themes.corporate_q0',
      'dq_themes.corporate_q1',
      'dq_themes.corporate_q2',
    ],
    sources: [
      { id: 'gleif', label: 'dq_themes.src_gleif', route: '/data-quality/gleif' },
      { id: 'gleif-relationships', label: 'dq_themes.src_gleif_relationships', route: '/data-quality/gleif' },
      { id: 'us-companies', label: 'dq_themes.src_us_companies', route: '/data-quality/edgar' },
      { id: 'eu-listings', label: 'dq_themes.src_eu_listings', route: '/data-quality/esef' },
    ],
    soon: 'dq_themes.corporate_soon',
  },
  influence: {
    questions: [
      'dq_themes.influence_q0',
      'dq_themes.influence_q1',
      'dq_themes.influence_q2',
    ],
    sources: [
      { id: 'lobbying', label: 'dq_themes.src_lobbying', route: '/data-quality/lobbying' },
      { id: 'sanctions', label: 'dq_themes.src_sanctions', route: '/data-quality/sanctions' },
      { id: 'eu-knowledge-graph', label: 'dq_themes.src_eu_knowledge_graph', route: '/data-quality/eu-knowledge-graph' },
    ],
    soon: 'dq_themes.influence_soon',
  },
  securities: {
    questions: [
      'dq_themes.securities_q0',
      'dq_themes.securities_q1',
    ],
    sources: [
      { id: 'firds', label: 'dq_themes.src_firds', route: '/data-quality/firds' },
      { id: 'openfigi', label: 'dq_themes.src_openfigi', route: null },
    ],
    soon: 'dq_themes.securities_soon',
  },
  geography: {
    questions: [
      'dq_themes.geography_q0',
      'dq_themes.geography_q1',
    ],
    sources: [
      { id: 'nuts', label: 'dq_themes.src_nuts', route: '/data-quality/nuts' },
    ],
    soon: 'dq_themes.geography_soon',
  },
}
