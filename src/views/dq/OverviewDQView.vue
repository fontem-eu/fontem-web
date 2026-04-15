<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import StatCard from '../../components/charts/StatCard.vue'
import GaugeChart from '../../components/charts/GaugeChart.vue'
import HorizontalBarChart from '../../components/charts/HorizontalBarChart.vue'

onMounted(() => { document.title = 'Data Quality Overview — GMR' })

const overlap = ref(null)
const countryCodes = ref(null)
const completeness = ref(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const [r1, r2, r3] = await Promise.all([
      fetch('/api/data-quality/cross-source-overlap'),
      fetch('/api/data-quality/country-codes'),
      fetch('/api/data-quality/field-completeness'),
    ])
    if (r1.ok) overlap.value = await r1.json()
    if (r2.ok) countryCodes.value = await r2.json()
    if (r3.ok) completeness.value = await r3.json()
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
        <router-link to="/admin/data-quality" class="dq-back">&larr; Data Quality</router-link>
        <h1>Data Quality Overview</h1>
        <p class="dq-sub">Cross-source overlap, country code consistency, and field completeness across all data sources</p>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="loading" class="dq-loading">Loading...</div>

    <template v-else>
      <!-- Cross-source overlap -->
      <section v-if="overlap" class="dq-section">
        <h2>Cross-Source Overlap</h2>
        <p class="dq-hint">How many entities appear in multiple data sources — a measure of graph connectivity.</p>
        <div class="dq-stats">
          <StatCard :value="fmt(overlap.contracts_and_cohesion)" label="Contracts + Cohesion" />
          <StatCard :value="fmt(overlap.contracts_and_lobby)" label="Contracts + Lobby" />
          <StatCard :value="fmt(overlap.listed_and_contracts)" label="Listed + Contracts" />
          <StatCard :value="fmt(overlap.sanctions_matched)" label="Sanctions Matched" />
        </div>
        <table class="overlap-matrix">
          <thead>
            <tr><th></th><th>Contracts</th><th>Cohesion</th><th>Lobby</th><th>Listings</th><th>Sanctions</th></tr>
          </thead>
          <tbody>
            <tr><th>Contracts</th><td class="self">-</td><td>{{ fmt(overlap.contracts_and_cohesion) }}</td><td>{{ fmt(overlap.contracts_and_lobby) }}</td><td>{{ fmt(overlap.listed_and_contracts) }}</td><td>{{ fmt(overlap.sanctions_matched) }}</td></tr>
            <tr><th>Cohesion</th><td>{{ fmt(overlap.contracts_and_cohesion) }}</td><td class="self">-</td><td>-</td><td>-</td><td>-</td></tr>
            <tr><th>Lobby</th><td>{{ fmt(overlap.contracts_and_lobby) }}</td><td>-</td><td class="self">-</td><td>-</td><td>-</td></tr>
            <tr><th>Listings</th><td>{{ fmt(overlap.listed_and_contracts) }}</td><td>-</td><td>-</td><td class="self">-</td><td>-</td></tr>
            <tr><th>Sanctions</th><td>{{ fmt(overlap.sanctions_matched) }}</td><td>-</td><td>-</td><td>-</td><td class="self">-</td></tr>
          </tbody>
        </table>
      </section>

      <!-- Country code consistency -->
      <section v-if="countryCodes" class="dq-section">
        <h2>Country Code Consistency</h2>
        <div v-if="countryCodes.alpha2_count > 0" class="dq-warn">
          {{ fmt(countryCodes.alpha2_count) }} companies still use alpha-2 country codes instead of ISO 3166-1 alpha-2/alpha-3.
        </div>
        <div class="dq-stats">
          <StatCard :value="fmt(countryCodes.alpha2_count)" label="Alpha-2 Codes" />
          <StatCard :value="fmt(countryCodes.alpha3_count)" label="Alpha-3 Codes" />
          <StatCard :value="fmt(countryCodes.other_count)" label="Other Format" />
          <StatCard :value="fmt(countryCodes.no_country_count)" label="No Country" />
        </div>
        <div class="dq-gauges">
          <GaugeChart :value="alpha3Pct" label="Alpha-3 %" />
          <GaugeChart :value="alpha2Pct" label="Alpha-2 %" />
        </div>
        <template v-if="alpha2Bars.length">
          <h3>Top Alpha-2 Codes</h3>
          <HorizontalBarChart :data="alpha2Bars" :max-bars="10" />
        </template>
      </section>

      <!-- Field completeness -->
      <section v-if="completeness" class="dq-section">
        <h2>Field Completeness</h2>
        <p class="dq-hint">Coverage percentage per field. Green = >90%, yellow = 50-90%, red = &lt;50%.</p>

        <div class="completeness-group">
          <h3>Sanctions ({{ fmt(completeness.sanctions?.total) }} entities)</h3>
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
          <h3>Cohesion Projects ({{ fmt(completeness.cohesion?.total) }} projects)</h3>
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
          <h3>Companies ({{ fmt(completeness.companies?.total) }} companies)</h3>
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
