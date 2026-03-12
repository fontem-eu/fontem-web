<script setup>
import { ref, watch, computed } from 'vue'
import { searchTickers } from '../api/tickers.js'
import TickerCard from './TickerCard.vue'

const query = ref('')
const results = ref([])
const totalAvailable = ref(0)
// 'idle' | 'searching' | 'done' | 'error'
const state = ref('idle')

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
    const data = await searchTickers(q)
    if (reqId !== currentRequest) return
    results.value = data.results
    totalAvailable.value = data.total_available
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
    return `${n} result${n !== 1 ? 's' : ''} \u2014 ${totalAvailable.value.toLocaleString()} total tickers`
  }
  return ''
})
</script>

<template>
  <div class="search-container">
    <div class="search-wrap">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
        class="search-icon"
      >
        <path
          d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"
        />
      </svg>
      <input
        id="search"
        v-model="query"
        type="search"
        placeholder="Search by ticker or company name\u2026"
        autocomplete="off"
        spellcheck="false"
        aria-label="Ticker search"
      />
    </div>

    <div class="search-status" :class="{ 'search-status--error': state === 'error' }">
      {{ statusText }}
    </div>

    <div v-if="results.length > 0" role="list" aria-live="polite" aria-label="Search results" class="results-list">
      <TickerCard v-for="t in results" :key="t.symbol" :ticker="t" />
    </div>

    <div
      v-else-if="query.trim() && state === 'done'"
      class="empty-state"
    >
      <svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor">
        <path
          d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"
        />
      </svg>
      <p>No tickers found for &ldquo;<strong>{{ query }}</strong>&rdquo;</p>
    </div>
  </div>
</template>
