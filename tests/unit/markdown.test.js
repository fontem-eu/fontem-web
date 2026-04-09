import { describe, it, expect } from 'vitest'

/**
 * Test the markdown detection logic used in ReportView.
 * This mirrors the isMarkdown() function.
 */
function isMarkdown(content) {
  if (!content) return false
  const trimmed = content.trim()
  if (/^<[a-z][\s\S]*>/i.test(trimmed)) return false
  if (/^#{1,6}\s|^\*\*|^- |^\d+\.\s|^\|.*\|/m.test(trimmed)) return true
  if (!/<[a-z][\s\S]*?>/i.test(trimmed)) return true
  return false
}

describe('isMarkdown', () => {
  it('detects markdown headings', () => {
    expect(isMarkdown('# Hello World')).toBe(true)
    expect(isMarkdown('## Subheading')).toBe(true)
    expect(isMarkdown('### Third level')).toBe(true)
  })

  it('detects markdown lists', () => {
    expect(isMarkdown('- Item one\n- Item two')).toBe(true)
    expect(isMarkdown('1. First\n2. Second')).toBe(true)
  })

  it('detects markdown bold', () => {
    expect(isMarkdown('**bold text** here')).toBe(true)
  })

  it('detects markdown tables', () => {
    expect(isMarkdown('| Name | Value |\n|------|-------|\n| A | 1 |')).toBe(true)
  })

  it('detects plain text as markdown', () => {
    expect(isMarkdown('Just some plain text')).toBe(true)
  })

  it('detects TipTap HTML as not markdown', () => {
    expect(isMarkdown('<p>Hello world</p>')).toBe(false)
    expect(isMarkdown('<h1>Title</h1><p>Content</p>')).toBe(false)
    expect(isMarkdown('<ul><li>Item</li></ul>')).toBe(false)
  })

  it('handles empty/null input', () => {
    expect(isMarkdown('')).toBe(false)
    expect(isMarkdown(null)).toBe(false)
    expect(isMarkdown(undefined)).toBe(false)
  })
})
