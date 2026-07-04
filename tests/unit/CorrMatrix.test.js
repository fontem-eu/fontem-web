import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CorrMatrix from '../../src/components/charts/CorrMatrix.vue'

describe('CorrMatrix', () => {
  it('labels cells in plain language, not raw numbers', () => {
    const w = mount(CorrMatrix, {
      props: { vars: ['rape', 'migration'], matrix: [[1, 0.83], [0.83, 1]] },
    })
    const cells = w.findAll('rect.cm-cell')
    expect(cells.length).toBe(4) // 2x2
    // off-diagonal r=0.83 -> "strong"; the number itself is NOT in the cell
    const vals = w.findAll('text.cm-val').map((t) => t.text())
    expect(vals).toContain('strong')
    expect(w.text()).not.toContain('0.83')
    // diagonal is blank (self x self carries no information)
    expect(vals.filter((v) => v === '').length).toBe(2)
    // headers name both variables
    expect(w.text()).toContain('rape')
    expect(w.text()).toContain('migration')
    // plain-language threshold key is on the chart
    expect(w.find('[data-testid="cm-thresholds"]').text()).toContain('0.2')
  })

  it('hover reveals the exact r in the readout', async () => {
    const w = mount(CorrMatrix, { props: { vars: ['a', 'b'], matrix: [[1, 0.83], [0.83, 1]] } })
    expect(w.find('[data-testid="cm-hint"]').exists()).toBe(true)
    // second cell of row 0 = a x b
    await w.findAll('svg g g')[1].trigger('mouseenter')
    const ro = w.find('[data-testid="cm-readout"]')
    expect(ro.exists()).toBe(true)
    expect(ro.text()).toContain('a × b')
    expect(ro.text()).toContain('strong')
    expect(ro.text()).toContain('0.83')
  })

  it('tap (click) reveals the readout too — mobile parity', async () => {
    const w = mount(CorrMatrix, { props: { vars: ['a', 'b'], matrix: [[1, -0.5], [-0.5, 1]] } })
    await w.findAll('svg g g')[1].trigger('click')
    const ro = w.find('[data-testid="cm-readout"]')
    expect(ro.text()).toContain('moderate')
    expect(ro.text()).toContain('inverse') // negative r is spelled out
    expect(ro.text()).toContain('−0.50')
  })

  it('near-zero r reads as "none"', () => {
    const w = mount(CorrMatrix, { props: { vars: ['a', 'b'], matrix: [[1, 0.05], [0.05, 1]] } })
    expect(w.findAll('text.cm-val').map((t) => t.text())).toContain('none')
  })

  it('needs at least two columns', () => {
    const w = mount(CorrMatrix, { props: { vars: ['only'], matrix: [[1]] } })
    expect(w.text()).toContain('at least two')
  })

  // Regression: in dark mode the cell values went invisible - the text used
  // var(--text) (near-white) on the palette's light diverging-midpoint fill
  // (~1.2:1 contrast). Ink must contrast with its own cell fill in ANY theme,
  // so assert WCAG contrast >= 4.5:1 text-vs-fill using independent math.
  it('keeps every cell label readable on its fill (dark-mode regression)', () => {
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
      expect(ink, `cell #${i}`).toMatch(/^#/) // hex, not a theme token
      expect(ratio(fill, ink), `contrast for cell #${i} on ${fill}`)
        .toBeGreaterThanOrEqual(4.5)
    })
  })
})
