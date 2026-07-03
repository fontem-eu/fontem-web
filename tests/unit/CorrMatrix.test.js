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
})
