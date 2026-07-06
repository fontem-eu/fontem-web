import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MosaicMark from '../../src/components/MosaicMark.vue'

// The mark tiles a low-res Europe silhouette; the grid has 82 land cells.
const LAND = 82

describe('MosaicMark', () => {
  it('tiles the Europe silhouette in tesserae, decorative by default', () => {
    const w = mount(MosaicMark)
    const svg = w.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('aria-hidden')).toBe('true')
    expect(w.findAll('rect').length).toBe(LAND)
  })

  it('marks a single gold source tile — fontem, the spring', () => {
    const w = mount(MosaicMark)
    const src = w.findAll('rect.mm-src')
    expect(src.length).toBe(1)
    expect(src[0].attributes('fill')).toBe('#c9a227')
  })

  it('weaves the dark drawing stones through the figure', () => {
    const w = mount(MosaicMark)
    const draw = w.findAll('rect.mm-draw')
    expect(draw.length).toBeGreaterThanOrEqual(10)
    const fills = draw.map((r) => r.attributes('fill'))
    expect(fills).toContain('#2e1d10') // onyx
    expect(fills).toContain('#7a4a28') // umber
  })

  it('honours the size prop', () => {
    const w = mount(MosaicMark, { props: { size: 48 } })
    expect(w.find('svg').attributes('width')).toBe('48')
    expect(w.find('svg').attributes('height')).toBe('48')
  })
})
