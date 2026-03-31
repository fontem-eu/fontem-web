<script setup>
import { ref, watch } from 'vue'
import { fmtMoney } from '../utils/format.js'

const props = defineProps({
  symbol: { type: String, required: true },
})

const state = ref('loading')
const data = ref(null)
const sortKey = ref('value_eur')
const sortAsc = ref(false)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function resolveGmrId(symbol) {
  // If it already looks like a UUID (gmr_id or authority_id), use directly
  if (UUID_RE.test(symbol)) return symbol
  // Otherwise resolve ticker → gmr_id via search
  const res = await fetch(`/api/tickers/search?query=${encodeURIComponent(symbol)}&limit=1`)
  if (!res.ok) return null
  const json = await res.json()
  const results = json.results || []
  return results.length > 0 ? results[0].gmr_id : null
}

async function loadContracts(symbol) {
  state.value = 'loading'
  try {
    const gmrId = await resolveGmrId(symbol)
    if (!gmrId) {
      state.value = 'empty'
      return
    }
    const res = await fetch(`/api/companies/${encodeURIComponent(gmrId)}/contracts?limit=100`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    data.value = json
    state.value = json.contract_count > 0 ? 'done' : 'empty'
  } catch {
    state.value = 'error'
  }
}

watch(() => props.symbol, (sym) => { if (sym) loadContracts(sym) }, { immediate: true })

function sortBy(key) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = key === 'award_date'
  }
}

function sortedContracts() {
  if (!data.value?.contracts) return []
  const arr = [...data.value.contracts]
  arr.sort((a, b) => {
    const va = a[sortKey.value] ?? ''
    const vb = b[sortKey.value] ?? ''
    if (va < vb) return sortAsc.value ? -1 : 1
    if (va > vb) return sortAsc.value ? 1 : -1
    return 0
  })
  return arr
}

function indicator(key) {
  if (sortKey.value !== key) return ''
  return sortAsc.value ? ' ▲' : ' ▼'
}
</script>

<template>
  <div data-testid="contracts-panel" class="contracts-panel">
    <!-- Loading -->
    <div v-if="state === 'loading'" class="contracts-loading">
      Loading procurement data...
    </div>

    <!-- Error -->
    <div v-else-if="state === 'error'" class="contracts-error" data-testid="contracts-error">
      Failed to load procurement data.
    </div>

    <!-- Empty -->
    <div v-else-if="state === 'empty'" class="contracts-empty" data-testid="contracts-empty">
      <p>No EU public procurement data found for this company.</p>
      <p class="contracts-empty__note">
        TED covers contracts above €140K (services) / €5.4M (works) across 27 EU member states.
      </p>
    </div>

    <!-- Data -->
    <div v-else-if="state === 'done' && data">
      <!-- Summary card -->
      <div class="contracts-summary" data-testid="contracts-summary">
        <div class="contracts-summary__stat">
          <span class="contracts-summary__num">{{ data.contract_count }}</span>
          <span class="contracts-summary__label">Contracts</span>
        </div>
        <div class="contracts-summary__stat">
          <span class="contracts-summary__num">{{ fmtMoney(data.total_contract_value_eur) }}</span>
          <span class="contracts-summary__label">Total Value</span>
        </div>
        <div class="contracts-summary__stat">
          <span class="contracts-summary__num">{{ data.country || '—' }}</span>
          <span class="contracts-summary__label">Country</span>
        </div>
      </div>

      <!-- Contracts table -->
      <table class="contracts-table" data-testid="contracts-table">
        <thead>
          <tr>
            <th class="sortable" @click="sortBy('award_date')">Date{{ indicator('award_date') }}</th>
            <th class="sortable" @click="sortBy('title')">Title{{ indicator('title') }}</th>
            <th class="sortable" @click="sortBy('value_eur')">Value (EUR){{ indicator('value_eur') }}</th>
            <th class="sortable" @click="sortBy('authority')">Authority{{ indicator('authority') }}</th>
            <th>CPV</th>
            <th>Procedure</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in sortedContracts()" :key="c.ted_notice_id">
            <td class="nowrap">{{ c.award_date || '—' }}</td>
            <td>
              <a v-if="c.ted_url" :href="c.ted_url" target="_blank" rel="noopener">{{ c.title }}</a>
              <span v-else>{{ c.title }}</span>
            </td>
            <td class="num">{{ c.value_eur ? fmtMoney(c.value_eur) : '—' }}</td>
            <td>{{ c.authority }} <span class="country-tag">{{ c.authority_country }}</span></td>
            <td class="nowrap">{{ c.cpv || '—' }}</td>
            <td class="nowrap">{{ c.procedure_type || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.contracts-panel {
  padding: 1rem 0;
}

.contracts-loading,
.contracts-error,
.contracts-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary, #888);
}

.contracts-empty__note {
  font-size: 0.85rem;
  margin-top: 0.5rem;
  opacity: 0.7;
}

.contracts-summary {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.contracts-summary__stat {
  display: flex;
  flex-direction: column;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary, #f6f8fa);
  border: 1px solid var(--border-color, #d0d7de);
  border-radius: 8px;
  min-width: 120px;
}

.contracts-summary__num {
  font-size: 1.25rem;
  font-weight: 700;
}

.contracts-summary__label {
  font-size: 0.8rem;
  color: var(--text-secondary, #888);
}

.contracts-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.contracts-table th {
  text-align: left;
  padding: 0.5rem 0.6rem;
  border-bottom: 2px solid var(--border-color, #d0d7de);
  font-weight: 600;
  white-space: nowrap;
}

.contracts-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.contracts-table th.sortable:hover {
  color: var(--accent, #0969da);
}

.contracts-table td {
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--border-color, #d0d7de);
  vertical-align: top;
}

.contracts-table a {
  color: var(--accent, #0969da);
  text-decoration: none;
}

.contracts-table a:hover {
  text-decoration: underline;
}

.num { text-align: right; font-variant-numeric: tabular-nums; }
.nowrap { white-space: nowrap; }

.country-tag {
  display: inline-block;
  font-size: 0.7rem;
  background: var(--bg-secondary, #f6f8fa);
  border: 1px solid var(--border-color, #d0d7de);
  border-radius: 3px;
  padding: 0 0.3rem;
  margin-left: 0.3rem;
  vertical-align: middle;
}
</style>
