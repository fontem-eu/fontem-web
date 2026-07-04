import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CorrMatrix from '../../src/components/charts/CorrMatrix.vue'

describe('CorrMatrix', () => {
  it('renders a cell per pair with the r value labelled', () => {
    const w = mount(CorrMatrix, {
      props: { vars: ['rape', 'migration'], matrix: [[1, 0.83], [0.83, 1]] },
    })
    const cells = w.findAll('rect.cm-cell')
    expect(cells.length).toBe(4) // 2x2
    expect(w.text()).toContain('0.83')
    expect(w.text()).toContain('1.00')
    // headers name both variables
    expect(w.text()).toContain('rape')
    expect(w.text()).toContain('migration')
  })

  it('formats a negative r with a proper minus sign', () => {
    const w = mount(CorrMatrix, { props: { vars: ['a', 'b'], matrix: [[1, -0.5], [-0.5, 1]] } })
    expect(w.text()).toContain('−0.50')
  })

  it('needs at least two columns', () => {
    const w = mount(CorrMatrix, { props: { vars: ['only'], matrix: [[1]] } })
    expect(w.text()).toContain('at least two')
  })
  // Regression: in dark mode the cell values went invisible - the text used
  // var(--text) (near-white) on the palette's light diverging-midpoint fill
  // (~1.2:1 contrast). Ink must contrast with its own cell fill in ANY theme,
  // so assert WCAG contrast >= 4.5:1 text-vs-fill using independent math.
  it('keeps every r value readable on its cell fill (dark-mode regression)', () => {
    const lum = (hex) => {
      const n = Number.parseInt(hex.slice(1), 16)
      const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
    }
    const ratio = (a, b) =>
      (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)

    // spans near-zero (the broken band), both arms, and the extremes
    const rs = [0.01, -0.09, 0.1, 0.25, -0.49, 0.6, -0.75, 1]
    const matrix = [rs, [...rs].reverse()]
    const w = mount(CorrMatrix, { props: { vars: ['a', 'b'], matrix } })
    const cells = w.findAll('rect.cm-cell')
    const vals = w.findAll('text.cm-val')
    expect(cells.length).toBe(16)
    vals.forEach((t, i) => {
      const fill = cells[i].attributes('fill')
      const ink = t.attributes('fill')
      expect(ink, `cell r=${t.text()}`).toMatch(/^#/) // hex, not a theme token
      expect(ratio(fill, ink), `contrast for r=${t.text()} on ${fill}`)
        .toBeGreaterThanOrEqual(4.5)
    })
  })
})

