/**
 * ThemeScaffoldView: config-driven theme landing for the non-procurement
 * themes — renders the framing questions + one pipeline panel per source.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-router', () => ({ useRoute: () => ({ params: { themeId: 'corporate' } }) }))

import ThemeScaffoldView from '../../src/views/themes/ThemeScaffoldView.vue'
import { SCAFFOLD } from '../../src/views/themes/themeConfig.js'

const stubs = {
  ThemeToggle: true,
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  SourcePipelinePanel: { props: ['sourceId', 'title'], template: '<div class="panel">{{ sourceId }}</div>' },
}

describe('ThemeScaffoldView', () => {
  it('renders the corporate theme: questions + a panel per source', () => {
    const w = mount(ThemeScaffoldView, { global: { stubs } })
    expect(w.text()).toContain('Corporate Ownership')
    // every configured question shows
    for (const q of SCAFFOLD.corporate.questions) expect(w.text()).toContain(q)
    // one pipeline panel per configured source
    expect(w.findAll('.panel').length).toBe(SCAFFOLD.corporate.sources.length)
    expect(w.find('.panel').text()).toBe('gleif')
  })
})
