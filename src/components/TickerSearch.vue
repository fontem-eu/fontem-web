<script setup>
import { ref, watch, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { searchAll } from '../api/tickers.js'
import TickerCard from './TickerCard.vue'

const props = defineProps({
  selectedSymbol: { type: String, default: null },
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

const searchContainer = ref(null)
const anchorRef = ref(null)
const dropdownStyle = ref({})

function updateDropdownStyle() {
  if (!anchorRef.value || !results.value.length || window.innerWidth >= 640) {
    dropdownStyle.value = {}
    return
  }
  const rect = anchorRef.value.getBoundingClientRect()
  dropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    left: '0.75rem',
    right: '0.75rem',
    width: 'auto',
  }
}

const query = ref('')
const results = ref([])
const totalAvailable = ref(0)
// 'idle' | 'searching' | 'done' | 'error'
const state = ref('idle')

// Clear results when a ticker is selected
watch(
  () => props.selectedSymbol,
  (sym) => {
    if (sym) {
      results.value = []
      state.value = 'idle'
      query.value = ''
    }
  }
)

let debounceTimer = null
let currentRequest = 0

watch(query, (q) => {
  clearTimeout(debounceTimer)
  if (!q.trim()) {
    results.value = []
    state.value = 'idle'
    return
  }
  state.value = 'searching'
  debounceTimer = setTimeout(() => doSearch(q.trim()), 280)
})

async function doSearch(q) {
  const reqId = ++currentRequest
  try {
    const data = await searchAll(q)
    if (reqId !== currentRequest) return
    // Merge companies + authorities into a single results list
    const companies = (data.companies || []).map((c) => ({
      ...c,
      _type: 'company',
      // Use ticker if listed, otherwise gmr_id for navigation
      _navKey: c.ticker || c.symbol || c.gmr_id,
    }))
    const authorities = (data.authorities || []).map((a) => ({
      ...a,
      _type: 'authority',
      name: a.name,
      _navKey: a.authority_id,
    }))
    const persons = (data.persons || []).map((p) => ({
      ...p,
      _type: 'person',
      name: `${p.first_name || ''} ${p.name || ''}`.trim(),
      _navKey: p.person_id,
    }))
    results.value = [...companies, ...authorities, ...persons]
    totalAvailable.value = results.value.length
    state.value = 'done'
  } catch {
    if (reqId !== currentRequest) return
    results.value = []
    state.value = 'error'
  }
}

const statusText = computed(() => {
  if (state.value === 'searching') return 'Searching\u2026'
  if (state.value === 'error') return 'Error fetching results.'
  if (state.value === 'done' && results.value.length > 0) {
    const n = results.value.length
    return `${n} result${n !== 1 ? 's' : ''}`
  }
  return ''
})

function onClickOutside(event) {
  if (searchContainer.value && !searchContainer.value.contains(event.target)) {
    results.value = []
    state.value = 'idle'
    query.value = ''
    activeIndex.value = -1
  }
}

// ── Keyboard navigation ──────────────────────────────────────
const activeIndex = ref(-1)

// Reset highlighted index whenever results change
watch(results, () => {
  activeIndex.value = -1
  nextTick(updateDropdownStyle)
})

function onKeyDown(event) {
  if (!results.value.length) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, results.value.length - 1)
    scrollActiveIntoView()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
    scrollActiveIntoView()
  } else if (event.key === 'Enter' && activeIndex.value >= 0) {
    event.preventDefault()
    const t = results.value[activeIndex.value]
    emit('select', t.ticker ?? t.symbol)
  } else if (event.key === 'Escape') {
    results.value = []
    state.value = 'idle'
    query.value = ''
    activeIndex.value = -1
  }
}

function scrollActiveIntoView() {
  nextTick(() => {
    const dropdown = anchorRef.value?.querySelector('[role="list"]')
    const item = dropdown?.children[activeIndex.value]
    item?.scrollIntoView?.({ block: 'nearest' })
  })
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  window.addEventListener('resize', updateDropdownStyle)
})
onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  window.removeEventListener('resize', updateDropdownStyle)
})
</script>

<template>
  <div ref="searchContainer">
    <!-- Search input — relative so the dropdown is anchored to it -->
    <div ref="anchorRef" class="relative">
      <svg
        class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        style="color: var(--muted)"
        width="15"
        height="15"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"
        />
      </svg>
      <input
        id="search"
        v-model="query"
        type="search"
        class="gmr-input"
        placeholder="Search by ticker or company name\u2026"
        autocomplete="off"
        spellcheck="false"
        aria-label="Ticker search"
        :aria-activedescendant="activeIndex >= 0 ? `result-${activeIndex}` : undefined"
        aria-autocomplete="list"
        @keydown="onKeyDown"
      />

      <!-- Results dropdown — floats over page content, never displaces it -->
      <div
        v-if="results.length > 0"
        role="list"
        aria-live="polite"
        aria-label="Search results"
        class="gmr-results"
        :style="dropdownStyle"
      >
        <TickerCard
          v-for="(t, i) in results"
          :id="`result-${i}`"
          :key="t.symbol"
          :ticker="t"
          :selected="i === activeIndex"
          @select="emit('select', $event)"
        />
      </div>
    </div>

    <!-- Status line -->
    <div v-if="!compact" class="gmr-status mt-2" :class="{ 'gmr-status--err': state === 'error' }">
      {{ statusText }}
    </div>

    <!-- Empty state -->
    <div v-if="!compact && results.length === 0 && query.trim() && state === 'done'" class="gmr-empty">
      <svg
        width="28"
        height="28"
        viewBox="0 0 16 16"
        fill="currentColor"
        style="opacity: 0.35; margin: 0 auto 0.6rem"
      >
        <path
          d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"
        />
      </svg>
      <p class="text-sm">
        No tickers found for &ldquo;<strong>{{ query }}</strong
        >&rdquo;
      </p>
    </div>
  </div>
</template>
