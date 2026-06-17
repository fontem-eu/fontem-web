/**
 * Theme registry — the investigative lens over the per-source dashboards.
 * The hub renders THEMES as tiles; the generic ThemeScaffoldView renders
 * SCAFFOLD[id] for every theme except procurement, which has its own
 * richer composed page. Sources reference DataSource registry ids
 * (SourcePipelinePanel resolves health/timeline by id); `route` is the
 * operational drill-down (omitted where no dashboard exists yet).
 */
export const THEMES = [
  { id: 'procurement', title: 'Public Procurement', icon: '💶',
    blurb: 'Where EU public money goes — contract awards, value flows, and the data quality behind the figures.' },
  { id: 'corporate', title: 'Corporate Ownership', icon: '🏢',
    blurb: 'Who owns whom — LEI entities, ownership chains, and financial filings.' },
  { id: 'influence', title: 'Influence & Accountability', icon: '🏛',
    blurb: 'Lobbying, sanctions, and EU cohesion spending.' },
  { id: 'securities', title: 'Securities & Instruments', icon: '📋',
    blurb: 'Financial instruments, trading venues, and identifiers.' },
  { id: 'geography', title: 'Geography', icon: '🗺',
    blurb: 'The regional dimension across every source.' },
]

export const SCAFFOLD = {
  corporate: {
    questions: [
      'Who is the ultimate parent behind a company?',
      'Which corporate groups span borders?',
      'How complete are the financial filings per source?',
    ],
    sources: [
      { id: 'gleif', label: 'GLEIF Entities', route: '/data-quality/gleif' },
      { id: 'gleif-relationships', label: 'GLEIF Relationships', route: '/data-quality/gleif' },
      { id: 'us-companies', label: 'US Companies (EDGAR)', route: '/data-quality/edgar' },
      { id: 'eu-listings', label: 'EU Filings (ESEF)', route: '/data-quality/esef' },
    ],
    soon: 'Ownership-network explorer and cross-border group rollups (pending the GLEIF ownership re-ingest).',
  },
  influence: {
    questions: [
      'Who lobbies, and for which companies?',
      'Who is sanctioned — and do they touch public contracts?',
      'Where does EU cohesion funding actually land?',
    ],
    sources: [
      { id: 'lobbying', label: 'EU Lobbying', route: '/data-quality/lobbying' },
      { id: 'sanctions', label: 'EU Sanctions', route: '/data-quality/sanctions' },
      { id: 'eu-knowledge-graph', label: 'EU Cohesion (Kohesio)', route: '/data-quality/eu-knowledge-graph' },
    ],
    soon: 'Lobbying × procurement and sanctions × procurement cross-source views.',
  },
  securities: {
    questions: [
      'What instruments and venues are covered?',
      'How many listings are real tickers vs ISIN placeholders?',
    ],
    sources: [
      { id: 'firds', label: 'FIRDS Instruments', route: '/data-quality/firds' },
      { id: 'openfigi', label: 'OpenFIGI Enrichment', route: null },
    ],
    soon: 'OpenFIGI enrichment dashboard and the ticker↔ISIN coverage view.',
  },
  geography: {
    questions: [
      'How is procurement and ownership distributed by region?',
      'Which authorities and companies are unlinked to a NUTS region?',
    ],
    sources: [
      { id: 'nuts', label: 'NUTS Regions', route: '/data-quality/nuts' },
    ],
    soon: 'Region-level rollups of spend and ownership across the other themes.',
  },
}
