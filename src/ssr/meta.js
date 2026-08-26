/**
 * Per-route <title> and <meta name="description"> values.
 *
 * Keyed on the route object — components can own their own meta via
 * `document.title` assignments too (they do today), but those run on
 * the client; for SSR / crawlers we need deterministic, server-known
 * strings injected into the HTML template before hydration.
 *
 * Keep the entries short — titles under ~60 characters, descriptions
 * under ~160 — per the universal SEO rules of thumb.
 */

const TITLES = {
  // Stories — public feed — is the new landing.
  '/': "Fontem — Crossing the EU's digital borders, one dataset at a time",
  '/about': 'About — Fontem',
  '/privacy': 'Privacy policy — Fontem',
  '/data-quality': 'Data quality — Fontem',
  '/sparql': 'SPARQL — Fontem',
  '/map': 'Map — European statistics on Fontem',
  '/spending': 'Spending — EU procurement on Fontem',
  '/login': 'Sign in — Fontem',
  '/development': 'Development — Fontem',
}

const DESCRIPTIONS = {
  '/': "Crossing the EU's digital borders, one dataset at a time. Public data stories from the Fontem community — investigations, cross-checks, and findings grounded in primary sources.",
  '/about': 'Fontem is the collaborative-argument platform. EU companies, public procurement, lobbyists, and cohesion funding — linked into one graph and cross-checked against the official registers.',
  '/privacy': 'How Fontem handles personal data. We store only account basics, no tracking cookies, no third-party analytics.',
  '/data-quality': 'Coverage, freshness, and source breakdowns for every dataset in the Fontem knowledge graph. Transparency about transparency.',
  '/sparql': 'Query the Fontem knowledge graph directly via SPARQL. Companies, contracts, authorities, lobbyists, sanctions — all linked.',
  '/map': 'Interactive choropleth of curated Eurostat datasets at NUTS level — population, GDP, unemployment, R&D and more, mapped across Europe.',
  '/spending': 'Search EU companies, contracting authorities, lobbyists and EU-funded projects. Plus what is big in your country.',
  '/login': 'Sign in to Fontem to publish data stories, raise issues, and save your research.',
  '/development': 'Fontem is open source. Explore our GitHub organisation and watch how we build the platform in a secure and sound way.',
}

const DEFAULT_TITLE = 'Fontem — Argue it. With data. Together.'
const DEFAULT_DESCRIPTION =
  'The primary-source transparency platform for EU public procurement and corporate data.'

export function titleForPath(route) {
  return TITLES[route.path] || DEFAULT_TITLE
}

export function descriptionForPath(route) {
  return DESCRIPTIONS[route.path] || DEFAULT_DESCRIPTION
}
