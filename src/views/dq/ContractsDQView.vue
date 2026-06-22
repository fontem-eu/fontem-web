<script setup>
import { ref, onMounted, computed } from 'vue'
import SourcePipelinePanel from '../../components/SourcePipelinePanel.vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import StatCard from '../../components/charts/StatCard.vue'
import GaugeChart from '../../components/charts/GaugeChart.vue'
import ZoomableBarChart from '../../components/charts/ZoomableBarChart.vue'
import HorizontalBarChart from '../../components/charts/HorizontalBarChart.vue'
import { fmtEur } from '../../utils/format.js'

onMounted(() => { document.title = 'TED Contracts Data Quality — Fontem' })

const loading = ref(true)
const timeline = ref([])
const valueTimeline = ref([])
const byCountry = ref([])
const nulls = ref(null)
const currencyQuality = ref(null)
const integrity = ref(null)

onMounted(async () => {
  const endpoints = [
    fetch('/api/data-quality/contracts/timeline'),
    fetch('/api/data-quality/contracts/value-timeline'),
    fetch('/api/data-quality/contracts/by-country'),
    fetch('/api/data-quality/contracts/nulls'),
    fetch('/api/data-quality/contracts/currency-quality'),
    fetch('/api/data-quality/contracts/integrity'),
  ]
  try {
    const [tl, vt, bc, nl, cq, it] = await Promise.all(endpoints)
    if (tl.ok) timeline.value = await tl.json()
    if (vt.ok) valueTimeline.value = await vt.json()
    if (bc.ok) byCountry.value = await bc.json()
    if (nl.ok) nulls.value = await nl.json()
    if (cq.ok) currencyQuality.value = await cq.json()
    if (it.ok) integrity.value = await it.json()
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

const currencyBars = computed(() => {
  if (!currencyQuality.value?.by_currency) return []
  return currencyQuality.value.by_currency.map(c => ({
    label: c.currency,
    value: c.contracts,
  }))
})

const pct = (x) => (x == null ? null : Math.round(x * 100))
const singleBidderRatePct = computed(() => pct(integrity.value?.single_bidder_rate))
const bidderCoveragePct = computed(() => pct(integrity.value?.bidder_count_coverage))
const procCoveragePct = computed(() => pct(integrity.value?.procedure_type_coverage))
const flagLabels = {
  single_bidder: 'Single bidder', non_open: 'Non-open procedure',
  no_call: 'No call for bids', price_only: 'Lowest-price only',
}
const flagBars = computed(() => {
  const f = integrity.value?.flags
  if (!f) return []
  return Object.entries(f)
    .map(([k, v]) => ({ label: flagLabels[k] || k, value: v }))
    .sort((a, b) => b.value - a.value)
})
const redFlagDistBars = computed(() =>
  (integrity.value?.red_flag_distribution || []).map(d => ({
    label: `${d.flags} flag${d.flags === 1 ? '' : 's'}`, value: d.contracts,
  })))
</script>

<template>
  <div class="dq">
    <header class="dq-hdr">
      <div>
        <router-link to="/data-quality" class="dq-back">{{ $t('nav.back_data_quality') }}</router-link>
        <h1>{{ $t('contracts_d_q.ted_contracts') }}</h1>
        <p class="dq-sub">{{ $t('contracts_d_q.eu_public_procurement_awards_volume_cove') }}</p>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="loading" class="dq-loading">{{ $t('contracts_d_q.loading_contract_data') }}</div>

    <template v-else>
      <SourcePipelinePanel source-id="contracts" />

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

      <!-- Tender integrity — the procurement-integrity lens -->
      <section v-if="integrity" class="dq-section" data-testid="dq-integrity">
        <h2>Tender Integrity</h2>
        <p class="dq-hint">Single-bidder rate and red-flag indicators per the EC Single Market Scoreboard / ECA CRI methodology — a flag is a prompt to look, not proof of wrongdoing.</p>
        <div class="dq-stats">
          <StatCard
            :value="(singleBidderRatePct ?? '\u2014') + (singleBidderRatePct == null ? '' : '%')"
            label="Single-bidder rate"
            :color="singleBidderRatePct >= 30 ? '#dc2626' : '#d97706'"
            data-testid="dq-single-bidder-rate"
          />
          <StatCard :value="(integrity.single_bidder ?? 0).toLocaleString()" label="Single-bidder contracts" />
          <StatCard :value="(bidderCoveragePct ?? '\u2014') + (bidderCoveragePct == null ? '' : '%')" label="Bidder-count coverage" />
          <StatCard :value="(procCoveragePct ?? '\u2014') + (procCoveragePct == null ? '' : '%')" label="Procedure-type coverage" />
        </div>
        <div class="dq-gauges">
          <GaugeChart :value="singleBidderRatePct || 0" label="Single-bidder rate" />
          <GaugeChart :value="bidderCoveragePct || 0" label="Bidder-count coverage" />
        </div>
        <section v-if="flagBars.length" class="dq-subsection">
          <h3>Red flags by type</h3>
          <HorizontalBarChart :data="flagBars" color="#d97706" />
        </section>
        <section v-if="redFlagDistBars.length" class="dq-subsection">
          <h3>Red-flag count distribution</h3>
          <HorizontalBarChart :data="redFlagDistBars" color="#dc2626" />
        </section>
      </section>

      <!-- Currency quality gauges -->
      <section v-if="currencyQuality" class="dq-section">
        <h2>{{ $t('contracts_d_q.currency_quality') }}</h2>
        <div class="dq-gauges">
          <GaugeChart :value="conversionRate" label="EUR Conversion Success" />
          <GaugeChart :value="100 - undisclosedPct" label="Value Disclosed" />
        </div>
      </section>

      <section class="dq-section">
        <h2>{{ $t('contracts_d_q.contract_volume_over_time') }}</h2>
        <p class="dq-hint">Scroll to zoom in/out. Bars aggregate: daily → weekly → monthly → yearly.</p>
        <ZoomableBarChart :data="timeline" value-label="Contracts" :height="350" />
      </section>

      <section class="dq-section">
        <h2>{{ $t('contracts_d_q.contract_value_over_time_eur') }}</h2>
        <ZoomableBarChart :data="valueTimeline" value-label="EUR" :height="300" :format-value="fmtEur" color="#16a34a" />
      </section>

      <section class="dq-section">
        <h2>{{ $t('contracts_d_q.contracts_by_country') }}</h2>
        <HorizontalBarChart :data="countryBars" :max-bars="25" />
      </section>

      <section class="dq-section">
        <h2>{{ $t('contracts_d_q.total_eur_by_country_top_15') }}</h2>
        <HorizontalBarChart :data="countryEurBars" :max-bars="15" :format-value="fmtEur" color="#16a34a" />
      </section>

      <section v-if="currencyBars.length" class="dq-section">
        <h2>{{ $t('contracts_d_q.contracts_by_currency') }}</h2>
        <p class="dq-hint">Distribution of original currencies. EUR dominates but many EU member contracts use local currency.</p>
        <HorizontalBarChart :data="currencyBars" :max-bars="20" />
      </section>

      <section v-if="nullBars.length" class="dq-section">
        <h2>{{ $t('contracts_d_q.missing_fields_of_contracts') }}</h2>
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
