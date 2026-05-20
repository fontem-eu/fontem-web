/**
 * Per-route JSON-LD builders.
 *
 * Output is embedded in the SSR HTML as `<script type="application/ld+json">`.
 * Consumers: Google rich results, Bing, AI bots (Perplexity, Copilot),
 * schema.org validators, Wikidata reconciliation pipelines.
 *
 * Principle: derive from the SAME data the view rendered, never
 * duplicate.  For now the dataset we know without a fetch is the
 * static metadata about Fontem itself; dynamic pages (data stories,
 * companies) will hook their own per-request data into `context`
 * and use it here.
 */

const CANONICAL = (globalThis.process?.env?.CANONICAL_URL || 'https://fontem.eu').replace(/\/$/, '')

const ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Fontem',
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
  name: 'Fontem',
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
  name: 'Fontem knowledge graph',
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

const DONATE_PAGE = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Support Fontem',
  url: `${CANONICAL}/donate`,
  isPartOf: { '@type': 'WebSite', url: CANONICAL },
  about: ORGANIZATION,
  potentialAction: {
    '@type': 'DonateAction',
    // Recipient nonprofit assigned by the fiscal host on Open
    // Collective; the URL is the stable entry point.
    target: 'https://opencollective.com/fontem',
    recipient: ORGANIZATION,
  },
}

const BUILDERS = {
  // `/` is now the Stories landing — emit both the org/website
  // schema (so search engines anchor the site identity to the home
  // URL) AND the feed ItemList in the same payload.
  '/': (ctx) => [ORGANIZATION, WEBSITE, feedItemList(ctx)],
  '/privacy': () => [PRIVACY_PAGE],
  '/data-quality': () => [DATA_QUALITY_HUB],
  '/donate': () => [DONATE_PAGE],
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
    name: 'Fontem public data stories',
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
  if (!builder) return []
  return builder(context)
}
