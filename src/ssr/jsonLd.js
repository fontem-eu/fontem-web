/**
 * Per-route JSON-LD builders.
 *
 * Output is embedded in the SSR HTML as `<script type="application/ld+json">`.
 * Consumers: Google rich results, Bing, AI bots (Perplexity, Copilot),
 * schema.org validators, Wikidata reconciliation pipelines.
 *
 * Principle: derive from the SAME data the view rendered, never
 * duplicate.  For now the dataset we know without a fetch is the
 * static metadata about Dargle itself; dynamic pages (data stories,
 * companies) will hook their own per-request data into `context`
 * and use it here.
 */

const CANONICAL = (globalThis.process?.env?.CANONICAL_URL || 'https://fontem.eu').replace(/\/$/, '')

const ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Dargle',
  alternateName: 'fontem.eu',
  url: CANONICAL,
  logo: `${CANONICAL}/favicon.svg`,
  description:
    'Primary-source transparency platform linking EU companies, public procurement, ' +
    'lobbyists, and cohesion funding into a single knowledge graph.',
  sameAs: [
    // Fill in as accounts are created (Mastodon, GitHub, Wikidata, etc.)
  ],
}

const WEBSITE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Dargle',
  url: CANONICAL,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${CANONICAL}/c/{search_term_string}/profile`,
    },
    'query-input': 'required name=search_term_string',
  },
  publisher: ORGANIZATION,
}

const PRIVACY_PAGE = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Privacy Policy',
  url: `${CANONICAL}/privacy`,
  isPartOf: { '@type': 'WebSite', url: CANONICAL },
  about: ORGANIZATION,
}

const DATA_QUALITY_HUB = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'Dargle knowledge graph',
  description:
    'A linked dataset covering EU companies (from GLEIF), EU public procurement ' +
    '(from TED), EU cohesion projects (from Kohesio), lobbyists (from the EU ' +
    'Transparency Register), and sanctions (from the EU Consolidated Sanctions List).',
  url: `${CANONICAL}/data-quality`,
  license: 'https://creativecommons.org/publicdomain/zero/1.0/',
  creator: ORGANIZATION,
  distribution: [
    {
      '@type': 'DataDownload',
      contentUrl: `${CANONICAL}/sparql`,
      encodingFormat: 'application/sparql-query',
      name: 'SPARQL endpoint',
    },
  ],
  keyword: [
    'public procurement', 'EU', 'corporate transparency',
    'knowledge graph', 'cohesion funding', 'lobbyists', 'sanctions',
  ],
}

/**
 * A data story as an Article.
 *
 * This is the schema that makes a story quotable: `citation` carries the
 * primary sources the piece is built on, which is the whole claim of the
 * platform, and `isAccessibleForFree` tells an aggregator it may quote
 * rather than paywall-skip. Emitted only when the SSR prefetch supplied
 * the story — never invented from the URL.
 */
function articleJsonLd(ctx) {
  const s = ctx?.story
  if (!s?.id) return null
  const doc = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: s.title,
    url: `${CANONICAL}/stories/${s.id}`,
    mainEntityOfPage: `${CANONICAL}/stories/${s.id}`,
    isAccessibleForFree: true,
    publisher: { '@type': 'Organization', name: 'Dargle', url: CANONICAL },
  }
  if (s.abstract) doc.description = s.abstract
  if (s.created_at) doc.datePublished = s.created_at
  if (s.updated_at) doc.dateModified = s.updated_at
  if (s.author_name) doc.author = { '@type': 'Person', name: s.author_name }
  const sources = (s.sources || s.citations || [])
    .map((c) => (typeof c === 'string' ? c : c?.url))
    .filter(Boolean)
  if (sources.length) doc.citation = sources
  return doc
}

const PATTERN_BUILDERS = {
  '/stories/:id': (ctx) => [articleJsonLd(ctx)].filter(Boolean),
}

const BUILDERS = {
  // `/` is now the Stories landing — emit both the org/website
  // schema (so search engines anchor the site identity to the home
  // URL) AND the feed ItemList in the same payload.
  '/': (ctx) => [ORGANIZATION, WEBSITE, feedItemList(ctx)],
  '/privacy': () => [PRIVACY_PAGE],
  '/data-quality': () => [DATA_QUALITY_HUB],
}

function feedItemList(ctx) {
  // `ctx.stories` is optionally populated by a server-side prefetch
  // hook; when it's not available (e.g. static boot-up), we still
  // emit a valid ItemList describing the feed surface itself.
  // Falls back to `ctx.reports` for one release while the SSR
  // prefetch is renamed in lockstep.
  let stories
  if (Array.isArray(ctx?.stories)) {
    stories = ctx.stories.slice(0, 25)
  } else if (Array.isArray(ctx?.reports)) {
    stories = ctx.reports.slice(0, 25)
  } else {
    stories = []
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Dargle public data stories',
    url: `${CANONICAL}/`,
    numberOfItems: stories.length,
    itemListElement: stories.map((s, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: `${CANONICAL}/stories/${s.id}`,
      name: s.title,
    })),
  }
}

/**
 * Return an array of JSON-LD documents to embed in the response for
 * the current route.  The server wraps each in its own
 * `<script type="application/ld+json">`.
 */
export function buildJsonLd(route, context = {}) {
  const builder = BUILDERS[route.path]
  if (builder) return builder(context)
  // Dynamic routes match on the pattern Vue Router resolved, not the
  // concrete path — `/stories/<uuid>` never equals a literal key.
  const pattern = route?.matched?.[0]?.path
  const dynamic = pattern && PATTERN_BUILDERS[pattern]
  return dynamic ? dynamic(context) : []
}
