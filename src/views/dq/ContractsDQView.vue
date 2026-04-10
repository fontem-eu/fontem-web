<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import StatCard from '../../components/charts/StatCard.vue'
import GaugeChart from '../../components/charts/GaugeChart.vue'
import ZoomableBarChart from '../../components/charts/ZoomableBarChart.vue'
import HorizontalBarChart from '../../components/charts/HorizontalBarChart.vue'
import { fmtEur } from '../../utils/format.js'

onMounted(() => { document.title = 'TED Contracts Data Quality — GMR' })

const loading = ref(true)
const timeline = ref([])
const valueTimeline = ref([])
const byCountry = ref([])
const nulls = ref(null)
const currencyQuality = ref(null)

onMounted(async () => {
  const endpoints = [
    fetch('/api/data-quality/contracts/timeline'),
    fetch('/api/data-quality/contracts/value-timeline'),
    fetch('/api/data-quality/contracts/by-country'),
    fetch('/api/data-quality/contracts/nulls'),
    fetch('/api/data-quality/contracts/currency-quality'),
  ]
  try {
    const [tl, vt, bc, nl, cq] = await Promise.all(endpoints)
    if (tl.ok) timeline.value = await tl.json()
    if (vt.ok) valueTimeline.value = await vt.json()
    if (bc.ok) byCountry.value = await bc.json()
    if (nl.ok) nulls.value = await nl.json()
    if (cq.ok) currencyQuality.value = await cq.json()
  } catch { /* */ }
  loading.value = false
})

const totalContracts = computed(() => timeline.value.reduce((s, d) => s + d.value, 0))
const totalEur = computed(() => valueTimeline.value.reduce((s, d) => s + d.value, 0))
const countryBars = computed(() => byCountry.value.slice(0, 25).map(c => ({ label: c.country, value: c.contracts })))
const countryEurBars = computed(() => byCountry.value.slice(0, 15).map(c => ({ label: c.country, value: c.total_eur || 0 })))

const nullBars = computed(() => {
  if (!nulls.value) return []
  const total = nulls.value.total || 1
  return Object.entries(nulls.value.missing || {}).map(([field, count]) => ({
    label: field.replace(/_/g, ' '),
    value: Math.round(count / total * 100),
  })).sort((a, b) => b.value - a.value)
})

const conversionRate = computed(() => {
  if (!currencyQuality.value || !currencyQuality.value.total) return 0
  return Math.round(currencyQuality.value.converted_to_eur / currencyQuality.value.total * 100)
})

const undisclosedPct = computed(() => {
  if (!currencyQuality.value || !currencyQuality.value.total) return 0
  return Math.round(currencyQuality.value.value_undisclosed / currencyQuality.value.total * 100)
})

const inferredPct = computed(() => {
  if (!currencyQuality.value || !currencyQuality.value.total) return 0
  return Math.round(currencyQuality.value.currency_inferred / currencyQuality.value.total * 100)
})

const currencyBars = computed(() => {
  if (!currencyQuality.value?.by_currency) return []
  return currencyQuality.value.by_currency.map(c => ({
    label: c.currency,
    value: c.contracts,
  }))
})
</script>

<template>
  <div class="dq">
    <header class="dq-hdr">
      <div>
        <router-link to="/admin/data-quality" class="dq-back">&larr; Data Quality</router-link>
        <h1>TED Contracts</h1>
        <p class="dq-sub">EU public procurement awards — volume, coverage, currency quality</p>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="loading" class="dq-loading">Loading contract data...</div>

    <template v-else>
      <div class="dq-stats">
        <StatCard :value="totalContracts.toLocaleString()" label="Total Contracts" />
        <StatCard :value="fmtEur(totalEur)" label="Total EUR Value" />
        <StatCard :value="byCountry.length" label="Countries" />
        <StatCard
          v-if="currencyQuality"
          :value="undisclosedPct + '%'"
          label="Undisclosed Value"
          color="#d97706"
        />
      </div>

      <!-- Currency quality gauges -->
      <section v-if="currencyQuality" class="dq-section">
        <h2>Currency Quality</h2>
        <div class="dq-gauges">
          <GaugeChart :value="conversionRate" label="EUR Conversion Success" />
          <GaugeChart :value="100 - undisclosedPct" label="Value Disclosed" />
          <GaugeChart :value="100 - inferredPct" label="Currency Declared (vs inferred)" />
        </div>
      </section>

      <section class="dq-section">
        <h2>Contract Volume Over Time</h2>
        <p class="dq-hint">Scroll to zoom in/out. Bars aggregate: daily → weekly → monthly → yearly.</p>
        <ZoomableBarChart :data="timeline" value-label="Contracts" :height="350" />
      </section>

      <section class="dq-section">
        <h2>Contract Value Over Time (EUR)</h2>
        <ZoomableBarChart :data="valueTimeline" value-label="EUR" :height="300" :format-value="fmtEur" color="#16a34a" />
      </section>

      <section class="dq-section">
        <h2>Contracts by Country</h2>
        <HorizontalBarChart :data="countryBars" :max-bars="25" />
      </section>

      <section class="dq-section">
        <h2>Total EUR by Country (Top 15)</h2>
        <HorizontalBarChart :data="countryEurBars" :max-bars="15" :format-value="fmtEur" color="#16a34a" />
      </section>

      <section v-if="currencyBars.length" class="dq-section">
        <h2>Contracts by Currency</h2>
        <p class="dq-hint">Distribution of original currencies. EUR dominates but many EU member contracts use local currency.</p>
        <HorizontalBarChart :data="currencyBars" :max-bars="20" />
      </section>

      <section v-if="nullBars.length" class="dq-section">
        <h2>Missing Fields (% of contracts)</h2>
        <HorizontalBarChart :data="nullBars" :format-value="v => v + '%'" color="#dc2626" />
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
.dq-gauges { display: flex; gap: 2rem; justify-content: center; flex-wrap: wrap; margin: 1rem 0; }
.dq-section { margin-bottom: 2.5rem; }
.dq-section h2 { font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem; }
.dq-hint { font-size: 0.75rem; color: var(--muted); margin-bottom: 0.5rem; }
</style>
