<script setup>
/**
 * Inline column/row affordances for TipTap tables.
 *
 * The default TipTap table extension has no UI for add/delete column
 * or row — only the underlying chained commands (`addColumnBefore`,
 * `deleteColumn`, `addRowAfter`, …). This overlay renders the user-
 * requested affordances:
 *
 *   • a `+` / `trash` widget at every column boundary along the top of
 *     the active table (including before the first and after the last
 *     column);
 *   • a `trash` widget to the LEFT of every row;
 *   • a full-width `+ Row` button below the table.
 *
 * The widget under each column boundary controls the two adjacent cols:
 *   - `+` inserts a new column to the LEFT of the right-hand column
 *     (equivalent to `addColumnBefore` from the right cell);
 *   - `trash` deletes the LEFT-hand column (no-op when there is none).
 *
 * Deleting the LAST column (or the LAST row) deletes the whole table:
 * a table with zero columns/rows is invalid in the TipTap schema and
 * would otherwise leave an orphan node — easier to just drop it.
 *
 * The overlay watches the editor's selection so it only mounts when
 * the cursor is inside a table — outside a table, nothing is rendered.
 * Position tracks the active table via a ResizeObserver + the editor
 * scroll container.
 */
import { ref, watch, onBeforeUnmount, computed } from 'vue'

const props = defineProps({
  editor: { type: Object, required: true },
})

const tableEl = ref(null)
const tableRect = ref(null)
const colEdges = ref([])
// Per-row geometry: { top, height } relative to the table's top edge.
// Drives the row-trash buttons that sit to the LEFT of each row.
const rowRects = ref([])
let _ro = null

function findActiveTable() {
  const root = props.editor?.view?.dom
  if (!root) return null
  const sel = props.editor.view.state.selection
  // Walk up from the selection's anchor cell to the table element.
  let { node } = props.editor.view.domAtPos(sel.from)
  while (node && node.nodeType === 1 && node.tagName !== 'TABLE') {
    node = node.parentElement
  }
  return node?.tagName === 'TABLE' ? node : null
}

function refreshGeometry() {
  if (!tableEl.value) {
    tableRect.value = null
    colEdges.value = []
    rowRects.value = []
    return
  }
  const editorRoot = props.editor.view.dom.closest('.editor-body-col') || props.editor.view.dom
  const editorRect = editorRoot.getBoundingClientRect()
  const tRect = tableEl.value.getBoundingClientRect()
  // Coordinates are relative to .editor-body-col so the overlay can
  // sit inside the same scroll container without a global window
  // scroll listener.
  tableRect.value = {
    top: tRect.top - editorRect.top,
    left: tRect.left - editorRect.left,
    width: tRect.width,
    height: tRect.height,
  }
  // Column edges: relative to the table's left edge. Use the first
  // row's cells — works for both header-row and headerless tables.
  const allRows = Array.from(tableEl.value.querySelectorAll('tr'))
  const firstRow = allRows[0]
  const cells = firstRow ? Array.from(firstRow.children) : []
  if (cells.length === 0) {
    colEdges.value = []
    rowRects.value = []
    return
  }
  const edges = []
  // Edge 0 = before the first column.
  edges.push(cells[0].getBoundingClientRect().left - tRect.left)
  // Edges 1..n = after each column.
  cells.forEach((cell) => {
    edges.push(cell.getBoundingClientRect().right - tRect.left)
  })
  colEdges.value = edges

  // Row rects: relative to the table's top edge. One entry per <tr>
  // (header rows included). Drives the per-row trash buttons.
  rowRects.value = allRows.map((row) => {
    const r = row.getBoundingClientRect()
    return { top: r.top - tRect.top, height: r.height }
  })
}

function watchSelection() {
  const next = findActiveTable()
  if (next === tableEl.value) {
    refreshGeometry()
    return
  }
  if (_ro) { _ro.disconnect(); _ro = null }
  tableEl.value = next
  if (next) {
    _ro = new ResizeObserver(refreshGeometry)
    _ro.observe(next)
  }
  refreshGeometry()
}

