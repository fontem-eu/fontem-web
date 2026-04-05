import { describe, it, expect, beforeEach } from 'vitest'
import { usePocket } from '../../src/composables/usePocket.js'

describe('usePocket', () => {
  beforeEach(() => {
    localStorage.clear()
    const { clear } = usePocket()
    clear()
  })

  it('starts with empty items', () => {
    const { items } = usePocket()
    expect(items.value).toEqual([])
  })

  it('saves an item with correct fields', () => {
    const { items, save } = usePocket()
    const item = save('graph_explorer', { entityId: 'AAPL', depth: 2 }, 'Apple Graph')
    expect(item.name).toBe('Apple Graph')
    expect(item.widget_type).toBe('graph_explorer')
    expect(item.config.entityId).toBe('AAPL')
    expect(item.config.schema_version).toBe(1)
    expect(items.value).toHaveLength(1)
    const stored = JSON.parse(localStorage.getItem('gmr-pocket'))
    expect(stored).toHaveLength(1)
  })

  it('generates default name from entityId and type', () => {
    const { save } = usePocket()
    const item = save('contracts_table', { entityId: 'SAP.DE' })
    expect(item.name).toContain('SAP.DE')
    expect(item.name).toContain('contracts table')
  })

  it('prepends new items (most recent first)', () => {
    const { items, save } = usePocket()
    save('graph_explorer', { entityId: 'A' }, 'First')
    save('graph_explorer', { entityId: 'B' }, 'Second')
    expect(items.value[0].name).toBe('Second')
    expect(items.value[1].name).toBe('First')
  })

  it('removes an item by id', () => {
    const { items, save, remove } = usePocket()
    const item = save('graph_explorer', { entityId: 'X' }, 'Test')
    remove(item.id)
    expect(items.value).toHaveLength(0)
  })

  it('clears all items', () => {
    const { items, save, clear } = usePocket()
    save('graph_explorer', { entityId: 'A' }, 'One')
    save('graph_explorer', { entityId: 'B' }, 'Two')
    clear()
    expect(items.value).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem('gmr-pocket'))).toEqual([])
  })

  it('refresh reloads from localStorage', () => {
    const { items, refresh } = usePocket()
    localStorage.setItem('gmr-pocket', JSON.stringify([
      { id: 'ext', name: 'External', widget_type: 'g', config: {}, savedAt: new Date().toISOString() },
    ]))
    refresh()
    expect(items.value).toHaveLength(1)
    expect(items.value[0].name).toBe('External')
  })

  it('generates unique ids', () => {
    const { save } = usePocket()
    const a = save('graph_explorer', { entityId: 'A' })
    const b = save('graph_explorer', { entityId: 'B' })
    expect(a.id).not.toBe(b.id)
  })

  it('includes savedAt ISO timestamp', () => {
    const { save } = usePocket()
    const item = save('graph_explorer', { entityId: 'X' })
    expect(new Date(item.savedAt).getTime()).toBeGreaterThan(0)
  })
})
