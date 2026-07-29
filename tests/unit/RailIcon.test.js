import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RailIcon from '../../src/components/RailIcon.vue'

/**
 * The icon must carry its own dimensions. They used to come from a
 * `.rail-icon` rule in AppSidebar's *scoped* style, which meant the icon
 * was correctly sized only when rendered by that one component; used
 * from anywhere else (SettingsMenu) the rule didn't match and the SVG
 * fell back to the browser default for a sizeless replaced element.
 */
describe('RailIcon', () => {
  const NAMES = ['stories', 'petitions', 'explore', 'map', 'studio', 'mystories', 'account', 'chevron', 'settings']

  it.each(NAMES)('renders %s at 20x20 regardless of the parent', (name) => {
    const svg = mount(RailIcon, { props: { name } }).find('svg')
    expect(svg.attributes('width')).toBe('20')
    expect(svg.attributes('height')).toBe('20')
  })

  it.each(NAMES)('draws actual geometry for %s', (name) => {
    // A name with no matching branch would render an empty <svg> that
    // still passes the size assertion above.
    const w = mount(RailIcon, { props: { name } })
    expect(w.find('svg').element.children.length).toBeGreaterThan(0)
  })

  it('shares one viewBox so every glyph is on the same grid', () => {
    for (const name of NAMES) {
      expect(mount(RailIcon, { props: { name } }).find('svg').attributes('viewBox')).toBe('0 0 24 24')
    }
  })
})
