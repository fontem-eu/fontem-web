import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MosaicMark from '../../src/components/MosaicMark.vue'

describe('MosaicMark', () => {
  it('renders the tesserae ring + a gold source-point, decorative by default', () => {
    const w = mount(MosaicMark)
    const svg = w.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('aria-hidden')).toBe('true') // name comes from the wrapper
    // 36 tesserae + the central spring-point
    expect(w.findAll('rect').length).toBe(36)
    const dot = w.find('circle')
    expect(dot.attributes('fill')).toBe('#c9a227') // manuscript gold
  })

  it('weaves the dark drawing stones through the ring', () => {
    const w = mount(MosaicMark)
    const draw = w.findAll('rect.mm-draw')
    // the dark stones are a minority but must be present — the mark
    // does not hold together without them
    expect(draw.length).toBeGreaterThanOrEqual(6)
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
