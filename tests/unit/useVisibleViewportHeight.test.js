import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useVisibleViewportHeight } from '../../src/composables/useVisibleViewportHeight.js'

/**
 * Drives the composable by mounting a dummy component that wires it
 * up, then asserts the CSS var on `<html>` tracks visualViewport.
 */

function Harness() {
  return defineComponent({
    name: 'Harness',
    setup() {
      useVisibleViewportHeight()
      return () => h('div')
    },
  })
}

describe('useVisibleViewportHeight', () => {
  let listeners

  beforeEach(() => {
    listeners = []
    // Minimal visualViewport polyfill for jsdom (which doesn't ship one).
    const vv = {
      height: 640,
      addEventListener: vi.fn((evt, cb) => listeners.push({ evt, cb })),
      removeEventListener: vi.fn((evt, cb) => {
        listeners = listeners.filter(l => !(l.evt === evt && l.cb === cb))
      }),
    }
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      writable: true,
      value: vv,
    })
    document.documentElement.style.removeProperty('--visible-vh')
  })

  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      writable: true,
      value: null,
    })
    document.documentElement.style.removeProperty('--visible-vh')
  })

  it('publishes the initial visualViewport height as `--visible-vh` in px on <html>', async () => {
    mount(Harness())
    await flushPromises()
    expect(document.documentElement.style.getPropertyValue('--visible-vh')).toBe('640px')
  })

  it('updates the css var when visualViewport fires a `resize` event', async () => {
    mount(Harness())
    await flushPromises()

    window.visualViewport.height = 540  // address bar slid in, viewport shrank
    listeners.filter(l => l.evt === 'resize').forEach(l => l.cb())
    expect(document.documentElement.style.getPropertyValue('--visible-vh')).toBe('540px')
  })

  it('updates the css var when visualViewport fires a `scroll` event', async () => {
    mount(Harness())
    await flushPromises()

    window.visualViewport.height = 720
    listeners.filter(l => l.evt === 'scroll').forEach(l => l.cb())
    expect(document.documentElement.style.getPropertyValue('--visible-vh')).toBe('720px')
  })

  it('detaches its listeners and clears the css var when the host unmounts', async () => {
    const wrapper = mount(Harness())
    await flushPromises()
    expect(listeners.length).toBeGreaterThan(0)

    wrapper.unmount()
    await flushPromises()

    expect(listeners.length).toBe(0)
    expect(document.documentElement.style.getPropertyValue('--visible-vh')).toBe('')
  })

  it('is a no-op when visualViewport is unavailable (old browsers / non-DOM env)', async () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      writable: true,
      value: undefined,
    })
    expect(() => mount(Harness())).not.toThrow()
    await flushPromises()
    expect(document.documentElement.style.getPropertyValue('--visible-vh')).toBe('')
  })
})
