<script setup>
import { ref, onMounted, computed } from 'vue'
import SourcePipelinePanel from '../../components/SourcePipelinePanel.vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import PocketableChart from '../../components/charts/PocketableChart.vue'

onMounted(() => { document.title = 'OpenFIGI & Funds Data Quality — Fontem' })
const data = ref(null)
const loading = ref(true)
onMounted(async () => {
  try { const r = await fetch('/api/data-quality/openfigi'); if (r.ok) data.value = await r.json() } catch { /* */ }
  loading.value = false
})
const secTypePct = computed(() => data.value ? data.value.security_type_rate : 0)
const secTypeBars = computed(() => (data.value?.by_security_type || []).map(t => ({ label: t.security_type, value: t.count })))
const fundTypeBars = computed(() => (data.value?.funds?.by_type || []).map(t => ({ label: t.fund_type, value: t.count })))
const dualLabelOk = computed(() => (data.value?.funds?.dual_label_violations ?? 0) === 0)
</script>
<template>
  <div class="dq"><header class="dq-hdr"><div><router-link to="/data-quality" class="dq-back">{{ $t('nav.back_data_quality') }}</router-link><h1>{{ $t('openfigi_d_q.title') }}</h1><p class="dq-sub">{{ $t('openfigi_d_q.subtitle') }}</p></div><ThemeToggle /></header>
    <div v-if="loading" class="dq-loading">{{ $t('app.loading_2') }}</div>
    <template v-else-if="data">
      <SourcePipelinePanel source-id="openfigi" />

      <div class="dq-stats">
        <PocketableChart
chart="stat" chart-key="figi_listings"
          :chart-props="{ value: data.total_listings.toLocaleString(), label: 'Listings' }" name="Listings" />
        <PocketableChart
chart="stat" chart-key="figi_companies_listed"
          :chart-props="{ value: (data.companies_with_listing ?? 0).toLocaleString(), label: 'Companies with a Listing' }" name="Companies with a Listing" />
        <PocketableChart
chart="stat" chart-key="figi_funds"
          :chart-props="{ value: (data.funds?.total ?? 0).toLocaleString(), label: 'Investment Funds' }" name="Investment Funds" />
        <PocketableChart
chart="stat" chart-key="figi_fund_units"
          :chart-props="{ value: (data.funds?.unit_listings ?? 0).toLocaleString(), label: 'Fund Unit Listings' }" name="Fund Unit Listings" />
      </div>

      <div class="dq-gauges">
        <PocketableChart
chart="gauge" chart-key="figi_sectype_coverage"
          :chart-props="{ value: secTypePct, label: 'security_type Coverage' }" name="security_type Coverage" />
      </div>

      <div v-if="!dualLabelOk" class="dq-section">
        <div class="dq-alert">⚠ {{ data.funds.dual_label_violations }} nodes carry BOTH :Company and :InvestmentFund — the relabel invariant is broken, run dq-assert.</div>
      </div>

      <div v-if="secTypeBars.length" class="dq-section">
        <h2>{{ $t('openfigi_d_q.by_security_type') }}</h2>
        <PocketableChart chart="bars" chart-key="figi_by_sectype" :chart-props="{ items: secTypeBars }" name="Listings by security type" />
      </div>
      <div v-if="fundTypeBars.length" class="dq-section">
        <h2>{{ $t('openfigi_d_q.funds_by_type') }}</h2>
        <PocketableChart chart="bars" chart-key="figi_funds_by_type" :chart-props="{ items: fundTypeBars }" name="Funds by vehicle type" />
      </div>
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
.dq-section { margin-bottom: 2rem; }
.dq-section h2 { font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem; }
.dq-alert { background: color-mix(in srgb, var(--accent) 12%, transparent); border: 1px solid var(--accent); border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.9rem; }
</style>
