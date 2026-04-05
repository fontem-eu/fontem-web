import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { usePocket } from '../../src/composables/usePocket.js'
import PocketButton from '../../src/components/PocketButton.vue'

describe('usePocket composable', () => {
  beforeEach(() => {
    localStorage.clear()
    usePocket().clear()
  })
  afterEach(() => localStorage.clear())

  it('starts with empty pocket', () => {
    const { items } = usePocket()
    expect(items.value).toEqual([])
  })

  it('saves an item to pocket', () => {
    const { items, save } = usePocket()
    save('graph_explorer', { entityId: 'AAPL', depth: 2 }, 'AAPL Graph')
    expect(items.value).toHaveLength(1)
    expect(items.value[0].name).toBe('AAPL Graph')
    expect(items.value[0].widget_type).toBe('graph_explorer')
  })

  it('persists to localStorage', () => {
    const { save } = usePocket()
    save('contracts_table', { entityId: 'MSFT' }, 'MSFT Contracts')
    const stored = JSON.parse(localStorage.getItem('gmr-pocket'))
    expect(stored).toHaveLength(1)
  })

  it('generates default name when none provided', () => {
    const { items, save } = usePocket()
    save('graph_explorer', { entityId: 'SAP' })
    expect(items.value[0].name).toContain('SAP')
  })

  it('removes an item by id', () => {
    const { items, save, remove } = usePocket()
    save('graph_explorer', { entityId: 'A' }, 'First')
    save('graph_explorer', { entityId: 'B' }, 'Second')
    const idToRemove = items.value[0].id // newest (Second) is at index 0
    remove(idToRemove)
    expect(items.value).toHaveLength(1)
    expect(items.value[0].name).toBe('First')
  })

  it('clears all items', () => {
    const { items, save, clear } = usePocket()
    save('graph_explorer', { entityId: 'A' })
    save('graph_explorer', { entityId: 'B' })
    clear()
    expect(items.value).toEqual([])
  })

  it('refreshes from localStorage', () => {
    localStorage.setItem('gmr-pocket', JSON.stringify([
      { id: 'x', name: 'Existing', widget_type: 'graph_explorer', config: {} },
    ]))
    const { items, refresh } = usePocket()
    refresh()
    expect(items.value).toHaveLength(1)
  })
})

describe('PocketButton component', () => {
  beforeEach(() => {
    localStorage.clear()
    usePocket().clear()
  })
  afterEach(() => localStorage.clear())

  it('renders the Pocket button', () => {
    const wrapper = mount(PocketButton, {
      props: { widgetType: 'graph_explorer', config: { entityId: 'AAPL' } },
    })
    expect(wrapper.find('[data-testid="pocket-save-btn"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Pocket')
  })

  it('opens name prompt on click', async () => {
    const wrapper = mount(PocketButton, {
      props: { widgetType: 'graph_explorer', config: { entityId: 'AAPL' }, defaultName: 'AAPL Graph' },
    })
    await wrapper.find('[data-testid="pocket-save-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="pocket-prompt"]').exists()).toBe(true)
  })

  it('saves to pocket on confirm', async () => {
    const wrapper = mount(PocketButton, {
      props: { widgetType: 'graph_explorer', config: { entityId: 'AAPL' }, defaultName: 'AAPL Graph' },
    })
    await wrapper.find('[data-testid="pocket-save-btn"]').trigger('click')
    await wrapper.find('[data-testid="pocket-confirm"]').trigger('click')
    const stored = JSON.parse(localStorage.getItem('gmr-pocket'))
    expect(stored).toHaveLength(1)
    expect(stored[0].name).toBe('AAPL Graph')
  })

  it('shows Saved feedback after confirm', async () => {
    const wrapper = mount(PocketButton, {
      props: { widgetType: 'graph_explorer', config: { entityId: 'AAPL' } },
    })
    await wrapper.find('[data-testid="pocket-save-btn"]').trigger('click')
    await wrapper.find('[data-testid="pocket-confirm"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Saved')
  })

  it('closes prompt on cancel', async () => {
    const wrapper = mount(PocketButton, {
      props: { widgetType: 'graph_explorer', config: { entityId: 'AAPL' } },
    })
    await wrapper.find('[data-testid="pocket-save-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="pocket-prompt"]').exists()).toBe(true)
    await wrapper.find('.pocket-cancel').trigger('click')
    expect(wrapper.find('[data-testid="pocket-prompt"]').exists()).toBe(false)
  })
})
