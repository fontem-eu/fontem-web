<script setup>
import { ref, watch, computed } from 'vue'
import { fmtMoney } from '../utils/format.js'
import PocketButton from './PocketButton.vue'

const props = defineProps({
  symbol: { type: String, required: true },
})

const pocketConfig = computed(() => ({ entityId: props.symbol }))
const pocketName = computed(() => `${props.symbol} — Contracts`)

const state = ref('loading')
const data = ref(null)
const sortKey = ref('value_eur')
const sortAsc = ref(false)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function resolveGmrId(symbol) {
  if (UUID_RE.test(symbol)) return symbol
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
    // Try as company first, then as authority
    let res = await fetch(`/api/companies/${encodeURIComponent(gmrId)}/contracts?limit=100`)
    if (res.ok) {
      const json = await res.json()
      if (json.contract_count > 0) {
        data.value = json
        state.value = 'done'
        return
      }
    }
    // Try authority endpoint
    res = await fetch(`/api/authorities/${encodeURIComponent(gmrId)}/contracts?limit=100`)
    if (res.ok) {
      const json = await res.json()
      // Normalize authority response to match company contract format
      data.value = {
        gmr_id: gmrId,
        company_name: json.authority_name,
        country: json.country,
        contract_count: json.contract_count,
        total_contract_value_eur: json.total_spend_eur,
        contracts: json.contracts || [],
      }
      state.value = json.contract_count > 0 ? 'done' : 'empty'
      return
    }
    state.value = 'empty'
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

const sortedContracts = computed(() => {
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
})

function indicator(key) {
  if (sortKey.value !== key) return ''
  return sortAsc.value ? ' \u25B2' : ' \u25BC'
}

const topAuthority = computed(() => {
  if (!data.value?.contracts?.length) return null
  const counts = {}
  for (const c of data.value.contracts) {
    const a = c.authority || 'Unknown'
    counts[a] = (counts[a] || 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
})

const topCpv = computed(() => {
  if (!data.value?.contracts?.length) return null
  const counts = {}
  for (const c of data.value.contracts) {
    const cpv = c.cpv || 'Unknown'
    counts[cpv] = (counts[cpv] || 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
})
</script>

<template>
  <div data-testid="contracts-panel" class="contracts-panel">
    <!-- Loading -->
    <div v-if="state === 'loading'" class="contracts-msg">
      Loading procurement data...
    </div>

    <!-- Error -->
    <div v-else-if="state === 'error'" class="contracts-msg" data-testid="contracts-error">
      Failed to load procurement data.
    </div>

    <!-- Empty -->
    <div v-else-if="state === 'empty'" class="contracts-msg" data-testid="contracts-empty">
      <p>No EU public procurement data found for this company.</p>
      <p class="contracts-note">
        TED covers contracts above &euro;140K (services) / &euro;5.4M (works) across 27 EU member states.
      </p>
    </div>

    <!-- Data -->
    <div v-else-if="state === 'done' && data">
      <!-- Pocket + Summary cards -->
      <div class="contracts-toolbar">
        <PocketButton
          widget-type="contracts_table"
          :config="pocketConfig"
          :default-name="pocketName"
        />
      </div>
      <div class="contracts-summary" data-testid="contracts-summary">
        <div class="cs-card">
          <span class="cs-num">{{ data.contract_count.toLocaleString() }}</span>
          <span class="cs-label">Contracts</span>
        </div>
        <div class="cs-card">
          <span class="cs-num">{{ fmtMoney(data.total_contract_value_eur) }}</span>
          <span class="cs-label">Total Value (EUR)</span>
        </div>
        <div v-if="topAuthority" class="cs-card cs-card--wide">
          <span class="cs-num cs-num--sm">{{ topAuthority }}</span>
          <span class="cs-label">Top Authority</span>
        </div>
        <div v-if="topCpv" class="cs-card cs-card--wide">
          <span class="cs-num cs-num--sm">{{ topCpv }}</span>
          <span class="cs-label">Top Sector (CPV)</span>
        </div>
      </div>

      <!-- Desktop: table -->
      <div class="contracts-table-wrap">
        <table class="contracts-table" data-testid="contracts-table">
          <thead>
            <tr>
              <th class="sortable" @click="sortBy('award_date')">Date{{ indicator('award_date') }}</th>
              <th class="sortable" @click="sortBy('title')">Title{{ indicator('title') }}</th>
              <th class="sortable" @click="sortBy('value_eur')">Value{{ indicator('value_eur') }}</th>
              <th class="sortable" @click="sortBy('authority')">Authority{{ indicator('authority') }}</th>
              <th>CPV</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in sortedContracts" :key="c.ted_notice_id">
              <td class="nowrap">{{ c.award_date?.substring(0, 10) || '—' }}</td>
              <td>
                <a v-if="c.ted_url" :href="c.ted_url" target="_blank" rel="noopener">{{ c.title }}</a>
                <span v-else>{{ c.title }}</span>
              </td>
              <td class="num">{{ c.value_eur ? fmtMoney(c.value_eur) : '—' }}</td>
              <td>{{ c.authority }} <span class="ctag">{{ c.authority_country }}</span></td>
              <td class="nowrap">{{ c.cpv || '—' }}</td>
              <td class="nowrap">{{ c.procedure_type || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile: card list -->
      <div class="contracts-cards">
        <div v-for="c in sortedContracts" :key="c.ted_notice_id" class="contract-card">
          <div class="cc-header">
            <a
              v-if="c.ted_url"
              :href="c.ted_url"
              target="_blank"
              rel="noopener"
              class="cc-title"
            >{{ c.title }}</a>
            <span v-else class="cc-title">{{ c.title }}</span>
          </div>
          <div class="cc-details">
            <span v-if="c.value_eur" class="cc-value">{{ fmtMoney(c.value_eur) }}</span>
            <span v-if="c.award_date" class="cc-date">{{ c.award_date.substring(0, 10) }}</span>
            <span v-if="c.procedure_type" class="ctag">{{ c.procedure_type }}</span>
          </div>
          <div class="cc-meta">
            <span>{{ c.authority }}</span>
            <span class="ctag">{{ c.authority_country }}</span>
            <span v-if="c.cpv" class="cc-cpv">{{ c.cpv }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.contracts-panel { padding: 0.5rem 0; }
.contracts-toolbar { display: flex; justify-content: flex-end; margin-bottom: 0.5rem; }

.contracts-msg {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--muted, #888);
}
.contracts-note { font-size: 0.85rem; margin-top: 0.5rem; opacity: 0.7; }

/* ── Summary cards ── */
.contracts-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.cs-card {
  padding: 0.6rem 0.8rem;
  background: var(--surface, #f6f8fa);
  border: 1px solid var(--border, #d0d7de);
  border-radius: 8px;
}
.cs-card--wide { grid-column: span 2; }
@media (max-width: 500px) { .cs-card--wide { grid-column: span 1; } }
.cs-num { display: block; font-size: 1.3rem; font-weight: 700; color: var(--accent, #0969da); }
.cs-num--sm { font-size: 0.9rem; font-weight: 600; color: var(--text, #1f2328); }
.cs-label { font-size: 0.75rem; color: var(--muted, #888); }

/* ── Desktop table ── */
.contracts-table-wrap { overflow-x: auto; }
.contracts-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.contracts-table th {
  text-align: left; padding: 0.45rem 0.5rem;
  border-bottom: 2px solid var(--border, #d0d7de);
  font-weight: 600; white-space: nowrap;
}
.contracts-table th.sortable { cursor: pointer; user-select: none; }
.contracts-table th.sortable:hover { color: var(--accent, #0969da); }
.contracts-table td {
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid var(--border, #d0d7de);
  vertical-align: top;
}
.contracts-table a { color: var(--accent, #0969da); text-decoration: none; }
.contracts-table a:hover { text-decoration: underline; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.nowrap { white-space: nowrap; }

/* ── Mobile cards ── */
.contracts-cards { display: none; }
.contract-card {
  padding: 0.7rem;
  border: 1px solid var(--border, #d0d7de);
  border-radius: 8px;
  margin-bottom: 0.5rem;
}
.cc-header { margin-bottom: 0.3rem; }
.cc-title { font-weight: 600; font-size: 0.9rem; color: var(--accent, #0969da); text-decoration: none; display: block; }
.cc-title:hover { text-decoration: underline; }
.cc-details { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin-bottom: 0.3rem; }
.cc-value { font-weight: 700; font-size: 0.95rem; }
.cc-date { font-size: 0.8rem; color: var(--muted, #888); }
.cc-meta { font-size: 0.8rem; color: var(--muted, #888); display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }
.cc-cpv { font-size: 0.75rem; opacity: 0.7; }

.ctag {
  display: inline-block; font-size: 0.7rem;
  background: var(--surface, #f6f8fa);
  border: 1px solid var(--border, #d0d7de);
  border-radius: 3px; padding: 0 0.25rem;
}

/* ── Responsive switch ── */
@media (max-width: 640px) {
  .contracts-table-wrap { display: none; }
  .contracts-cards { display: block; }
}
</style>
