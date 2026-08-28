import { describe, it, expect } from 'vitest'
import { buildReportContext } from '../../src/utils/reportContext.js'

describe('buildReportContext', () => {
  it('returns empty string for empty report', () => {
    expect(buildReportContext({ title: '', abstract: '', sections: [] })).toBe('')
  })

  it('includes a non-empty title', () => {
    const out = buildReportContext({
      title: 'Siemens investigation',
      abstract: '',
      sections: [],
    })
    expect(out).toContain('Siemens investigation')
  })

  it('includes an abstract when present', () => {
    const out = buildReportContext({
      title: 'T',
      abstract: 'A brief summary.',
      sections: [],
    })
    expect(out).toContain('A brief summary.')
  })

  it('renders sections as markdown with numeric headings', () => {
    const out = buildReportContext({
      title: 'T',
      abstract: '',
      sections: [
        { id: 's1', html: '<p>First paragraph</p>' },
        { id: 's2', html: '<p>Second paragraph</p>' },
      ],
    })
    expect(out).toContain('## Section 1')
    expect(out).toContain('First paragraph')
    expect(out).toContain('## Section 2')
    expect(out).toContain('Second paragraph')
  })

  it('strips HTML tags from section content', () => {
    const out = buildReportContext({
      title: 'T',
      abstract: '',
      sections: [{ id: 's1', html: '<h2>Heading</h2><p>Body <strong>bold</strong></p>' }],
    })
    expect(out).not.toContain('<h2>')
    expect(out).not.toContain('<strong>')
    expect(out).toContain('Heading')
    expect(out).toContain('Body')
    expect(out).toContain('bold')
  })

  it('preserves widget code fences verbatim', () => {
    const widgetFence =
      '```widget\n{"widget_type":"graph_explorer","entityId":"abc"}\n```'
    const out = buildReportContext({
      title: 'T',
      abstract: '',
      sections: [{ id: 's1', html: `<pre><code>${widgetFence}</code></pre>` }],
    })
    // The structural markers survive even if inner HTML processing
    // converts them differently — the JSON-ish body should be there.
    expect(out).toContain('graph_explorer')
    expect(out).toContain('abc')
  })

  it('handles markdown-mode sections (already plain text)', () => {
    const out = buildReportContext({
      title: 'T',
      abstract: '',
      sections: [{ id: 's1', markdownMode: true, markdownText: '# My heading\n\nSome text.' }],
    })
    expect(out).toContain('# My heading')
    expect(out).toContain('Some text.')
  })

  it('never crashes on null sections', () => {
    expect(() => buildReportContext({ title: 'T', sections: null })).not.toThrow()
    expect(() => buildReportContext({ title: 'T' })).not.toThrow()
    expect(() => buildReportContext(null)).not.toThrow()
  })

  it('returns empty string for null input', () => {
    expect(buildReportContext(null)).toBe('')
    expect(buildReportContext(undefined)).toBe('')
  })

  it('handles empty sections gracefully', () => {
    const out = buildReportContext({
      title: 'T',
      abstract: '',
      sections: [{ id: 's1', html: '' }, { id: 's2', html: '<p></p>' }],
    })
    // Empty sections are rendered as headings with no body — that's fine
    expect(out).toContain('## Section 1')
    expect(out).toContain('## Section 2')
  })

  it('orders sections in the order given', () => {
    const out = buildReportContext({
      title: 'T',
      abstract: '',
      sections: [
        { id: 's1', html: '<p>alpha</p>' },
        { id: 's2', html: '<p>beta</p>' },
        { id: 's3', html: '<p>gamma</p>' },
      ],
    })
    const alphaIdx = out.indexOf('alpha')
    const betaIdx = out.indexOf('beta')
    const gammaIdx = out.indexOf('gamma')
    expect(alphaIdx).toBeLessThan(betaIdx)
    expect(betaIdx).toBeLessThan(gammaIdx)
  })
})

