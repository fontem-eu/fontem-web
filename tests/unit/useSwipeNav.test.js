/**
 * Horizontal swipe navigation between the top-level views.
 * Synthetic touch events (jsdom has no Touch constructor — plain Events
 * with touches/changedTouches attached reach the window listeners fine).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { _internal } from '../../src/api/session.js'
import { useSwipeNav } from '../../src/composables/useSwipeNav.js'

const stub = { render: () => null }

function makeApp(initialPath) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/', '/spending', '/map', '/my-stories', '/about']
      .map((path) => ({ path, component: stub })),
  })
  const Host = defineComponent({ setup() { useSwipeNav(); return () => h('div') } })
  router.push(initialPath)
  return { router, Host }
}

function touch(type, x, y) {
  const e = new Event(type)
  const t = { clientX: x, clientY: y }
  e.touches = [t]
  e.changedTouches = [t]
  globalThis.dispatchEvent(e)
}

async function swipe(fromX, fromY, toX, toY) {
  touch('touchstart', fromX, fromY)
  const e = new Event('touchend')
  e.changedTouches = [{ clientX: toX, clientY: toY }]
  globalThis.dispatchEvent(e)
  await flushPromises()
}

let wrapper = null
afterEach(() => { wrapper?.unmount(); wrapper = null })
beforeEach(() => { _internal.clearForTests(); localStorage.clear() })

describe('useSwipeNav', () => {
  it('swiping left advances along the public ring', async () => {
    const { router, Host } = makeApp('/')
    await router.isReady()
    wrapper = mount(Host, { global: { plugins: [router] } })
    await swipe(200, 100, 80, 100)
    expect(router.currentRoute.value.path).toBe('/spending')
    await swipe(200, 100, 80, 100)
    expect(router.currentRoute.value.path).toBe('/map')
  })

  it('swiping right goes back, stopping at the ring edges', async () => {
    const { router, Host } = makeApp('/spending')
    await router.isReady()
    wrapper = mount(Host, { global: { plugins: [router] } })
    await swipe(100, 100, 250, 100)
    expect(router.currentRoute.value.path).toBe('/')
    await swipe(100, 100, 250, 100) // already at the left edge
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('anonymous users never get swiped into the auth wall', async () => {
    const { router, Host } = makeApp('/map')
    await router.isReady()
    wrapper = mount(Host, { global: { plugins: [router] } })
    await swipe(200, 100, 80, 100) // left from /map: no /my-stories for anon
    expect(router.currentRoute.value.path).toBe('/map')
  })

  it('signed-in users can continue to My Stories', async () => {
    _internal.setAccessToken('tok')
    const { router, Host } = makeApp('/map')
    await router.isReady()
    wrapper = mount(Host, { global: { plugins: [router] } })
    await swipe(200, 100, 80, 100)
    expect(router.currentRoute.value.path).toBe('/my-stories')
  })

  it('short, diagonal and edge-started gestures are ignored', async () => {
    const { router, Host } = makeApp('/')
    await router.isReady()
    wrapper = mount(Host, { global: { plugins: [router] } })
    await swipe(200, 100, 150, 100)        // 50px < 60px minimum
    expect(router.currentRoute.value.path).toBe('/')
    await swipe(200, 100, 100, 180)        // |dy|/|dx| = 0.8 > 0.6
    expect(router.currentRoute.value.path).toBe('/')
    await swipe(20, 100, 200, 100)         // starts in the iOS back-swipe zone
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('does nothing on routes outside the swipe ring', async () => {
    const { router, Host } = makeApp('/about')
    await router.isReady()
    wrapper = mount(Host, { global: { plugins: [router] } })
    await swipe(200, 100, 80, 100)
    expect(router.currentRoute.value.path).toBe('/about')
  })

  it('multi-touch gestures are ignored', async () => {
    const { router, Host } = makeApp('/')
    await router.isReady()
    wrapper = mount(Host, { global: { plugins: [router] } })
    const start = new Event('touchstart')
    start.touches = [{ clientX: 200, clientY: 100 }, { clientX: 220, clientY: 100 }]
    globalThis.dispatchEvent(start)
    const end = new Event('touchend')
    end.changedTouches = [{ clientX: 80, clientY: 100 }]
    globalThis.dispatchEvent(end)
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('unmount removes the listeners', async () => {
    const { router, Host } = makeApp('/')
    await router.isReady()
    wrapper = mount(Host, { global: { plugins: [router] } })
    wrapper.unmount(); wrapper = null
    await swipe(200, 100, 80, 100)
    expect(router.currentRoute.value.path).toBe('/')
  })
})
