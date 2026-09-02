<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import PocketableChart from '../../components/charts/PocketableChart.vue'

onMounted(() => { document.title = 'Data Quality Overview — Dargle' })

const overlap = ref(null)
const countryCodes = ref(null)
const completeness = ref(null)
const graph = ref(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const [r1, r2, r3, r4] = await Promise.all([
      fetch('/api/data-quality/cross-source-overlap'),
      fetch('/api/data-quality/country-codes'),
      fetch('/api/data-quality/field-completeness'),
      fetch('/api/data-quality'),
    ])
    if (r1.ok) overlap.value = await r1.json()
    if (r2.ok) countryCodes.value = await r2.json()
    if (r3.ok) completeness.value = await r3.json()
    if (r4.ok) graph.value = (await r4.json()).graph
  } catch { /* */ }
  loading.value = false
})

// Country code gauge: percentage that are alpha-2 (the "bad" format)
const totalWithCountry = computed(() => {
  if (!countryCodes.value) return 0
  const cc = countryCodes.value
  return cc.alpha2_count + cc.alpha3_count + cc.other_count
})
const alpha2Pct = computed(() => {
  if (!totalWithCountry.value) return 0
  return Math.round(countryCodes.value.alpha2_count / totalWithCountry.value * 100)
})
const alpha3Pct = computed(() => {
  if (!totalWithCountry.value) return 0
  return Math.round(countryCodes.value.alpha3_count / totalWithCountry.value * 100)
})
const alpha2Bars = computed(() =>
  (countryCodes.value?.top_alpha2_codes || []).map(c => ({ label: c.code, value: c.n }))
)

// Field completeness bars
function makeCompleteBars(group, fields) {
  if (!completeness.value || !completeness.value[group]) return []
  const g = completeness.value[group]
  return fields.map(([key, label]) => ({
    label,
    value: g[key] ?? 0,
    color: (g[key] ?? 0) >= 90 ? '#16a34a' : (g[key] ?? 0) >= 50 ? '#ca8a04' : '#dc2626',
  }))
}
const sanctionBars = computed(() => makeCompleteBars('sanctions', [
  ['name_pct', 'Name'], ['regime_pct', 'Sanction Regime'],
]))
const cohesionBars = computed(() => makeCompleteBars('cohesion', [
  ['start_date_pct', 'Start Date'], ['nuts_code_pct', 'NUTS Code'], ['nuts_linked_pct', 'NUTS Linked'],
]))
const companyBars = computed(() => makeCompleteBars('companies', [
  ['lei_pct', 'LEI'], ['country_pct', 'Country'], ['nuts_linked_pct', 'NUTS Linked'],
]))

