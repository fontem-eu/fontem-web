import { describe, it, expect } from 'vitest'
import { resolveWidget, getWidgetTypes } from '../../src/widgets/registry.js'

describe('Widget Registry', () => {
  it('getWidgetTypes returns all registered types', () => {
    const types = getWidgetTypes()
    expect(types).toHaveLength(3)
    const keys = types.map((t) => t.key)
    expect(keys).toContain('graph_explorer')
    expect(keys).toContain('contracts_table')
    expect(keys).toContain('entity_profile')
  })

  it('getWidgetTypes returns human-readable labels', () => {
    const types = getWidgetTypes()
    const graphType = types.find((t) => t.key === 'graph_explorer')
    expect(graphType.label).toBe('Graph Explorer')
  })

  it('resolveWidget returns a component for valid types', () => {
    const component = resolveWidget('graph_explorer')
    expect(component).toBeTruthy()
  })

  it('resolveWidget returns null for unknown types', () => {
    const component = resolveWidget('nonexistent_widget')
    expect(component).toBeNull()
  })
})
