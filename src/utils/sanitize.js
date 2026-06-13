/**
 * Client-side HTML sanitization — defense-in-depth layer.
 *
 * The server already sanitizes on write (nh3). This catches anything
 * that was stored before server sanitization was deployed, or any
 * edge case where the server layer is bypassed.
 */
import DOMPurify from 'dompurify'

// Tags that TipTap's StarterKit legitimately produces.
const ALLOWED_TAGS = [
  // Block
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'code',
  'ul', 'ol', 'li',
  // Inline
  'strong', 'b', 'em', 'i', 'u', 's', 'del',
  'a', 'span', 'sub', 'sup', 'mark',
  // Media
  'img',
  // Table
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
]

const ALLOWED_ATTR = [
  'href', 'title', 'target', 'rel',
  'src', 'alt', 'width', 'height',
  'class', 'colspan', 'rowspan',
]

/**
 * Sanitize HTML for safe v-html rendering.
 * Strips script, iframe, event handlers, javascript: URLs, etc.
 */
export function sanitizeHtml(dirty) {
  if (!dirty) return ''
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  })
}

/**
 * Sanitize markdown-rendered HTML (more permissive — allows code blocks etc.)
 */
export function sanitizeMarkdown(dirty) {
  if (!dirty) return ''
  return DOMPurify.sanitize(dirty, {
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea'],
    // ``style`` is forbidden because DOMPurify lets it through by
    // default and a CSS `url(javascript:...)` payload would survive
    // markdown sanitization. Modern browsers don't execute that today
    // (Chrome/Firefox/Safari dropped support ~2017) but pinning the
    // attribute out is the defence-in-depth — none of our authoring
    // flows actually want inline styles. See security review #10.
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'style'],
  })
}
