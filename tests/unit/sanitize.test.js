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
