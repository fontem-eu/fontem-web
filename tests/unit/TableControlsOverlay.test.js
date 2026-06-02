import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TableControlsOverlay from '../../src/components/TableControlsOverlay.vue'

// jsdom ships no ResizeObserver — stub it so the component mounts.
class StubResizeObserver {
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  globalThis.ResizeObserver = StubResizeObserver
})
afterEach(() => {
  delete globalThis.ResizeObserver
})

// ── Editor stub ─────────────────────────────────────────────
// Built around the same chainable-recorder pattern as the toolbar
// tests. `runs` records every `.run()` call's prior chain so each
// test can assert on the command sequence (addColumnBefore,
// addColumnAfter, deleteColumn, addRowAfter, ...).
function makeEditor({ cellPositions = [10, 30, 50], cellsCount = 3, hasTable = true } = {}) {
  const runs = []
  const _seq = []
  const chain = {}
  ;['focus', 'addColumnBefore', 'addColumnAfter', 'deleteColumn',
    'addRowAfter', 'addRowBefore', 'setTextSelection'].forEach((m) => {
    chain[m] = vi.fn((arg) => { _seq.push(arg === undefined ? m : `${m}:${arg}`); return chain })
  })
  chain.run = vi.fn(() => { runs.push([..._seq]); _seq.length = 0; return chain })

  // ── DOM fixture: an <table> with a single <tr> of `cellsCount` <td>s,
  // each with a stable bounding rect mocked via Object.defineProperty so
  // the overlay's findActiveTable + refreshGeometry walks see real
  // geometry. The table sits inside `.editor-body-col` so the relative
  // coordinate math works.
  const root = document.createElement('div')
  root.className = 'editor-body-col'
  Object.defineProperty(root, 'getBoundingClientRect', {
    value: () => ({ top: 0, left: 0, right: 200, bottom: 200, width: 200, height: 200 }),
  })
  document.body.appendChild(root)

  let table = null
  if (hasTable) {
    table = document.createElement('table')
    Object.defineProperty(table, 'getBoundingClientRect', {
      value: () => ({
        top: 50, left: 0, right: 200, bottom: 100, width: 200, height: 50,
      }),
    })
    const tr = document.createElement('tr')
    table.appendChild(tr)
    for (let i = 0; i < cellsCount; i++) {
      const td = document.createElement('td')
      // Each cell spans 20px in this fixture; right edges land where
      // cellPositions says.
      const left = i === 0 ? 0 : cellPositions[i - 1]
      const right = cellPositions[i]
      Object.defineProperty(td, 'getBoundingClientRect', {
        value: () => ({ top: 50, left, right, bottom: 100, width: right - left, height: 50 }),
      })
      tr.appendChild(td)
    }
    root.appendChild(table)
  }

  const editor = {
    chain: vi.fn(() => chain),
    on: vi.fn(),
    off: vi.fn(),
    view: {
      dom: root,
      state: { selection: { from: 1 } },
      domAtPos: vi.fn(() => ({ node: hasTable ? table.querySelector('td') : root })),
      posAtDOM: vi.fn((cell) => (
        // Stamp a stable index on the cell so tests can verify which
        // cell got selected before the chained command ran.
        Array.from(cell.parentElement?.children || []).indexOf(cell) * 10 + 1
      )),
    },
    _runs: runs,
    _chain: chain,
    _root: root,
    _table: table,
  }
  return editor
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('TableControlsOverlay', () => {
  it('renders nothing when the cursor is NOT inside a table', async () => {
    const editor = makeEditor({ hasTable: false })
    const w = mount(TableControlsOverlay, { props: { editor }, attachTo: document.body })
    await flushPromises()
    expect(w.find('[data-testid="table-overlay"]').exists()).toBe(false)
  })

  it('renders the overlay when a table is active', async () => {
    const editor = makeEditor({ cellsCount: 3, cellPositions: [60, 130, 200] })
    const w = mount(TableControlsOverlay, { props: { editor }, attachTo: document.body })
    await flushPromises()
    expect(w.find('[data-testid="table-overlay"]').exists()).toBe(true)
  })

  it('renders one column widget per boundary (n cells → n+1 widgets)', async () => {
    const editor = makeEditor({ cellsCount: 3, cellPositions: [60, 130, 200] })
    const w = mount(TableControlsOverlay, { props: { editor }, attachTo: document.body })
    await flushPromises()
    const widgets = w.findAll('[data-testid^="table-col-widget-"]')
    expect(widgets).toHaveLength(4) // before-0, after-0, after-1, after-2
  })

  it('does NOT render a trash button at the first (left-most) boundary', async () => {
    // Nothing to the left of the first gap — trash there would be a no-op.
    const editor = makeEditor({ cellsCount: 3, cellPositions: [60, 130, 200] })
    const w = mount(TableControlsOverlay, { props: { editor }, attachTo: document.body })
    await flushPromises()
    expect(w.find('[data-testid="table-col-del-0"]').exists()).toBe(false)
    expect(w.find('[data-testid="table-col-del-1"]').exists()).toBe(true)
    expect(w.find('[data-testid="table-col-del-2"]').exists()).toBe(true)
    expect(w.find('[data-testid="table-col-del-3"]').exists()).toBe(true)
  })

  it('renders one "+ Row" affordance below the table', async () => {
    const editor = makeEditor({ cellsCount: 3, cellPositions: [60, 130, 200] })
    const w = mount(TableControlsOverlay, { props: { editor }, attachTo: document.body })
    await flushPromises()
    expect(w.find('[data-testid="table-add-row"]').exists()).toBe(true)
  })

  it('clicking the LEFT-most + adds a column before the first', async () => {
    const editor = makeEditor({ cellsCount: 3, cellPositions: [60, 130, 200] })
    const w = mount(TableControlsOverlay, { props: { editor }, attachTo: document.body })
    await flushPromises()
    await w.find('[data-testid="table-col-add-0"]').trigger('click')
    // expected chain: chain().focus().addColumnBefore().run()
    expect(editor._runs.at(-1)).toEqual(['focus', 'addColumnBefore'])
  })

  it('clicking an INTERNAL + selects the left-hand cell, then addColumnAfter', async () => {
    const editor = makeEditor({ cellsCount: 3, cellPositions: [60, 130, 200] })
    const w = mount(TableControlsOverlay, { props: { editor }, attachTo: document.body })
    await flushPromises()
    // Gap index 2 → left-hand column is index 1 (cell #2 in 0-indexed). posAtDOM
    // returns idx*10+1 → 11 for cell index 1.
    await w.find('[data-testid="table-col-add-2"]').trigger('click')
    expect(editor._runs.at(-1)).toEqual(['focus', 'setTextSelection:11', 'addColumnAfter'])
  })

  it('clicking trash at boundary i selects column i-1 then deleteColumn', async () => {
    const editor = makeEditor({ cellsCount: 3, cellPositions: [60, 130, 200] })
    const w = mount(TableControlsOverlay, { props: { editor }, attachTo: document.body })
    await flushPromises()
    await w.find('[data-testid="table-col-del-2"]').trigger('click')
    expect(editor._runs.at(-1)).toEqual(['focus', 'setTextSelection:11', 'deleteColumn'])
  })

  it('clicking "+ Row" selects the last cell of the last row then addRowAfter', async () => {
    const editor = makeEditor({ cellsCount: 3, cellPositions: [60, 130, 200] })
    const w = mount(TableControlsOverlay, { props: { editor }, attachTo: document.body })
    await flushPromises()
    await w.find('[data-testid="table-add-row"]').trigger('click')
    // Last cell is index 2 → posAtDOM returns 21.
    expect(editor._runs.at(-1)).toEqual(['focus', 'setTextSelection:21', 'addRowAfter'])
  })

  it('subscribes to the editor selectionUpdate + transaction events', async () => {
    const editor = makeEditor()
    mount(TableControlsOverlay, { props: { editor }, attachTo: document.body })
    await flushPromises()
    const subs = editor.on.mock.calls.map(([name]) => name)
    expect(subs).toContain('selectionUpdate')
    expect(subs).toContain('transaction')
  })
})