function fmt(n) { return n == null ? '—' : Number(n).toLocaleString() }
</script>
<template>
  <div class="dq">
    <header class="dq-hdr">
      <div>
        <router-link to="/data-quality" class="dq-back">{{ $t('nav.back_data_quality') }}</router-link>
        <h1>{{ $t('overview_d_q.data_quality_overview') }}</h1>
        <p class="dq-sub">{{ $t('overview_d_q.cross_source_overlap_country_code_consis') }}</p>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="loading" class="dq-loading">{{ $t('app.loading_2') }}</div>

    <template v-else>
      <!-- Graph totals — node counts across the whole graph. Moved here off
           the dashboards hub landing, which used to block on this same
           /api/data-quality call. -->
      <section v-if="graph?.nodes" class="dq-section">
        <h2>{{ $t('overview_d_q.graph_totals') }}</h2>
        <div class="dq-totals">
          <div v-for="[label, count] in Object.entries(graph.nodes)" :key="label" class="dq-total">
            <span class="dq-total-num">{{ fmt(count) }}</span>
            <span class="dq-total-label">{{ label }}</span>
          </div>
        </div>
      </section>

      <!-- Cross-source overlap -->
      <section v-if="overlap" class="dq-section">
        <h2>{{ $t('overview_d_q.cross_source_overlap') }}</h2>
        <p class="dq-hint">{{ $t('overview_d_q.how_many_entities_appear_in_multiple_data_sources') }}</p>
        <div class="dq-stats">
          <PocketableChart chart-key="overview_overlap_contracts_cohesion" chart="stat" :chart-props="{ value: fmt(overlap.contracts_and_cohesion), label: 'Contracts + Cohesion' }" name="Contracts + Cohesion" />
          <PocketableChart chart-key="overview_overlap_contracts_lobby" chart="stat" :chart-props="{ value: fmt(overlap.contracts_and_lobby), label: 'Contracts + Lobby' }" name="Contracts + Lobby" />
          <PocketableChart chart-key="overview_overlap_listed_contracts" chart="stat" :chart-props="{ value: fmt(overlap.listed_and_contracts), label: 'Listed + Contracts' }" name="Listed + Contracts" />
          <PocketableChart chart-key="overview_overlap_sanctions_matched" chart="stat" :chart-props="{ value: fmt(overlap.sanctions_matched), label: 'Sanctions Matched' }" name="Sanctions Matched" />
        </div>
        <table class="overlap-matrix">
          <thead>
            <tr><th></th><th>{{ $t('app.contracts') }}</th><th>{{ $t('overview_d_q.cohesion') }}</th><th>{{ $t('overview_d_q.lobby') }}</th><th>{{ $t('overview_d_q.listings') }}</th><th>{{ $t('app.sanctions') }}</th></tr>
          </thead>
          <tbody>
            <tr><th>{{ $t('app.contracts') }}</th><td class="self">-</td><td>{{ fmt(overlap.contracts_and_cohesion) }}</td><td>{{ fmt(overlap.contracts_and_lobby) }}</td><td>{{ fmt(overlap.listed_and_contracts) }}</td><td>{{ fmt(overlap.sanctions_matched) }}</td></tr>
            <tr><th>{{ $t('overview_d_q.cohesion') }}</th><td>{{ fmt(overlap.contracts_and_cohesion) }}</td><td class="self">-</td><td>-</td><td>-</td><td>-</td></tr>
            <tr><th>{{ $t('overview_d_q.lobby') }}</th><td>{{ fmt(overlap.contracts_and_lobby) }}</td><td>-</td><td class="self">-</td><td>-</td><td>-</td></tr>
            <tr><th>{{ $t('overview_d_q.listings') }}</th><td>{{ fmt(overlap.listed_and_contracts) }}</td><td>-</td><td>-</td><td class="self">-</td><td>-</td></tr>
            <tr><th>{{ $t('app.sanctions') }}</th><td>{{ fmt(overlap.sanctions_matched) }}</td><td>-</td><td>-</td><td>-</td><td class="self">-</td></tr>
          </tbody>
        </table>
      </section>

      <!-- Country code consistency -->
      <section v-if="countryCodes" class="dq-section">
        <h2>{{ $t('overview_d_q.country_code_consistency') }}</h2>
        <div v-if="countryCodes.alpha2_count > 0" class="dq-warn">
          {{ fmt(countryCodes.alpha2_count) }} {{ $t('overview_d_q.companies_still_use_alpha_2_country_codes') }}
        </div>
        <div class="dq-stats">
          <PocketableChart chart-key="overview_alpha2_count" chart="stat" :chart-props="{ value: fmt(countryCodes.alpha2_count), label: 'Alpha-2 Codes' }" name="Alpha-2 Codes" />
          <PocketableChart chart-key="overview_alpha3_count" chart="stat" :chart-props="{ value: fmt(countryCodes.alpha3_count), label: 'Alpha-3 Codes' }" name="Alpha-3 Codes" />
          <PocketableChart chart-key="overview_other_count" chart="stat" :chart-props="{ value: fmt(countryCodes.other_count), label: 'Other Format' }" name="Other Format" />
          <PocketableChart chart-key="overview_no_country_count" chart="stat" :chart-props="{ value: fmt(countryCodes.no_country_count), label: 'No Country' }" name="No Country" />
        </div>
        <div class="dq-gauges">
          <PocketableChart chart-key="overview_alpha3_pct" chart="gauge" :chart-props="{ value: alpha3Pct, label: 'Alpha-3 %' }" name="Alpha-3 %" />
          <PocketableChart chart-key="overview_alpha2_pct" chart="gauge" :chart-props="{ value: alpha2Pct, label: 'Alpha-2 %' }" name="Alpha-2 %" />
        </div>
        <template v-if="alpha2Bars.length">
          <h3>{{ $t('overview_d_q.top_alpha_2_codes') }}</h3>
          <PocketableChart chart-key="overview_top_alpha2" chart="bar_h" :chart-props="{ data: alpha2Bars, maxBars: 10 }" :name="$t('overview_d_q.top_alpha_2_codes')" />
        </template>
      </section>

      <!-- Field completeness -->
      <section v-if="completeness" class="dq-section">
        <h2>{{ $t('overview_d_q.field_completeness') }}</h2>
        <p class="dq-hint">{{ $t('overview_d_q.coverage_percentage_per_field') }}</p>

        <div class="completeness-group">
          <h3>{{ $t('overview_d_q.sanctions') }} ({{ fmt(completeness.sanctions?.total) }} {{ $t('overview_d_q.entities') }})</h3>
          <div class="completeness-bars">
            <div v-for="bar in sanctionBars" :key="bar.label" class="completeness-row">
              <span class="completeness-label">{{ bar.label }}</span>
              <div class="completeness-track">
                <div class="completeness-fill" :style="{ width: bar.value + '%', background: bar.color }"></div>
              </div>
              <span class="completeness-pct">{{ bar.value }}%</span>
            </div>
          </div>
        </div>

        <div class="completeness-group">
          <h3>{{ $t('overview_d_q.cohesion_projects') }} ({{ fmt(completeness.cohesion?.total) }} {{ $t('overview_d_q.projects') }})</h3>
          <div class="completeness-bars">
            <div v-for="bar in cohesionBars" :key="bar.label" class="completeness-row">
              <span class="completeness-label">{{ bar.label }}</span>
              <div class="completeness-track">
                <div class="completeness-fill" :style="{ width: bar.value + '%', background: bar.color }"></div>
              </div>
              <span class="completeness-pct">{{ bar.value }}%</span>
            </div>
          </div>
        </div>

        <div class="completeness-group">
          <h3>{{ $t('overview_d_q.companies') }} ({{ fmt(completeness.companies?.total) }} {{ $t('overview_d_q.companies_2') }})</h3>
          <div class="completeness-bars">
            <div v-for="bar in companyBars" :key="bar.label" class="completeness-row">
              <span class="completeness-label">{{ bar.label }}</span>
              <div class="completeness-track">
                <div class="completeness-fill" :style="{ width: bar.value + '%', background: bar.color }"></div>
              </div>
              <span class="completeness-pct">{{ bar.value }}%</span>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
