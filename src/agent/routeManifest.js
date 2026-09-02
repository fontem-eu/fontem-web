/**
 * The site map the assistant navigates by.
 *
 * Built from the *real* vue-router instance rather than parsed out of
 * app.js, so it cannot disagree with what the app actually serves — the
 * manifest and the router are the same source of truth by construction.
 *
 * Descriptions live in ROUTE_DESCRIPTIONS below. They are the one part a
 * machine cannot derive: "/c/:symbol/gmr-long" tells the agent nothing
 * about what the page is for. A route without one fails the drift test,
 * so adding a route forces you to say what it does rather than leaving
 * the agent a blind spot.
 */
import { requiresAuth } from '../router/authGate.js'

/**
 * Routes deliberately excluded from agent navigation. Being on this list
 * is a decision, not an omission — the drift test fails for any route
 * that is neither described nor listed here, so nothing stays
 * unclassified by accident.
 */
export const NOT_NAVIGABLE = new Set([
  // Reached from /my-reviews or the editor; the id is not something
  // the agent can know, so steering a user here blind is a dead end.
  '/stories/:id/reviews/:reviewId',
  '/:pathMatch(.*)*',   // 404 catch-all
  '/forgot-password',   // auth utility: reached from /login, not navigated to
  '/reset-password',    // reached from an emailed token
  '/verify-email',      // reached from an emailed token
  '/admin',             // restricted; the agent should not steer users here
  '/admin/entity-resolution',
  '/admin/moderation',
  '/admin/value-review',
  '/admin/feed-queries',
  '/admin/query-groups',
  '/admin/data-quality/:page*',
])

/** path -> what a user would go there to do. Keep them short and concrete. */
export const ROUTE_DESCRIPTIONS = {
  '/': 'Home feed of published data stories.',
  '/about': 'What Fontem is, how it works, and how to get started.',
  '/help': 'Help and FAQ, including how to connect your own AI assistant to Fontem.',
  '/login': 'Sign in or create an account.',
  '/account': 'Account settings: display preferences, profile, and LLM provider keys.',
  '/privacy': 'Privacy policy and data handling.',
  '/development': 'Fontem is open source: the GitHub organisation and a walkthrough video of how the platform is built.',

  '/briefings': 'Browse briefings — curated subjects you can watch to get new findings as they appear.',
  '/my-briefings': 'The briefings you watch, newest findings first, with their feed URLs.',
  '/petitions': 'Browse and sign public petitions.',
  '/petitions/:id': 'A single petition, with its signatures and status.',

  '/explore': 'Data exploration hub — the entry point to the datasets.',
  '/map': 'Atlas: geographic view of the data by region.',
  '/geo': 'Geographic data browser.',
  '/spending': 'Public spending overview and search.',
  '/search': 'Full-text search across entities and stories.',
  '/sparql': 'Advanced: run SPARQL queries directly against the graph.',

  '/c/:ticker': 'Company page by ticker symbol.',
  '/c/:ticker/:view': 'A specific view of a company (summary, balance, cashflow, profile).',
  '/authority/:authority_id/:view?': 'A contracting authority — profile, procurement and the graph around it.',
  '/company/:gmr_id/:view?': 'A company — profile, financials, procurement, cohesion grants and the graph around it.',
  '/contract/:noticeId': 'A single public procurement contract, with its award details.',
  '/users/:id': 'A contributor profile.',

  '/my-reviews': 'Reviews you started and reviews you were asked to read.',
  '/my-stories': 'Data stories you have written.',
  '/stories/:id': 'Read a published data story.',
  '/stories/:id/edit': 'Edit one of your data stories.',
  '/reports/:id': 'Read a data story (legacy path).',
  '/reports/:id/edit': 'Edit a data story (legacy path).',

  '/studio': 'Studio: build queries and plots for a data story.',
  '/studio/p/:projectId': 'A studio project.',
  '/studio/p/:projectId/plot': 'Plots in a studio project.',
  '/studio/p/:projectId/plot/:plotId': 'A single plot in a studio project.',
  '/studio/p/:projectId/q/:queryId': 'A saved query in a studio project.',

  '/investigations': 'Collaborative investigations you can see.',
  '/investigations/:id': 'A single investigation and its members and stories.',
  '/dossiers/:id': 'An entity dossier.',
  '/issues': 'Data quality issues raised by the community.',
  '/issues/:id': 'A single data quality issue and its discussion.',
  '/activity': 'Recent community activity.',
  '/ai-usage': 'Your assistant usage and token history.',

  '/data-quality': 'Data quality dashboards and coverage reports.',
  '/data-quality/overview': 'Data quality at a glance, across all sources.',
  '/data-quality/assertions': 'Automated data quality assertions and their results.',
  '/data-quality/theme/:themeId': 'Data quality for one theme.',
  '/data-quality/theme/procurement': 'Data quality for procurement and tendering data.',
  '/data-quality/contracts': 'Coverage and quality of procurement contracts.',
  '/data-quality/prices': 'Coverage and quality of the securities price layer.',
  '/data-quality/gleif': 'Coverage of GLEIF legal entity identifiers.',
  '/data-quality/openfigi': 'Coverage of OpenFIGI instrument identifiers.',
  '/data-quality/edgar': 'Coverage of SEC EDGAR filings.',
  '/data-quality/esef': 'Coverage of ESEF financial filings.',
  '/data-quality/firds': 'Coverage of FIRDS instrument reference data.',
  '/data-quality/sanctions': 'Coverage of sanctions lists and their entity links.',
  '/data-quality/lobbying': 'Coverage of lobbying and transparency register data.',
  '/data-quality/legislative': 'Coverage of legislative and CELEX documents.',
  '/data-quality/nuts': 'Coverage of NUTS regional codes.',
  '/data-quality/eu-knowledge-graph': 'Coverage of the EU knowledge graph sources.',
  '/data-quality/cdp': 'Coverage of CDP environmental disclosures.',
  '/data-quality/connectedness': 'How well entities are linked to one another.',
  '/data-quality/dedup': 'Duplicate entity detection and resolution status.',
  '/data-quality/trade-edges': 'Coverage of trade relationship edges.',
  '/data-quality/triples': 'Raw triple counts in the graph store.',
  '/data-quality/etl-runs': 'Recent ETL pipeline runs and their outcomes.',
}

