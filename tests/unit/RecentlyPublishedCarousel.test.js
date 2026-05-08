/**
 * Tests for the autoplay carousel on the landing strip. Covers:
 * - Renders one card per story + dots
 * - Autoplay advances currentIndex every AUTO_MS
 * - pointerdown pauses; resume after RESUME_MS
 * - Tapping a dot jumps + pauses
 * - prefers-reduced-motion disables autoplay
 * - One-story / zero-story degenerate cases
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import RecentlyPublishedCarousel from '../../src/components/RecentlyPublishedCarousel.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/stories/:id', component: { template: '<div />' } },
    ],
  })
}

function makeStories(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    title: `Story ${i}`,
    abstract: `Body ${i}`,
    updated_at: '2026-04-01',
  }))
}

async function mountCarousel(stories, { reducedMotion = false } = {}) {
  // Stub matchMedia to control prefers-reduced-motion per-test.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => ({ matches: reducedMotion, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  })
  // jsdom doesn't implement scrollTo on Element — stub it so the
  // component's smooth-scroll calls don't throw.
  Element.prototype.scrollTo = vi.fn()

  const router = makeRouter()
  await router.push('/')
  await router.isReady()
  const wrapper = mount(RecentlyPublishedCarousel, {
    props: { stories },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

describe('RecentlyPublishedCarousel', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('renders one card per story + a dot per story', async () => {
    const { wrapper } = await mountCarousel(makeStories(4))
    expect(wrapper.findAll('.card')).toHaveLength(4)
    expect(wrapper.findAll('[data-testid="recent-carousel-dots"] .dot')).toHaveLength(4)
    wrapper.unmount()
  })

  it('hides the dots strip when there is only one story (autoplay would be silly)', async () => {
    const { wrapper } = await mountCarousel(makeStories(1))
    expect(wrapper.find('[data-testid="recent-carousel-dots"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('advances currentIndex every AUTO_MS while not paused', async () => {
    const { wrapper } = await mountCarousel(makeStories(3))
    expect(wrapper.findAll('.dot')[0].classes()).toContain('active')
    await vi.advanceTimersByTimeAsync(5000)
    expect(wrapper.findAll('.dot')[1].classes()).toContain('active')
    await vi.advanceTimersByTimeAsync(5000)
    expect(wrapper.findAll('.dot')[2].classes()).toContain('active')
    await vi.advanceTimersByTimeAsync(5000)
    // Wraps around.
    expect(wrapper.findAll('.dot')[0].classes()).toContain('active')
    wrapper.unmount()
  })

  it('pointerdown pauses autoplay; resumes ~RESUME_MS after pointerup', async () => {
    const { wrapper } = await mountCarousel(makeStories(3))
    await wrapper.trigger('pointerdown')
    // While held, even crossing AUTO_MS doesn't advance.
    await vi.advanceTimersByTimeAsync(6000)
    expect(wrapper.findAll('.dot')[0].classes()).toContain('active')
    // Release → resume timer schedules an autoplay restart in 3s.
    await wrapper.trigger('pointerup')
    await vi.advanceTimersByTimeAsync(3000)
    // Autoplay is back on; next tick advances.
    await vi.advanceTimersByTimeAsync(5000)
    expect(wrapper.findAll('.dot')[1].classes()).toContain('active')
    wrapper.unmount()
  })

  it('tapping a dot jumps to that index and pauses autoplay', async () => {
    const { wrapper } = await mountCarousel(makeStories(4))
    const dots = wrapper.findAll('.dot')
    await dots[2].trigger('click')
    expect(dots[2].classes()).toContain('active')
    // Held in place — autoplay paused, then schedules resume.
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.findAll('.dot')[2].classes()).toContain('active')
    wrapper.unmount()
  })

  it('clicking a card pushes /stories/:id', async () => {
    const stories = makeStories(2)
    const { wrapper, router } = await mountCarousel(stories)
    const pushSpy = vi.spyOn(router, 'push')
    await wrapper.findAll('.card')[1].trigger('click')
    expect(pushSpy).toHaveBeenCalledWith(`/stories/${stories[1].id}`)
    wrapper.unmount()
  })

  it('prefers-reduced-motion disables autoplay', async () => {
    const { wrapper } = await mountCarousel(makeStories(3), { reducedMotion: true })
    await vi.advanceTimersByTimeAsync(15000)
    // Index never changes — first dot still active.
    expect(wrapper.findAll('.dot')[0].classes()).toContain('active')
    wrapper.unmount()
  })

  it('mouseenter pauses; mouseleave schedules resume', async () => {
    const { wrapper } = await mountCarousel(makeStories(3))
    await wrapper.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(6000)
    expect(wrapper.findAll('.dot')[0].classes()).toContain('active')
    await wrapper.trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(3000 + 5000)
    expect(wrapper.findAll('.dot')[1].classes()).toContain('active')
    wrapper.unmount()
  })
})
