<script setup>
/**
 * Autocomplete popover for `@`-mention insertion.
 *
 * Bound to the MentionTrigger extension via the editor's onMentionState
 * callback (see DataStoryEditorView). Receives the trigger state +
 * coords; renders results from /api/search and inserts an EntityMention
 * node when the user picks one.
 *
 * Phase B scope: only Company hits surface. Other classes will
 * appear as their UUID5 normalisation lands in the migration.
 */
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { searchAll } from '../api/tickers.js'

const props = defineProps({
  editor: { type: Object, required: true },
  state: {
    type: Object,
    required: true,
    // { active, query, range: {from,to}, rect: {top,left,bottom,right} }
  },
})

const results = ref([])
const loading = ref(false)
const cursor = ref(0)
const error = ref(null)
let debounceTimer = null

const visible = computed(() => props.state?.active && results.value.length > 0)

function buildIri(cls, gmrId) {
  return `http://data.fontem.eu/id/${cls}/${gmrId}`
}

async function runSearch(q) {
  if (!q || q.trim().length === 0) {
    results.value = []
    return
  }
  loading.value = true
  error.value = null
  try {
    const data = await searchAll(q.trim(), 8)
    // Phase B scope: only Company hits — see PR description. Each hit
    // gets an iri synthesised the same way the MCP server does it
    // (Class + gmr_id).
    const companies = (data?.companies || [])
      .filter((c) => c.gmr_id)
      .map((c) => ({
        cls: 'Company',
        iri: buildIri('Company', c.gmr_id),
        label: c.name,
        country: c.country,
        ticker: c.ticker,
      }))
    results.value = companies
    cursor.value = 0
  } catch (err) {
    error.value = err.message
    results.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => props.state?.query,
  (q) => {
    if (!props.state?.active) {
      results.value = []
      return
    }
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => runSearch(q), 220)
  },
  { immediate: true },
)

function pick(idx) {
  const hit = results.value[idx]
  if (!hit || !props.state?.range) return
  props.editor.commands.acceptMention({
    iri: hit.iri,
    label: hit.label,
    cls: hit.cls,
    range: props.state.range,
  })
  results.value = []
}

function onKeyDown(e) {
  if (!visible.value) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    cursor.value = (cursor.value + 1) % results.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    cursor.value = (cursor.value - 1 + results.value.length) % results.value.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    pick(cursor.value)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    results.value = []
  }
}

onMounted(() => {
  // Capture phase so we win the keystroke before TipTap's own handlers
  // route it into a paragraph break.
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', onKeyDown, true)
  }
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('keydown', onKeyDown, true)
  }
  if (debounceTimer) clearTimeout(debounceTimer)
})

const popoverStyle = computed(() => {
  const r = props.state?.rect
  if (!r) return { display: 'none' }
  // Position just below the caret. The popover is ~260px tall when
  // full; nudge it 4px down so it doesn't sit on top of the line.
  return {
    top: `${r.bottom + 4}px`,
    left: `${r.left}px`,
  }
})
</script>

<template>
  <div
    v-if="visible"
    class="mention-popover"
    role="listbox"
    aria-label="Entity mentions"
    data-testid="mention-popover"
    :style="popoverStyle"
  >
    <div v-if="loading" class="popover-status">Searching…</div>
    <div v-else-if="error" class="popover-status error">{{ error }}</div>
    <ul v-else class="popover-list">
      <li
        v-for="(hit, idx) in results"
        :key="hit.iri"
        class="popover-item"
        :class="{ active: idx === cursor }"
        :data-testid="`mention-suggestion-${idx}`"
        @mousedown.prevent="pick(idx)"
      >
        <span class="item-dot" :class="`cls-${hit.cls.toLowerCase()}`" />
        <span class="item-label">{{ hit.label }}</span>
        <span v-if="hit.ticker" class="item-meta">{{ hit.ticker }}</span>
        <span v-if="hit.country" class="item-meta">{{ hit.country }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.mention-popover {
  position: fixed;
  z-index: 50;
  min-width: 260px;
  max-width: 360px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  font-size: 0.85rem;
  overflow: hidden;
}
.popover-status { padding: 0.6rem 0.8rem; color: var(--muted); font-size: 0.8rem; }
.popover-status.error { color: #dc2626; }
.popover-list { list-style: none; margin: 0; padding: 0.25rem 0; max-height: 18rem; overflow-y: auto; }
.popover-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.7rem;
  cursor: pointer;
  color: var(--text);
}
.popover-item.active { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.popover-item:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.item-dot {
  width: 0.5rem; height: 0.5rem;
  border-radius: 50%;
  flex-shrink: 0;
}
.item-dot.cls-company { background: #16a34a; }
.item-dot.cls-authority { background: #2563eb; }
.item-dot.cls-person { background: #b45309; }
.item-dot.cls-lobbyist { background: #db2777; }
.item-dot.cls-nutsregion { background: #7c3aed; }
.item-dot.cls-cohesionproject { background: #0891b2; }
.item-dot.cls-sanctionedentity { background: #dc2626; }
.item-label { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-meta {
  flex-shrink: 0;
  font-size: 0.7rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
</style>
