import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import ExploreView from '../../src/views/ExploreView.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/explore', component: ExploreView },
      { path: '/data-quality', component: { template: '<div data-testid="dq-stub" />' } },
      { path: '/sparql', component: { template: '<div data-testid="sparql-stub" />' } },
      { path: '/geo', component: { template: '<div data-testid="geo-stub" />' } },
    ],
  })
}

async function mountExplore() {
  const router = makeRouter()
  await router.push('/explore')
  await router.isReady()
  const wrapper = mount(ExploreView, { global: { plugins: [router] } })
  return { wrapper, router }
}

describe('ExploreView', () => {
  it('renders a top-level heading + intro copy', async () => {
    const { wrapper } = await mountExplore()
    expect(wrapper.find('h1').text()).toBe('Explore')
    expect(wrapper.text()).toContain('source-of-truth')
  })

  it('renders a card per destination (data-quality, sparql, geo)', async () => {
    const { wrapper } = await mountExplore()
    expect(wrapper.find('[data-testid="explore-card-data-quality"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="explore-card-sparql"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="explore-card-geo"]').exists()).toBe(true)
  })

  it('the Data Quality card links to /data-quality', async () => {
    const { wrapper } = await mountExplore()
    const link = wrapper.find('[data-testid="explore-card-data-quality"]')
    expect(link.attributes('href')).toBe('/data-quality')
  })

  it('the other cards expose hrefs matching their declared destinations', async () => {
    const { wrapper } = await mountExplore()
    expect(wrapper.find('[data-testid="explore-card-sparql"]').attributes('href')).toBe('/sparql')
    expect(wrapper.find('[data-testid="explore-card-geo"]').attributes('href')).toBe('/geo')
  })
})
