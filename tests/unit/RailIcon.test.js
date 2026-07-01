import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RailIcon from '../../src/components/RailIcon.vue'

describe('RailIcon', () => {
  for (const name of ['stories', 'spending', 'map', 'explore', 'mystories', 'account', 'chevron']) {
    it(`renders an svg for "${name}"`, () => {
      const w = mount(RailIcon, { props: { name } })
      const svg = w.find('svg')
      expect(svg.exists()).toBe(true)
      expect(svg.element.querySelectorAll('*').length).toBeGreaterThan(0)
    })
  }
  it('renders an empty svg for an unknown name (no crash)', () => {
    const w = mount(RailIcon, { props: { name: 'nope' } })
    expect(w.find('svg').exists()).toBe(true)
  })
})
