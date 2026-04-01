<script setup>
import { ref, onMounted } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import { fmtMoney } from '../utils/format.js'

const data = ref(null)
const state = ref('loading')

onMounted(async () => {
  try {
    const res = await fetch('/api/data-quality')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    data.value = await res.json()
    state.value = 'done'
    document.title = 'Data Quality — GMR'
  } catch {
    state.value = 'error'
  }
})

function fmtNum(n) {
  return n != null ? n.toLocaleString() : '—'
}
</script>

<template>
  <div class="dq">
    <header class="dq-header">
      <div>
        <router-link to="/admin" class="dq-back">&larr; Home</router-link>
        <h1>Data Quality Dashboard</h1>
        <p class="dq-subtitle">Platform health, data coverage, and transparency metrics</p>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="state === 'loading'" class="dq-msg">Loading metrics...</div>
    <div v-else-if="state === 'error'" class="dq-msg">Failed to load data quality metrics.</div>

    <div v-else-if="data" class="dq-grid">
      <!-- ── Graph Stats ── -->
      <section class="dq-section">
        <h2>Knowledge Graph</h2>
        <div class="dq-stats">
          <div v-for="(count, label) in data.graph.nodes" :key="label" class="dq-stat">
            <span class="dq-stat__num">{{ fmtNum(count) }}</span>
            <span class="dq-stat__label">{{ label }}</span>
          </div>
          <div class="dq-stat">
            <span class="dq-stat__num">{{ fmtNum(data.graph.relationships) }}</span>
            <span class="dq-stat__label">Relationships</span>
          </div>
        </div>
      </section>

      <!-- ── Data Freshness ── -->
      <section class="dq-section">
        <h2>Data Freshness</h2>
        <div class="dq-kv">
          <div class="dq-kv__row">
            <span>Contract date range</span>
            <span>{{ data.freshness.contract_date_range?.earliest || '—' }} to {{ data.freshness.contract_date_range?.latest || '—' }}</span>
          </div>
          <div class="dq-kv__row">
            <span>Last data load</span>
            <span>{{ data.freshness.latest_contract_load?.substring(0, 19) || '—' }}</span>
          </div>
          <div v-for="src in data.freshness.financial_sources" :key="src.source" class="dq-kv__row">
            <span>{{ src.source }} financials</span>
            <span>{{ fmtNum(src.n) }} years</span>
          </div>
        </div>
      </section>

      <!-- ── Entity Resolution ── -->
      <section class="dq-section">
        <h2>Entity Resolution</h2>
        <div class="dq-stats">
          <div class="dq-stat">
            <span class="dq-stat__num">{{ fmtNum(data.matching.companies_with_lei) }}</span>
            <span class="dq-stat__label">Companies with LEI</span>
          </div>
          <div class="dq-stat">
            <span class="dq-stat__num">{{ fmtNum(data.matching.companies_with_vat) }}</span>
            <span class="dq-stat__label">Companies with VAT</span>
          </div>
          <div class="dq-stat">
            <span class="dq-stat__num">{{ fmtNum(data.matching.procurement_only_companies) }}</span>
            <span class="dq-stat__label">Procurement-only</span>
          </div>
          <div class="dq-stat" :class="{'dq-stat--warn': data.matching.same_as_pending > 0}">
            <router-link to="/entity-resolution" style="text-decoration: none; color: inherit">
              <span class="dq-stat__num">{{ fmtNum(data.matching.same_as_pending) }}</span>
              <span class="dq-stat__label">Pending review (SAME_AS) &rarr;</span>
            </router-link>
          </div>
        </div>
      </section>

      <!-- ── Coverage by Country ── -->
      <section class="dq-section dq-section--wide">
        <h2>Procurement Coverage by Country</h2>
        <div class="dq-table-wrap">
          <table class="dq-table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Contracts</th>
                <th>Total Value (EUR)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in data.coverage.contracts_by_country" :key="row.country">
                <td>{{ row.country }}</td>
                <td class="num">{{ fmtNum(row.contracts) }}</td>
                <td class="num">{{ row.total_value ? fmtMoney(row.total_value) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ── Top Sectors ── -->
      <section class="dq-section dq-section--wide">
        <h2>Top Procurement Sectors (CPV)</h2>
        <div class="dq-table-wrap">
          <table class="dq-table">
            <thead>
              <tr>
                <th>CPV Code</th>
                <th>Description</th>
                <th>Contracts</th>
                <th>Total Value (EUR)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in data.coverage.top_cpv_sectors" :key="row.code">
                <td class="mono">{{ row.code }}</td>
                <td>{{ row.description || '—' }}</td>
                <td class="num">{{ fmtNum(row.contracts) }}</td>
                <td class="num">{{ row.total_value ? fmtMoney(row.total_value) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ── Transparency note ── -->
      <section class="dq-section dq-section--wide dq-note">
        <h2>About this data</h2>
        <p>All procurement data is sourced from <a href="https://ted.europa.eu" target="_blank" rel="noopener">TED (Tenders Electronic Daily)</a>, the EU's official public procurement database. Financial data comes from <a href="https://www.gleif.org" target="_blank" rel="noopener">GLEIF</a> (company identifiers) and <a href="https://www.sec.gov/edgar" target="_blank" rel="noopener">SEC EDGAR</a> / <a href="https://filings.xbrl.org" target="_blank" rel="noopener">ESEF</a> (financial statements).</p>
        <p>This dashboard shows the current state of the knowledge graph. Data is loaded daily from TED and refreshed periodically from GLEIF. All records are traceable to their source via TED notice IDs and LEI numbers.</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dq { max-width: 1100px; margin: 0 auto; padding: 0 1rem 4rem; }

.dq-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border);
  margin-bottom: 1.5rem;
}
.dq-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0.3rem 0 0; }
.dq-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.dq-back:hover { text-decoration: underline; }
.dq-subtitle { font-size: 0.85rem; color: var(--muted); margin-top: 0.2rem; }

.dq-msg { text-align: center; padding: 4rem 1rem; color: var(--muted); }

.dq-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.25rem;
}