<style scoped>
.dq { max-width: 900px; margin: 0 auto; padding: 0 1rem 4rem; }
.dq-hdr { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.dq-hdr h1 { font-size: 1.3rem; font-weight: 700; margin: 0.3rem 0 0; }
.dq-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.dq-sub { font-size: 0.82rem; color: var(--muted); margin-top: 0.15rem; }
.dq-loading { text-align: center; padding: 3rem; color: var(--muted); }
.dq-totals { display: flex; gap: 1rem; flex-wrap: wrap; padding: 0.75rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
.dq-total { text-align: center; flex: 1; min-width: 80px; }
.dq-total-num { display: block; font-size: 1.1rem; font-weight: 700; color: var(--accent); }
.dq-total-label { font-size: 0.65rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
.dq-stats { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.dq-gauges { display: flex; gap: 2rem; justify-content: center; margin-bottom: 2rem; }
.dq-section { margin-bottom: 2.5rem; }
.dq-section h2 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; }
.dq-section h3 { font-size: 0.95rem; font-weight: 600; margin: 1rem 0 0.5rem; }
.dq-hint { font-size: 0.82rem; color: var(--muted); margin-bottom: 1rem; }
.dq-warn { background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; border-radius: 6px; padding: 0.6rem 1rem; font-size: 0.85rem; margin-bottom: 1rem; font-weight: 500; }

.overlap-matrix { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 1rem; }
.overlap-matrix th, .overlap-matrix td { padding: 0.4rem 0.6rem; border: 1px solid var(--border); text-align: center; }
.overlap-matrix thead th { background: var(--surface); font-weight: 600; }
.overlap-matrix tbody th { text-align: left; background: var(--surface); font-weight: 600; }
.overlap-matrix .self { color: var(--muted); }

.completeness-group { margin-bottom: 1.5rem; }
.completeness-bars { display: flex; flex-direction: column; gap: 0.5rem; }
.completeness-row { display: flex; align-items: center; gap: 0.75rem; }
.completeness-label { width: 120px; font-size: 0.82rem; font-weight: 500; flex-shrink: 0; }
.completeness-track { flex: 1; height: 18px; background: var(--border); border-radius: 4px; overflow: hidden; }
.completeness-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease; }
.completeness-pct { width: 45px; text-align: right; font-size: 0.82rem; font-weight: 600; flex-shrink: 0; }
</style>
