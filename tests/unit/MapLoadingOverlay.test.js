/**
 * Tests for the shared map loading/error overlay.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MapLoadingOverlay from '../../src/widgets/atlas/MapLoadingOverlay.vue'

describe('MapLoadingOverlay', () => {
  it('renders nothing when not loading and no error', () => {
    const w = mount(MapLoadingOverlay, { props: { loading: false } })
    expect(w.find('[data-testid="map-loading-overlay"]').exists()).toBe(false)
  })

  it('renders the spinner + default message when loading', () => {
    const w = mount(MapLoadingOverlay, { props: { loading: true } })
    const overlay = w.find('[data-testid="map-loading-overlay"]')
    expect(overlay.exists()).toBe(true)
    expect(overlay.attributes('aria-busy')).toBe('true')
    // Default copy.
    expect(overlay.text()).toContain('Loading data…')
  })

  it('uses a caller-supplied message', () => {
    const w = mount(MapLoadingOverlay, {
      props: { loading: true, message: 'Fetching observations…' },
    })
    expect(w.text()).toContain('Fetching observations…')
  })

  it('shows error mode when an error string is supplied', () => {
    const w = mount(MapLoadingOverlay, {
      props: { loading: false, error: 'fontem-stats unreachable' },
    })
    const overlay = w.find('[data-testid="map-loading-overlay"]')
    expect(overlay.exists()).toBe(true)
    // Error wins over loading; aria-busy must NOT be true (we're
    // not actively fetching anymore).
    expect(overlay.attributes('aria-busy')).toBe('false')
    expect(overlay.attributes('aria-live')).toBe('assertive')
    expect(overlay.text()).toContain('fontem-stats unreachable')
  })

  it('error wins when both loading and error are set', () => {
    // A failing fetch can briefly hold both states; the error
    // message is the one users need to see.
    const w = mount(MapLoadingOverlay, {
      props: { loading: true, error: 'HTTP 500' },
    })
    expect(w.text()).toContain('HTTP 500')
    // Spinner hides — error mode renders text only.
    expect(w.find('.map-loading-spinner').exists()).toBe(false)
  })
})
