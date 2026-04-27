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
  '/': 'Fontem — Follow the numbers, verify the claims',
  '/feed': 'Feed — Fontem',
  '/privacy': 'Privacy policy — Fontem',
  '/data-quality': 'Data quality — Fontem',
  '/sparql': 'SPARQL — Fontem',
  '/atlas': 'Atlas — Map European statistics on Fontem',
  '/login': 'Sign in — Fontem',
  '/donate': 'Support Fontem',
}

const DESCRIPTIONS = {
  '/': 'Fontem is the primary-source transparency platform. EU companies, public procurement, lobbyists, and cohesion funding — linked into one graph and cross-checked against the official registers.',
  '/feed': 'Public reports from the Fontem community — investigations, cross-checks, and data stories grounded in primary sources.',
  '/privacy': 'How Fontem handles personal data. We store only account basics, no tracking cookies, no third-party analytics.',
  '/data-quality': 'Coverage, freshness, and source breakdowns for every dataset in the Fontem knowledge graph. Transparency about transparency.',
  '/sparql': 'Query the Fontem knowledge graph directly via SPARQL. Companies, contracts, authorities, lobbyists, sanctions — all linked.',
  '/atlas': 'Interactive choropleth of curated Eurostat datasets at NUTS level — population, GDP, unemployment, R&D and more, mapped across Europe.',
  '/login': 'Sign in to Fontem to publish reports, raise issues, and save your research.',
  '/donate': 'Fontem is free to use and always will be. Donations flow through a fiscal-host nonprofit on Open Collective and keep the data pipelines running, the graph growing, and the team on quality work.',
}

const DEFAULT_TITLE = 'Fontem — Follow the numbers, verify the claims'
const DEFAULT_DESCRIPTION =
  'The primary-source transparency platform for EU public procurement and corporate data.'

export function titleForPath(route) {
  return TITLES[route.path] || DEFAULT_TITLE
}

export function descriptionForPath(route) {
  return DESCRIPTIONS[route.path] || DEFAULT_DESCRIPTION
}
