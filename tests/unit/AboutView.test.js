import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({
  listReports: vi.fn(() => Promise.resolve([])),
}))

import AboutView from '../../src/views/AboutView.vue'
import { listReports } from '../../src/api/community.js'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/about', component: AboutView },
      // Stubbed for the example-chip <router-link>s.
      { path: '/c/:ticker/:view', component: { template: '<div />' } },
      { path: '/stories/:id', component: { template: '<div />' } },
      { path: '/map', component: { template: '<div />' } },
    ],
  })
}

async function mountAt(path = '/about') {
  const router = makeRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(AboutView, {
    global: { plugins: [router, makeTestI18n()] },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('AboutView', () => {
  beforeEach(() => {
    listReports.mockReset()
    listReports.mockResolvedValue([])
  })
  afterEach(() => vi.restoreAllMocks())

  it('renders the example chips, each as a router-link with a / path', async () => {
    const { wrapper } = await mountAt()
    const chips = wrapper.findAll('[data-testid="example-chips"] a')
    expect(chips.length).toBeGreaterThanOrEqual(3)
    for (const chip of chips) {
      expect(chip.attributes('href')).toMatch(/^\//)
    }
    expect(wrapper.find('[data-testid="example-chip-company"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="example-chip-graph"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="example-chip-story"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="example-chip-map"]').exists()).toBe(true)
  })

  it('renders the mission/vision block with a lead statement and three principles', async () => {
    const { wrapper } = await mountAt()
    const mission = wrapper.find('[data-testid="mission"]')
    expect(mission.exists()).toBe(true)
    // vision-forward lead line
    expect(mission.find('.mission-lead').text()).toContain('civic layer')
    // the three principles, ending on participation (the vision)
    expect(wrapper.find('[data-testid="mission-value-sourced"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mission-value-open"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mission-value-participation"]').exists()).toBe(true)
    expect(mission.findAll('.mission-value')).toHaveLength(3)
  })

  it('leads the page with the mission, before the recent-stories carousel', async () => {
    const { wrapper } = await mountAt()
    const html = wrapper.html()
    // mission block appears earlier in the DOM than the how-it-works grid
    expect(html.indexOf('data-testid="mission"')).toBeLessThan(html.indexOf('data-testid="howitworks"'))
  })

  it('renders three "how it works" steps with names + descriptions', async () => {
    const { wrapper } = await mountAt()
    const steps = wrapper.findAll('[data-testid="howitworks"] .howitworks-step')
    expect(steps).toHaveLength(3)
    expect(wrapper.find('[data-testid="howitworks-step-search"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="howitworks-step-crosscheck"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="howitworks-step-publish"]').exists()).toBe(true)
  })

  it('does not render a GIF slot until a step has a gif set (default state)', async () => {
    const { wrapper } = await mountAt()
    const steps = wrapper.findAll('[data-testid="howitworks"] .howitworks-step')
    for (const step of steps) {
      expect(step.classes()).not.toContain('has-gif')
      expect(step.find('.howitworks-gif').exists()).toBe(false)
    }
  })

  it('fetches recent public reports and hands them to the carousel', async () => {
    listReports.mockResolvedValueOnce([
      { id: 'r1', title: 'Report A', abstract: 'short', updated_at: '2026-04-01' },
      { id: 'r2', title: 'Report B', abstract: 'short', updated_at: '2026-04-02' },
      { id: 'r3', title: 'Report C', abstract: 'short', updated_at: '2026-04-03' },
    ])
    const { wrapper } = await mountAt()
    expect(listReports).toHaveBeenCalledWith({ scope: 'public', limit: 8 })
    expect(wrapper.find('[data-testid="recent-carousel"]').exists()).toBe(true)
    const cards = wrapper.findAll('[data-testid="recent-carousel"] .card')
    expect(cards).toHaveLength(3)
    expect(cards[0].text()).toContain('Report A')
  })

  it('silently hides the recent-stories section when the API errors', async () => {
    listReports.mockRejectedValueOnce(new Error('500'))
    const { wrapper } = await mountAt()
    expect(wrapper.find('[data-testid="recent-stories"]').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/error|failed|sorry/i)
  })

  it('embeds the demo video', async () => {
    const { wrapper } = await mountAt()
    const section = wrapper.find('[data-testid="landing-demo"]')
    expect(section.exists()).toBe(true)
    const video = section.find('video')
    expect(video.attributes('src')).toBe('/landing-demo.mp4')
  })
})
