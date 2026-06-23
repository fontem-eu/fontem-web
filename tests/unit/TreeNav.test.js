import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { makeTestI18n } from './helpers/i18n.js'
import TreeNav from '../../src/components/TreeNav.vue'

const NODES = [
  { id: 'r1', title: 'Root 1', parent_id: null },
  { id: 'c1', title: 'Child 1', parent_id: 'r1' },
  { id: 'c2', title: 'Child 2', parent_id: 'r1' },
  { id: 'gc', title: 'Grandchild', parent_id: 'c1' },
  { id: 'r2', title: 'Root 2', parent_id: null },
]
function mountNav(props = {}) {
  return mount(TreeNav, { props: { nodes: NODES, ...props }, global: { plugins: [makeTestI18n()] } })
}

describe('TreeNav', () => {
  it('renders every node, nested', () => {
    const w = mountNav()
    for (const id of ['r1', 'c1', 'c2', 'gc', 'r2']) {
      expect(w.find(`[data-testid="tree-node-${id}"]`).exists()).toBe(true)
    }
  })

  it('shows empty state for no nodes', () => {
    const w = mount(TreeNav, { props: { nodes: [] }, global: { plugins: [makeTestI18n()] } })
    expect(w.find('[data-testid="tree-empty"]').exists()).toBe(true)
  })

  it('select emits select(id)', async () => {
    const w = mountNav()
    await w.find('[data-testid="tree-select-c1"]').trigger('click')
    expect(w.emitted('select')[0]).toEqual(['c1'])
  })

  it('collapses then re-expands a parent', async () => {
    const w = mountNav()
    expect(w.find('[data-testid="tree-node-c1"]').exists()).toBe(true)
    await w.find('[data-testid="tree-toggle-r1"]').trigger('click')
    expect(w.find('[data-testid="tree-node-c1"]').exists()).toBe(false)
    await w.find('[data-testid="tree-toggle-r1"]').trigger('click')
    expect(w.find('[data-testid="tree-node-c1"]').exists()).toBe(true)
  })

  it('only parents have a toggle (leaves do not)', () => {
    const w = mountNav()
    expect(w.find('[data-testid="tree-toggle-r1"]').exists()).toBe(true)
    expect(w.find('[data-testid="tree-toggle-c1"]').exists()).toBe(true) // has grandchild
    expect(w.find('[data-testid="tree-toggle-c2"]').exists()).toBe(false) // leaf
  })

  it('editable: add-child and remove emit with the node id', async () => {
    const w = mountNav()
    await w.find('[data-testid="tree-add-r1"]').trigger('click')
    expect(w.emitted('add-child')[0]).toEqual(['r1'])
    await w.find('[data-testid="tree-remove-c2"]').trigger('click')
    expect(w.emitted('remove')[0]).toEqual(['c2'])
  })

  it('non-editable hides add/remove controls', () => {
    const w = mountNav({ editable: false })
    expect(w.find('[data-testid="tree-add-r1"]').exists()).toBe(false)
    expect(w.find('[data-testid="tree-remove-r1"]').exists()).toBe(false)
  })

  it('marks the selected node', () => {
    const w = mountNav({ selectedId: 'gc' })
    expect(w.find('[data-testid="tree-node-gc"] .tn-row').classes()).toContain('tn-selected')
  })
})
