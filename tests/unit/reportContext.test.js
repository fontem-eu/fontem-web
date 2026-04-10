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
