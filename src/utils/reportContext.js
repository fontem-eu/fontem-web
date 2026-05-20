/**
 * Build a plain-text "report context block" for the assistant agent.
 *
 * The assistant module is self-contained and takes this string as an
 * opaque blob — it will budget/truncate it internally. Our job here is
 * just to render the user's in-memory editor state into something the
 * LLM can read.
 *
 * Shape in:
 *   { title, abstract, sections: [{ id, html } | { markdownMode: true, markdownText }] }
 *
 * Shape out:
 *   A markdown-ish string like:
 *     # Siemens investigation
 *
 *     Brief abstract.
 *
 *     ## Section 1
 *     Body text.
 *
 *     ## Section 2
 *     More text.
 *
 * HTML in section bodies is stripped to plain text (preserving widget
 * code fences which carry structured data the LLM may want to reason
 * about).
 */

function stripHtml(html) {
  if (!html || typeof html !== 'string') return ''
  // Turn <br> and block closes into newlines so paragraphs survive
  let out = html
    .replaceAll(/<\s*br\s*\/?\s*>/gi, '\n')
    .replaceAll(/<\/(p|div|h[1-6]|li)>/gi, '\n')
  // Drop everything else tag-ish
  out = out.replaceAll(/<[^>]+>/g, '')
  // Decode the handful of entities tiptap emits
  out = out
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
  // Collapse excessive whitespace
  return out.replaceAll(/\n{3,}/g, '\n\n').trim()
}

function sectionToText(section) {
  if (!section) return ''
  if (section.markdownMode) {
    return (section.markdownText || '').trim()
  }
  return stripHtml(section.html || section.content || '')
}

export function buildReportContext(report) {
  if (!report || typeof report !== 'object') return ''

  const parts = []

  if (report.title?.trim()) {
    parts.push(`# ${report.title.trim()}`)
  }

  if (report.abstract?.trim()) {
    parts.push(report.abstract.trim())
  }

  const sections = Array.isArray(report.sections) ? report.sections : []
  sections.forEach((section, idx) => {
    const body = sectionToText(section)
    parts.push(`## Section ${idx + 1}`)
    if (body) parts.push(body)
  })

  return parts.join('\n\n').trim()
}
