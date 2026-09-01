/**
 * Serialising the <head> for prerendered pages and for the SPA shell.
 *
 * Lives here rather than inside scripts/prerender.js so it can be tested
 * without a build: the canonical rule below is the one that broke
 * indexing, and it deserves coverage in the fast unit gate rather than
 * only in e2e against a deployed environment.
 */

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
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
    parts.push(`<title>${escapeHtml(head.title)}</title>`)
    parts.push(`<meta property="og:title" content="${escapeHtml(head.title)}"/>`)
    parts.push(`<meta name="twitter:title" content="${escapeHtml(head.title)}"/>`)
  }
  if (head.description) {
    parts.push(`<meta name="description" content="${escapeHtml(head.description)}"/>`)
    parts.push(`<meta property="og:description" content="${escapeHtml(head.description)}"/>`)
    parts.push(`<meta name="twitter:description" content="${escapeHtml(head.description)}"/>`)
  }
  if (head.canonical && canonical) {
    parts.push(`<link rel="canonical" href="${escapeHtml(head.canonical)}"/>`)
    parts.push(`<meta property="og:url" content="${escapeHtml(head.canonical)}"/>`)
  }
  if (head.ogImage) {
    parts.push(`<meta property="og:image" content="${escapeHtml(head.ogImage)}"/>`)
    parts.push(`<meta name="twitter:image" content="${escapeHtml(head.ogImage)}"/>`)
  }
  for (const doc of (head.jsonLd || [])) {
    parts.push(`<script type="application/ld+json">${JSON.stringify(doc)}</script>`)
  }
  return parts.join('\n    ')
}
