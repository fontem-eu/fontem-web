/**
 * Serialising the <head> for prerendered pages and for the SPA shell.
 *
 * Lives here rather than inside scripts/prerender.js so it can be tested
 * without a build: the canonical rule below is the one that broke
 * indexing, and it deserves coverage in the fast unit gate rather than
 * only in e2e against a deployed environment.
 */

export function escapeHtml(s) {
  // Ampersand first — any later replacement introduces one, and
  // re-escaping it would double-encode.
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * @param head  { title, description, canonical, ogImage, jsonLd }
 * @param opts  { canonical: boolean } — false for the SPA fallback shell.
 *
 * Omitting the canonical is deliberate and is the whole point of the
 * shell. One static file is served for every client-routed URL, so it
 * cannot know which page it is; naming any specific URL would tell
 * Google that every story and every company page is that one page.
 * With no canonical, Google uses the request URL, which is right for
 * all of them.
 */
export function renderHead(head, { canonical = true } = {}) {
  const parts = []
  if (head.title) {
    const t = escapeHtml(head.title)
    parts.push(
      `<title>${t}</title>`,
      `<meta property="og:title" content="${t}"/>`,
      `<meta name="twitter:title" content="${t}"/>`,
    )
  }
  if (head.description) {
    const d = escapeHtml(head.description)
    parts.push(
      `<meta name="description" content="${d}"/>`,
      `<meta property="og:description" content="${d}"/>`,
      `<meta name="twitter:description" content="${d}"/>`,
    )
  }
  if (head.canonical && canonical) {
    const c = escapeHtml(head.canonical)
    parts.push(
      `<link rel="canonical" href="${c}"/>`,
      `<meta property="og:url" content="${c}"/>`,
    )
  }
  if (head.ogImage) {
    const img = escapeHtml(head.ogImage)
    parts.push(
      `<meta property="og:image" content="${img}"/>`,
      `<meta name="twitter:image" content="${img}"/>`,
    )
  }
  parts.push(...(head.jsonLd || []).map(
    (doc) => `<script type="application/ld+json">${JSON.stringify(doc)}</script>`))
  return parts.join('\n    ')
}
