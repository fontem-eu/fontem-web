/**
 * Tests for EntityNutsMapEmbed.vue (widget wrapper)
 *
 * Verifies:
 * - widgetType exposed as 'entity_nuts_map'
 * - storeState() serialises config correctly
 * - Renders EntityNutsMap when entityId is present
 * - Shows fallback message when entityId is absent
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

// Stub maplibre-gl so EntityNutsMap can be imported without WebGL
vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn(() => ({
      addControl: vi.fn(), on: vi.fn(),
      once: vi.fn((e, cb) => { if (e === 'load') cb() }),
      addSource: vi.fn(), getSource: vi.fn(() => null),
      addLayer: vi.fn(), getLayer: vi.fn(() => null),
      getCanvas: vi.fn(() => ({ style: {} })),
      isStyleLoaded: vi.fn(() => true),
      setPaintProperty: vi.fn(), remove: vi.fn(),
    })),
    NavigationControl: vi.fn(),
  },
}))
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

// Stub fetch so the component doesn't throw
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ entity_id: 'x', level: 0, metric: 'contracts', regions: [] }),
}))

async function mountEmbed(config = {}) {
  const { default: EntityNutsMapEmbed } = await import('../../src/widgets/EntityNutsMapEmbed.vue')
  return mount(EntityNutsMapEmbed, { props: { config }, attachTo: document.body })
}

describe('EntityNutsMapEmbed — widget interface', () => {
  it('exposes widgetType as entity_nuts_map', async () => {
    const w = await mountEmbed({ entityId: 'abc-123' })
    expect(w.vm.widgetType).toBe('entity_nuts_map')
    w.unmount()
  })

  it('storeState returns entityId from config', async () => {
    const w = await mountEmbed({ entityId: 'abc-123' })
    const state = w.vm.storeState()
    expect(state.entityId).toBe('abc-123')
    w.unmount()
  })

  it('storeState includes level, metric, and scopeNuts with defaults', async () => {
    const w = await mountEmbed({ entityId: 'abc', level: 2, metric: 'contracts_eur', scopeNuts: 'DE1' })
    const state = w.vm.storeState()
    expect(state.level).toBe(2)
    expect(state.metric).toBe('contracts_eur')
    expect(state.scopeNuts).toBe('DE1')
    w.unmount()
  })

  it('storeState defaults level=0 and metric=contracts when not provided', async () => {
    const w = await mountEmbed({ entityId: 'abc' })
    const state = w.vm.storeState()
    expect(state.level).toBe(0)
    expect(state.metric).toBe('contracts')
    w.unmount()
  })

  it('renders the entity nuts map when entityId is provided', async () => {
    const w = await mountEmbed({ entityId: 'abc-123' })
    expect(w.find('[data-testid="entity-nuts-map"]').exists()).toBe(true)
    w.unmount()
  })

  it('shows fallback when entityId is absent', async () => {
    const w = await mountEmbed({})
    expect(w.find('[data-testid="entity-nuts-map"]').exists()).toBe(false)
    expect(w.text()).toMatch(/no entity/i)
    w.unmount()
  })
})
