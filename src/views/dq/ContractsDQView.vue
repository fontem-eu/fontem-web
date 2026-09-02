<script setup>
import { ref, onMounted, computed } from 'vue'
import SourcePipelinePanel from '../../components/SourcePipelinePanel.vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import PocketableChart from '../../components/charts/PocketableChart.vue'
import { fmtEur } from '../../utils/format.js'

onMounted(() => { document.title = 'TED Contracts Data Quality — Dargle' })

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
        <PocketableChart
          chart="stat"
          chart-key="contracts_total"
          :chart-props="{ value: totalContracts.toLocaleString(), label: 'Total Contracts' }"
          name="Total Contracts"
        />
        <PocketableChart
          chart="stat"
          chart-key="contracts_total_eur"
          :chart-props="{ value: fmtEur(totalEur), label: 'Total EUR Value' }"
          name="Total EUR Value"
        />
        <PocketableChart
          chart="stat"
          chart-key="contracts_countries"
          :chart-props="{ value: byCountry.length, label: 'Countries' }"
          name="Countries"
        />
        <PocketableChart
          v-if="currencyQuality"
          chart="stat"
          chart-key="contracts_undisclosed_value"
          :chart-props="{ value: undisclosedPct + '%', label: 'Undisclosed Value', color: '#d97706' }"
          name="Undisclosed Value"
        />
      </div>

      <!-- Tender integrity — the procurement-integrity lens -->
      <section v-if="integrity" class="dq-section" data-testid="dq-integrity">
        <h2>{{ $t('contracts_d_q.tender_integrity') }}</h2>
        <p class="dq-hint">{{ $t('contracts_d_q.single_bidder_rate_and_red_flag_indicators') }}</p>
        <div class="dq-stats">
          <PocketableChart
            chart="stat"
            chart-key="contracts_single_bidder_rate"
            :chart-props="{ value: (singleBidderRatePct ?? '—') + (singleBidderRatePct == null ? '' : '%'), label: 'Single-bidder rate', color: singleBidderRatePct >= 30 ? '#dc2626' : '#d97706' }"
            name="Single-bidder rate"
            data-testid="dq-single-bidder-rate"
          />
          <PocketableChart
            chart="stat"
            chart-key="contracts_single_bidder_count"
            :chart-props="{ value: (integrity.single_bidder ?? 0).toLocaleString(), label: 'Single-bidder contracts' }"
            name="Single-bidder contracts"
          />
          <PocketableChart
            chart="stat"
            chart-key="contracts_bidder_coverage"
            :chart-props="{ value: (bidderCoveragePct ?? '—') + (bidderCoveragePct == null ? '' : '%'), label: 'Bidder-count coverage' }"
            name="Bidder-count coverage"
          />
          <PocketableChart
            chart="stat"
            chart-key="contracts_proc_coverage"
            :chart-props="{ value: (procCoveragePct ?? '—') + (procCoveragePct == null ? '' : '%'), label: 'Procedure-type coverage' }"
            name="Procedure-type coverage"
          />
        </div>
        <div class="dq-gauges">
          <PocketableChart
            chart="gauge"
            chart-key="contracts_single_bidder_rate_gauge"
            :chart-props="{ value: singleBidderRatePct || 0, label: 'Single-bidder rate' }"
            name="Single-bidder rate"
          />
          <PocketableChart
            chart="gauge"
            chart-key="contracts_bidder_coverage_gauge"
            :chart-props="{ value: bidderCoveragePct || 0, label: 'Bidder-count coverage' }"
            name="Bidder-count coverage"
          />
        </div>
        <section v-if="flagBars.length" class="dq-subsection">
          <h3>{{ $t('contracts_d_q.red_flags_by_type') }}</h3>
          <PocketableChart
            chart="bar_h"
            chart-key="contracts_red_flags"
            :chart-props="{ data: flagBars, color: '#d97706' }"
            name="Red flags by type"
          />
        </section>
        <section v-if="redFlagDistBars.length" class="dq-subsection">
          <h3>{{ $t('contracts_d_q.red_flag_count_distribution') }}</h3>
          <PocketableChart
            chart="bar_h"
            chart-key="contracts_red_flag_dist"
            :chart-props="{ data: redFlagDistBars, color: '#dc2626' }"
            name="Red-flag count distribution"
          />
        </section>
      </section>

      <!-- Currency quality gauges -->
      <section v-if="currencyQuality" class="dq-section">
        <h2>{{ $t('contracts_d_q.currency_quality') }}</h2>
        <div class="dq-gauges">
          <PocketableChart
            chart="gauge"
            chart-key="contracts_conversion_gauge"
            :chart-props="{ value: conversionRate, label: 'EUR Conversion Success' }"
            name="EUR Conversion Success"
          />
          <PocketableChart
            chart="gauge"
            chart-key="contracts_value_disclosed_gauge"
            :chart-props="{ value: 100 - undisclosedPct, label: 'Value Disclosed' }"
            name="Value Disclosed"
          />
        </div>
      </section>

      <section class="dq-section">
        <h2>{{ $t('contracts_d_q.contract_volume_over_time') }}</h2>
        <p class="dq-hint">{{ $t('contracts_d_q.scroll_to_zoom_in_out') }}</p>
        <PocketableChart
          chart="ts_bar"
          chart-key="contracts_volume_timeline"
          :chart-props="{ data: timeline, valueLabel: 'Contracts', height: 350 }"
          :name="$t('contracts_d_q.contract_volume_over_time')"
        />
      </section>

      <section class="dq-section">
        <h2>{{ $t('contracts_d_q.contract_value_over_time_eur') }}</h2>
        <PocketableChart
          chart="ts_bar"
          chart-key="contracts_value_timeline"
          :chart-props="{ data: valueTimeline, valueLabel: 'EUR', height: 300, format: 'eur', color: '#16a34a' }"
          :name="$t('contracts_d_q.contract_value_over_time_eur')"
        />
      </section>

      <section class="dq-section">
        <h2>{{ $t('contracts_d_q.contracts_by_country') }}</h2>
        <PocketableChart
          chart="bar_h"
          chart-key="contracts_by_country"
          :chart-props="{ data: countryBars, maxBars: 25 }"
          :name="$t('contracts_d_q.contracts_by_country')"
        />
      </section>

      <section class="dq-section">
        <h2>{{ $t('contracts_d_q.total_eur_by_country_top_15') }}</h2>
        <PocketableChart
          chart="bar_h"
          chart-key="contracts_by_country_eur"
          :chart-props="{ data: countryEurBars, maxBars: 15, format: 'eur', color: '#16a34a' }"
          :name="$t('contracts_d_q.total_eur_by_country_top_15')"
        />
      </section>

      <section v-if="currencyBars.length" class="dq-section">
        <h2>{{ $t('contracts_d_q.contracts_by_currency') }}</h2>
        <p class="dq-hint">{{ $t('contracts_d_q.distribution_of_original_currencies') }}</p>
        <PocketableChart
          chart="bar_h"
          chart-key="contracts_by_currency"
          :chart-props="{ data: currencyBars, maxBars: 20 }"
          :name="$t('contracts_d_q.contracts_by_currency')"
        />
      </section>

      <section v-if="nullBars.length" class="dq-section">
        <h2>{{ $t('contracts_d_q.missing_fields_of_contracts') }}</h2>
        <PocketableChart
          chart="bar_h"
          chart-key="contracts_missing_fields"
          :chart-props="{ data: nullBars, format: 'pct', color: '#dc2626' }"
          :name="$t('contracts_d_q.missing_fields_of_contracts')"
        />
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