.dq-section {
  background: var(--surface, #f6f8fa);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.25rem;
}
.dq-section--wide { grid-column: 1 / -1; }
.dq-section h2 {
  font-size: 0.9rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--muted); margin-bottom: 0.75rem;
}

.dq-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.6rem;
}
.dq-stat {
  display: flex; flex-direction: column;
  padding: 0.5rem 0.7rem;
  background: var(--bg, #fff);
  border: 1px solid var(--border);
  border-radius: 6px;
}
.dq-stat--warn { border-color: var(--warning, #d29922); }
.dq-stat__num { font-size: 1.2rem; font-weight: 700; color: var(--accent); }
.dq-stat--warn .dq-stat__num { color: var(--warning, #d29922); }
.dq-stat__label { font-size: 0.72rem; color: var(--muted); }

.dq-kv { display: flex; flex-direction: column; gap: 0.4rem; }
.dq-kv__row {
  display: flex; justify-content: space-between;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--border);
  font-size: 0.85rem;
}
.dq-kv__row:last-child { border-bottom: none; }

.dq-table-wrap { overflow-x: auto; }
.dq-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.dq-table th {
  text-align: left; padding: 0.4rem 0.5rem;
  border-bottom: 2px solid var(--border);
  font-weight: 600;
}
.dq-table td {
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid var(--border);
}
.num { text-align: right; font-variant-numeric: tabular-nums; }
.mono { font-family: monospace; font-size: 0.8rem; }

.dq-note { font-size: 0.85rem; color: var(--muted); }
.dq-note p { margin: 0.4rem 0; }
.dq-note a { color: var(--accent); }

@media (max-width: 640px) {
  .dq-grid { grid-template-columns: 1fr; }
}
</style>
