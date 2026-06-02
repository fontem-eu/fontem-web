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
function makeEditor({
  cellPositions = [10, 30, 50],
  cellsCount = 3,
  rowsCount = 1,
  hasTable = true,
} = {}) {
  const runs = []
  const _seq = []
  const chain = {}
  ;['focus', 'addColumnBefore', 'addColumnAfter', 'deleteColumn',
    'addRowAfter', 'addRowBefore', 'deleteRow', 'deleteTable',
    'setTextSelection'].forEach((m) => {
    chain[m] = vi.fn((arg) => { _seq.push(arg === undefined ? m : `${m}:${arg}`); return chain })
  })
  chain.run = vi.fn(() => { runs.push([..._seq]); _seq.length = 0; return chain })

  // ── DOM fixture: an <table> with `rowsCount` <tr>s, each containing
  // `cellsCount` <td>s. Bounding rects are stamped via defineProperty so
  // the overlay's findActiveTable + refreshGeometry walks see real
  // geometry. The table sits inside `.editor-body-col` so the relative
  // coordinate math works.
  const root = document.createElement('div')
  root.className = 'editor-body-col'
  Object.defineProperty(root, 'getBoundingClientRect', {
    value: () => ({ top: 0, left: 0, right: 200, bottom: 200, width: 200, height: 200 }),
  })
  document.body.appendChild(root)

  const ROW_HEIGHT = 50
  let table = null
  if (hasTable) {
    table = document.createElement('table')
    const tableTop = 50
    const tableHeight = ROW_HEIGHT * rowsCount
    Object.defineProperty(table, 'getBoundingClientRect', {
      value: () => ({
        top: tableTop, left: 0, right: 200,
        bottom: tableTop + tableHeight, width: 200, height: tableHeight,
      }),
    })
    for (let r = 0; r < rowsCount; r++) {
      const tr = document.createElement('tr')
      const rowTop = tableTop + r * ROW_HEIGHT
      const rowBottom = rowTop + ROW_HEIGHT
      Object.defineProperty(tr, 'getBoundingClientRect', {
        value: () => ({
          top: rowTop, left: 0, right: 200,
          bottom: rowBottom, width: 200, height: ROW_HEIGHT,
        }),
      })
      table.appendChild(tr)
      for (let i = 0; i < cellsCount; i++) {
        const td = document.createElement('td')
        // Each cell spans 20px in this fixture; right edges land where
        // cellPositions says.
        const left = i === 0 ? 0 : cellPositions[i - 1]
        const right = cellPositions[i]
        Object.defineProperty(td, 'getBoundingClientRect', {
          value: () => ({
            top: rowTop, left, right, bottom: rowBottom,
            width: right - left, height: ROW_HEIGHT,
          }),
        })
        tr.appendChild(td)
      }
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
      posAtDOM: vi.fn((cell) => {
        // Stamp a stable {row, col}-derived position so multi-row tests
        // can verify which row + cell got selected before the chained
        // command ran. The single-row tests inherit the same values
        // (row 0 → row-component is 0).
        const row = cell.parentElement
        const tbl = row?.parentElement
        const rowIdx = tbl ? Array.from(tbl.children).indexOf(row) : 0
        const colIdx = row ? Array.from(row.children).indexOf(cell) : 0
        return rowIdx * 100 + colIdx * 10 + 1
      }),
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

  // ── Per-row trash buttons (item 2 of batch-4 feedback) ─────────
  it('renders ONE row-delete button per row', async () => {
    const editor = makeEditor({ cellsCount: 3, cellPositions: [60, 130, 200], rowsCount: 3 })
    const w = mount(TableControlsOverlay, { props: { editor }, attachTo: document.body })
    await flushPromises()
    expect(w.findAll('[data-testid^="table-row-del-"]')).toHaveLength(3)
  })

  it('clicking row-delete on a NON-LAST row selects its first cell then deleteRow', async () => {
    const editor = makeEditor({ cellsCount: 2, cellPositions: [100, 200], rowsCount: 3 })
    const w = mount(TableControlsOverlay, { props: { editor }, attachTo: document.body })
    await flushPromises()
    // Row index 1 → posAtDOM on cell {row:1, col:0} → 1*100 + 0 + 1 = 101.
    await w.find('[data-testid="table-row-del-1"]').trigger('click')
    expect(editor._runs.at(-1)).toEqual(['focus', 'setTextSelection:101', 'deleteRow'])
  })

  // ── Last-of-its-kind → delete the whole table ──────────────────
  it('deleting the LAST remaining column drops the whole table (deleteTable, not deleteColumn)', async () => {
    // Single cell per row — boundary 1 is the only place a trash button
    // shows. Removing the column to its left would leave a 0-col table.
    const editor = makeEditor({ cellsCount: 1, cellPositions: [200], rowsCount: 2 })
    const w = mount(TableControlsOverlay, { props: { editor }, attachTo: document.body })
    await flushPromises()
    await w.find('[data-testid="table-col-del-1"]').trigger('click')
    const seq = editor._runs.at(-1)
    expect(seq).toEqual(['focus', 'deleteTable'])
    expect(seq).not.toContain('deleteColumn')
  })

  it('deleting the LAST remaining row drops the whole table (deleteTable, not deleteRow)', async () => {
    const editor = makeEditor({ cellsCount: 2, cellPositions: [100, 200], rowsCount: 1 })
    const w = mount(TableControlsOverlay, { props: { editor }, attachTo: document.body })
    await flushPromises()
    await w.find('[data-testid="table-row-del-0"]').trigger('click')
    const seq = editor._runs.at(-1)
    expect(seq).toEqual(['focus', 'deleteTable'])
    expect(seq).not.toContain('deleteRow')
  })

  it('deleting a NON-LAST column still uses deleteColumn (does NOT drop the table)', async () => {
    // Two cells per row → clicking trash at boundary 1 deletes column 0
    // and leaves a single column. The table should survive.
    const editor = makeEditor({ cellsCount: 2, cellPositions: [100, 200], rowsCount: 1 })
    const w = mount(TableControlsOverlay, { props: { editor }, attachTo: document.body })
    await flushPromises()
    await w.find('[data-testid="table-col-del-1"]').trigger('click')
    expect(editor._runs.at(-1)).toContain('deleteColumn')
    expect(editor._runs.at(-1)).not.toContain('deleteTable')
  })

  it('positions the per-row trash buttons vertically with the row centre', async () => {
    // Rows are 50px tall and stacked from y=50 (first row) downward.
    // The trash button height is 18px, so its top is row.top + 25 - 9.
    // Row 0: top 0 → btn top = 16. Row 1: top 50 → btn top = 66.
    const editor = makeEditor({ cellsCount: 2, cellPositions: [100, 200], rowsCount: 2 })
    const w = mount(TableControlsOverlay, { props: { editor }, attachTo: document.body })
    await flushPromises()
    const btn0 = w.find('[data-testid="table-row-del-0"]').element
    const btn1 = w.find('[data-testid="table-row-del-1"]').element
    expect(btn0.style.top).toBe('16px')
    expect(btn1.style.top).toBe('66px')
  })
})
