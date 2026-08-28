/**
 * Tests for the client-side HTML sanitization (DOMPurify wrapper).
 * Defense-in-depth layer — the server also sanitizes via nh3.
 */
import { describe, it, expect } from 'vitest'
import { sanitizeHtml, sanitizeMarkdown } from '../../src/utils/sanitize.js'

describe('sanitizeHtml', () => {
  it('preserves safe HTML', () => {
    expect(sanitizeHtml('<p>Hello <strong>world</strong></p>')).toContain('<strong>world</strong>')
  })

  it('strips script tags', () => {
    const result = sanitizeHtml('<p>safe</p><script>alert("xss")</script>')
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('alert')
    expect(result).toContain('safe')
  })

  it('strips event handlers', () => {
    const result = sanitizeHtml('<img src="x" onerror="alert(1)">')
    expect(result).not.toContain('onerror')
  })

  it('strips javascript: URLs', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>')
    expect(result).not.toContain('javascript:')
  })

  it('strips iframe', () => {
    expect(sanitizeHtml('<iframe src="evil.com">')).not.toContain('<iframe')
  })

  it('preserves links with safe hrefs', () => {
    const result = sanitizeHtml('<a href="https://example.com">link</a>')
    expect(result).toContain('https://example.com')
  })

  it('preserves images with safe src', () => {
    const result = sanitizeHtml('<img src="https://example.com/img.png" alt="photo">')
    expect(result).toContain('img.png')
  })

  it('returns empty string for falsy input', () => {
    expect(sanitizeHtml('')).toBe('')
    expect(sanitizeHtml(null)).toBe('')
    expect(sanitizeHtml(undefined)).toBe('')
  })
})

describe('sanitizeMarkdown', () => {
  it('strips script tags from markdown-rendered HTML', () => {
    const result = sanitizeMarkdown('<p>text</p><script>bad()</script>')
    expect(result).not.toContain('<script>')
  })

  it('strips form elements', () => {
    const result = sanitizeMarkdown('<form><input type="text"></form>')
    expect(result).not.toContain('<form')
    expect(result).not.toContain('<input')
  })

  it('preserves code blocks', () => {
    const result = sanitizeMarkdown('<pre><code>const x = 1;</code></pre>')
    expect(result).toContain('const x = 1;')
  })

  it('returns empty string for falsy input', () => {
    expect(sanitizeMarkdown('')).toBe('')
    expect(sanitizeMarkdown(null)).toBe('')
  })
})

// SEC-2026-06-11 #10 — `style` attribute must be stripped from
// markdown-sanitized HTML so a CSS `url(javascript:…)` payload
// can't ride through. Non-exploitable on current browsers (they
// dropped support ~2017), defence-in-depth.
describe('sanitizeMarkdown (security review #10)', () => {
  it('strips bare style attributes', () => {
    const out = sanitizeMarkdown('<p style="color:red">hi</p>')
    expect(out).not.toContain('style=')
    expect(out).toContain('hi')
  })

  it('strips a CSS url(javascript:…) payload that survived in style', () => {
    const dirty = `<div style="background:url(javascript:alert('xss'))">x</div>`
    const out = sanitizeMarkdown(dirty)
    expect(out).not.toContain('javascript:')
    expect(out).not.toContain('style=')
  })

  it('strips style on inline elements too', () => {
    const out = sanitizeMarkdown('<span style="background:#fff">ok</span>')
    expect(out).not.toMatch(/style=/i)
  })
})

// ── Mutation-hardening: pin the allow/forbid lists ──────────────────
// Each entry below is load-bearing config. Dropping any allowed tag or
// attribute (or re-enabling data attributes) must fail a test, not ship.
describe('sanitizeHtml allow-list is exact', () => {
  const WRAPPED_TAGS = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'span', 'sub', 'sup', 'mark',
  ]
  it.each(WRAPPED_TAGS)('preserves <%s>', (tag) => {
    expect(sanitizeHtml(`<${tag}>x</${tag}>`)).toContain(`<${tag}>`)
  })

  it('preserves void and structural tags', () => {
    expect(sanitizeHtml('a<br>b')).toContain('<br')
    expect(sanitizeHtml('a<hr>b')).toContain('<hr')
    expect(sanitizeHtml('<ul><li>x</li></ul>')).toContain('<ul>')
    expect(sanitizeHtml('<ol><li>x</li></ol>')).toContain('<ol>')
    expect(sanitizeHtml('<ul><li>x</li></ul>')).toContain('<li>')
    expect(sanitizeHtml('<a href="https://e.com">x</a>')).toContain('<a ')
    expect(sanitizeHtml('<img src="https://e.com/i.png">')).toContain('<img')
  })

  it('preserves the full table structure', () => {
    const out = sanitizeHtml(
      '<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>c</td></tr></tbody></table>')
    for (const t of ['<table>', '<thead>', '<tbody>', '<tr>', '<th>', '<td>']) {
      expect(out).toContain(t)
    }
  })

  it('preserves each allowed attribute', () => {
    const a = sanitizeHtml('<a href="https://e.com" title="t" target="_blank" rel="noopener">x</a>')
    for (const attr of ['href=', 'title=', 'target=', 'rel=']) expect(a).toContain(attr)
    const img = sanitizeHtml('<img src="https://e.com/i.png" alt="a" width="10" height="20">')
    for (const attr of ['src=', 'alt=', 'width=', 'height=']) expect(img).toContain(attr)
    expect(sanitizeHtml('<span class="c">x</span>')).toContain('class=')
    const td = sanitizeHtml('<table><tr><td colspan="2" rowspan="3">x</td></tr></table>')
    expect(td).toContain('colspan=')
    expect(td).toContain('rowspan=')
  })

  it('strips tags outside the allow-list even when harmless', () => {
    expect(sanitizeHtml('<details><summary>x</summary></details>')).not.toContain('<details')
    expect(sanitizeHtml('<video src="v.mp4"></video>')).not.toContain('<video')
  })

  it('strips data attributes (ALLOW_DATA_ATTR is off)', () => {
    expect(sanitizeHtml('<p data-x="1">x</p>')).not.toContain('data-x')
  })

  it('coerces non-string falsy-ish input to empty, not stringified', () => {
    // DOMPurify.sanitize(0) would return '0'; our guard must win.
    expect(sanitizeHtml(0)).toBe('')
  })
})

describe('sanitizeMarkdown forbid-list is exact', () => {
  it.each(['style', 'form', 'input', 'textarea', 'script', 'iframe', 'object', 'embed'])(
    'strips <%s>', (tag) => {
      const out = sanitizeMarkdown(`<p>ok</p><${tag}>x</${tag}>`)
      expect(out).not.toContain(`<${tag}`)
      expect(out).toContain('ok')
    })

  it('strips data attributes too', () => {
    expect(sanitizeMarkdown('<p data-x="1">x</p>')).not.toContain('data-x')
  })

  it('coerces non-string falsy-ish input to empty, not stringified', () => {
    expect(sanitizeMarkdown(0)).toBe('')
  })
})