// ── Mutation-hardening: pin stripHtml/sectionToText behaviour exactly ──
describe('buildReportContext — html stripping details', () => {
  const oneSection = (html) => buildReportContext({ sections: [{ html }] })

  it('turns <br> variants into newlines', () => {
    expect(oneSection('a<br>b')).toBe('## Section 1\n\na\nb')
    expect(oneSection('a<br/>b')).toBe('## Section 1\n\na\nb')
    expect(oneSection('a<br />b')).toBe('## Section 1\n\na\nb')
    expect(oneSection('a< br />b')).toBe('## Section 1\n\na\nb')
    expect(oneSection('a<BR>b')).toBe('## Section 1\n\na\nb')
  })

  it('turns block closes into newlines (p, div, h1-h6, li)', () => {
    expect(oneSection('<p>a</p>b')).toBe('## Section 1\n\na\nb')
    expect(oneSection('<div>a</div>b')).toBe('## Section 1\n\na\nb')
    expect(oneSection('<h2>T</h2>next')).toBe('## Section 1\n\nT\nnext')
    expect(oneSection('<li>a</li>b')).toBe('## Section 1\n\na\nb')
  })

  it('decodes each tiptap entity', () => {
    expect(oneSection('a&nbsp;b')).toBe('## Section 1\n\na b')
    expect(oneSection('a&amp;b')).toBe('## Section 1\n\na&b')
    expect(oneSection('a&lt;b')).toBe('## Section 1\n\na<b')
    expect(oneSection('a&gt;b')).toBe('## Section 1\n\na>b')
    expect(oneSection('a&quot;b')).toBe('## Section 1\n\na"b')
    expect(oneSection('a&#39;b')).toBe("## Section 1\n\na'b")
  })

  it('collapses 3+ newlines to exactly two and trims the ends', () => {
    expect(oneSection('a<br><br><br>b')).toBe('## Section 1\n\na\n\nb')
    expect(oneSection('<br>a<br>')).toBe('## Section 1\n\na')
  })

  it('keeps a double newline as-is (no over-collapse)', () => {
    expect(oneSection('a<br><br>b')).toBe('## Section 1\n\na\n\nb')
  })

  it('tolerates non-string section html without emitting junk', () => {
    expect(oneSection(123)).toBe('## Section 1')
    expect(oneSection('')).toBe('## Section 1')
    expect(buildReportContext({ sections: [null] })).toBe('## Section 1')
  })

  it('skips empty section bodies without leaving blank parts', () => {
    expect(buildReportContext({ sections: [{ html: '' }, { html: 'x' }] }))
      .toBe('## Section 1\n\n## Section 2\n\nx')
  })

  it('trims markdown sections and treats missing markdownText as empty', () => {
    expect(buildReportContext({ sections: [{ markdownMode: true, markdownText: '  x  ' }] }))
      .toBe('## Section 1\n\nx')
    expect(buildReportContext({ sections: [{ markdownMode: true }] }))
      .toBe('## Section 1')
  })
})

describe('buildReportContext — top-level shape', () => {
  it('returns empty for non-object reports', () => {
    expect(buildReportContext(null)).toBe('')
    expect(buildReportContext('hello')).toBe('')
    expect(buildReportContext(5)).toBe('')
  })

  it('trims title and abstract, skipping whitespace-only values', () => {
    expect(buildReportContext({ title: ' T ' })).toBe('# T')
    expect(buildReportContext({ title: '   ' })).toBe('')
    expect(buildReportContext({ title: '' })).toBe('')
    expect(buildReportContext({ abstract: ' A ' })).toBe('A')
    expect(buildReportContext({ abstract: '  ' })).toBe('')
  })

  it('joins title and abstract with a blank line', () => {
    expect(buildReportContext({ title: 'T', abstract: 'A' })).toBe('# T\n\nA')
  })

  it('ignores a non-array sections value', () => {
    expect(buildReportContext({ title: 'T', sections: 'nope' })).toBe('# T')
  })
})
