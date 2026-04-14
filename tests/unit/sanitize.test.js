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
