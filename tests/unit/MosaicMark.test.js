import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MosaicMark from '../../src/components/MosaicMark.vue'

// The mark beads a spiral thread; the deterministic geometry yields 37 beads.
const BEADS = 37

describe('MosaicMark (the Spun Thread)', () => {
  it('draws the thread + beads it with tesserae, decorative by default', () => {
    const w = mount(MosaicMark)
    const svg = w.find('svg')
    expect(svg.attributes('aria-hidden')).toBe('true')
    expect(w.find('path.mm-thread').exists()).toBe(true) // the thread
    expect(w.find('path.mm-thread').attributes('d')).toMatch(/^M/)
    expect(w.findAll('rect').length).toBe(BEADS) // the records on it
  })

  it('anchors a gold source-point — fontem, the spring', () => {
    const w = mount(MosaicMark)
    const circles = w.findAll('circle')
    // a filled gold disc + its lapis ring, both at the spiral centre
    expect(circles.length).toBe(2)
    expect(circles[0].attributes('fill')).toBe('#c9a227')
    expect(circles.every((c) => c.attributes('cx') === '32' && c.attributes('cy') === '32')).toBe(true)
  })

  it('weaves the dark drawing stones through the thread', () => {
    const w = mount(MosaicMark)
    const draw = w.findAll('rect.mm-draw')
    expect(draw.length).toBeGreaterThanOrEqual(5)
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
