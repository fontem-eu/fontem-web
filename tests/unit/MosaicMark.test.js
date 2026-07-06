import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MosaicMark from '../../src/components/MosaicMark.vue'

describe('MosaicMark (Ariadne\'s Labyrinth)', () => {
  it('draws three labyrinth walls + the gold Ariadne thread', () => {
    const w = mount(MosaicMark)
    expect(w.find('svg').attributes('aria-hidden')).toBe('true')
    expect(w.findAll('polyline.mm-wall').length).toBe(3)
    const thread = w.find('polyline.mm-thread')
    expect(thread.exists()).toBe(true)
    expect(thread.attributes('stroke')).toBe('#c9a227') // gold thread
  })

  it('beads the thread with tesserae and anchors a gold source at the centre', () => {
    const w = mount(MosaicMark)
    const circles = w.findAll('circle')
    expect(circles.length).toBe(11) // 10 record-beads + 1 source
    const source = circles.at(-1)
    expect(source.attributes('cx')).toBe('32')
    expect(source.attributes('cy')).toBe('32')
    expect(source.attributes('fill')).toBe('#c9a227')
  })

  it('weaves dark drawing stones among the record-beads', () => {
    const w = mount(MosaicMark)
    const draw = w.findAll('circle.mm-draw')
    expect(draw.length).toBeGreaterThanOrEqual(2)
    const fills = draw.map((c) => c.attributes('fill'))
    expect(fills.some((f) => f === '#2e1d10' || f === '#7a4a28')).toBe(true)
  })

  it('honours the size prop', () => {
    const w = mount(MosaicMark, { props: { size: 48 } })
    expect(w.find('svg').attributes('width')).toBe('48')
  })
})