/**
 * @param {import('vue-router').Router} router
 * @returns {{generated_from: string, routes: Array}}
 */
export function buildRouteManifest(router) {
  const routes = router
    .getRoutes()
    // vue-router expands aliases into their own records; the canonical
    // path is enough for navigation and duplicates only confuse the model.
    .filter((r) => !r.aliasOf)
    .map((r) => {
      const params = (r.path.match(/:\w+/g) || []).map((p) => p.slice(1))
      const entry = {
        path: r.path,
        // A redirect target is where the user actually lands, so the agent
        // should navigate straight there rather than via a bouncing alias.
        redirects_to: typeof r.redirect === 'string' ? r.redirect : undefined,
        params: params.length ? params : undefined,
        requires_auth: requiresAuth(r.path.replace(/:\w+/g, 'x')) || undefined,
        description: ROUTE_DESCRIPTIONS[r.path],
      }
      Object.keys(entry).forEach((k) => entry[k] === undefined && delete entry[k])
      return entry
    })
    .sort((a, b) => a.path.localeCompare(b.path))

  return { generated_from: 'createFontemRouter()', routes }
}

/** Routes an agent may navigate to: real destinations, not redirect stubs
 *  and not the deliberately excluded ones. */
export function navigableRoutes(manifest) {
  return manifest.routes.filter((r) => !r.redirects_to && !NOT_NAVIGABLE.has(r.path))
}

/**
 * Does `path` match a route the agent is allowed to send the user to?
 *
 * The backend validates too, against the same manifest this sends it. This
 * is not redundant: the browser is the process that actually moves the
 * user, and a path arriving over the wire is not something it should
 * follow on trust — an off-site "navigation" is an open redirect.
 */
export function isNavigable(path, manifest) {
  return matchRoute(path, manifest) !== null
}

/**
 * The manifest entry `path` resolves to, or null.
 *
 * Same matching as isNavigable — one implementation, so a path can never be
 * navigable but undescribable, or described by a route it would not go to.
 */
export function matchRoute(path, manifest) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null
  if (path.includes('://')) return null
  const clean = path.split('?')[0].split('#')[0]
  return navigableRoutes(manifest).find((r) => {
    const re = new RegExp(
      '^' + r.path.split('/').filter(Boolean)
        .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)))
        .map((seg) => '/' + seg).join('') + '/?$',
    )
    return r.path === '/' ? clean === '/' : re.test(clean)
  }) || null
}

/**
 * A human label for a destination, for the confirmation prompt.
 *
 * Falls back to the path itself: "Fontem wants to open /studio/x" is worse
 * than "the Data Studio" but far better than an empty sentence, and the
 * manifest does not describe every route.
 */
export function describeRoute(path, manifest) {
  return matchRoute(path, manifest)?.description || null
}