// Fires on every selection move + every transaction that changes the
// document. Cheap — just walks up the DOM.
const _handler = () => watchSelection()
watch(
  () => props.editor,
  (ed, prev) => {
    if (prev) {
      prev.off('selectionUpdate', _handler)
      prev.off('transaction', _handler)
    }
    if (ed) {
      ed.on('selectionUpdate', _handler)
      ed.on('transaction', _handler)
      watchSelection()
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (_ro) _ro.disconnect()
  if (props.editor) {
    props.editor.off('selectionUpdate', _handler)
    props.editor.off('transaction', _handler)
  }
})

// ── Actions ─────────────────────────────────────────────────
// Boundary index i (0..n) refers to the gap between column i-1 and
// column i (i=0 is before first, i=n is after last).
//   `+` at i: insert a column at this position — implemented as
//      `addColumnAfter` from column i-1, or `addColumnBefore` from
//      column 0 when i === 0.
//   `trash` at i: delete the column to the LEFT (index i-1). No-op
//      when i === 0 (there's nothing to the left of the first gap).
function addColumnAt(i) {
  const ed = props.editor
  const chain = ed.chain().focus()
  if (i === 0) {
    chain.addColumnBefore().run()
  } else {
    // Move selection into the (i-1)th cell of the first row, then add after.
    const cells = tableEl.value?.querySelector('tr')?.children
    if (!cells?.[i - 1]) return
    const pos = ed.view.posAtDOM(cells[i - 1], 0)
    if (pos != null) chain.setTextSelection(pos).addColumnAfter().run()
  }
}

function removeColumnLeftOf(i) {
  if (i === 0) return
  const ed = props.editor
  const cells = tableEl.value?.querySelector('tr')?.children
  if (!cells?.[i - 1]) return
  // Last column? The TipTap schema doesn't allow a zero-column table,
  // and dropping back through `deleteColumn` produces an orphan node.
  // Per user request: deleting the last column deletes the whole table.
  if (cells.length === 1) {
    ed.chain().focus().deleteTable().run()
    return
  }
  const pos = ed.view.posAtDOM(cells[i - 1], 0)
  if (pos != null) ed.chain().focus().setTextSelection(pos).deleteColumn().run()
}

function removeRow(rowIndex) {
  const ed = props.editor
  const rows = tableEl.value?.querySelectorAll('tr')
  if (!rows?.[rowIndex]) return
  // Symmetric with removeColumnLeftOf: deleting the LAST row drops the
  // whole table rather than leaving an empty container behind.
  if (rows.length === 1) {
    ed.chain().focus().deleteTable().run()
    return
  }
  // Anchor the selection inside the first cell of the row we want gone,
  // then `deleteRow` operates on the row containing the selection.
  const cell = rows[rowIndex].children[0]
  if (!cell) return
  const pos = ed.view.posAtDOM(cell, 0)
  if (pos != null) ed.chain().focus().setTextSelection(pos).deleteRow().run()
}

function addRow() {
  const ed = props.editor
  // Append after the last row — most natural extension for "below the
  // table". Move selection into the bottom-right cell first.
  const rows = tableEl.value?.querySelectorAll('tr')
  if (!rows?.length) return
  const lastRow = rows[rows.length - 1]
  const lastCell = lastRow.children[lastRow.children.length - 1]
  if (!lastCell) return
  const pos = ed.view.posAtDOM(lastCell, 0)
  if (pos != null) ed.chain().focus().setTextSelection(pos).addRowAfter().run()
}

const visible = computed(() => tableEl.value && tableRect.value && colEdges.value.length >= 2)
</script>

<template>
  <div
    v-if="visible"
    class="table-overlay"
    data-testid="table-overlay"
    :style="{
      top: (tableRect.top - 22) + 'px',
      left: tableRect.left + 'px',
      width: tableRect.width + 'px',
      height: '0',
    }"
  >
    <!-- Column-boundary widgets along the top -->
    <div
      v-for="(edge, i) in colEdges"
      :key="`col-${i}`"
      class="col-widget"
      :class="{ 'col-widget--first': i === 0, 'col-widget--last': i === colEdges.length - 1 }"
      :style="{ left: edge + 'px' }"
      :data-testid="`table-col-widget-${i}`"
    >
      <button
        type="button"
        class="t-btn t-btn--add"
        :title="i === 0 ? 'Insert column at start' : (i === colEdges.length - 1 ? 'Insert column at end' : 'Insert column here')"
        :data-testid="`table-col-add-${i}`"
        @click="addColumnAt(i)"
      >+</button>
      <button
        v-if="i > 0"
        type="button"
        class="t-btn t-btn--del"
        :title="$t('table_controls_overlay.remove_column_to_the_left')"
        :data-testid="`table-col-del-${i}`"
        @click="removeColumnLeftOf(i)"
      >🗑</button>
    </div>

    <!-- Per-row trash widgets, sat to the LEFT of each row -->
    <button
      v-for="(row, i) in rowRects"
      :key="`row-${i}`"
      type="button"
      class="t-btn t-btn--del row-del"
      :title="rowRects.length === 1 ? 'Delete the table' : 'Delete this row'"
      :data-testid="`table-row-del-${i}`"
      :style="{ top: (row.top + row.height / 2 - 9) + 'px' }"
      @click="removeRow(i)"
    >🗑</button>

    <!-- + Row affordance below the table -->
    <button
      type="button"
      class="add-row-btn"
      data-testid="table-add-row"
      :style="{ top: (tableRect.height + 6) + 'px', width: tableRect.width + 'px' }"
      @click="addRow"
    >+ Row</button>
  </div>
</template>

<style scoped>
.table-overlay {
  position: absolute;
  pointer-events: none;
}
.col-widget {
  position: absolute;
  /* Centre the widget on the column edge. */
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
  pointer-events: auto;
}
.t-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1px solid var(--border, #ddd);
  border-radius: 50%;
  background: var(--surface, #fff);
  color: var(--text);
  font-size: 0.7rem;
  line-height: 1;
  padding: 0;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.t-btn--add { color: var(--accent, #0969da); }
.t-btn--del { color: var(--negative, #b91c1c); }
.t-btn:hover { background: var(--bg, #f5f5f5); }

.add-row-btn {
  position: absolute;
  left: 0;
  pointer-events: auto;
  padding: 2px 0;
  border: 1px dashed var(--border, #ddd);
  border-radius: 4px;
  background: var(--surface, #fff);
  color: var(--muted, #666);
  font-size: 0.7rem;
  cursor: pointer;
}
.add-row-btn:hover { background: var(--bg, #f5f5f5); color: var(--text); }

/* Row trash widget — anchored to the LEFT edge of the table.  The
   overlay's `left` already aligns with the table's left edge, so a
   negative `left` puts the button outside the table cell border. */
.row-del {
  position: absolute;
  left: -22px;
  pointer-events: auto;
}
</style>
