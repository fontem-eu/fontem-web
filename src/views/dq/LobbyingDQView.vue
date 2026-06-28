<script setup>
import { ref, onMounted, computed } from 'vue'
import SourcePipelinePanel from '../../components/SourcePipelinePanel.vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import PocketableChart from '../../components/charts/PocketableChart.vue'

onMounted(() => { document.title = 'Lobbying Data Quality — Fontem' })
const data = ref(null)
const loading = ref(true)
onMounted(async () => {
  try { const r = await fetch('/api/data-quality/lobbying'); if (r.ok) data.value = await r.json() } catch { /* */ }
  loading.value = false
})
const countryBars = computed(() => (data.value?.by_country || []).map(c => ({ label: c.country, value: c.count })))
const costBars = computed(() => (data.value?.cost_distribution || []).map(c => ({ label: c.bucket, value: c.count })))
const regTimeline = computed(() => data.value?.registrations_timeline || [])
const companyBars = computed(() => (data.value?.top_companies || []).map(c => ({ label: c.company, value: c.lobbyists })))
const categoryBars = computed(() => (data.value?.by_category || []).map(c => ({ label: c.category, value: c.count })))
const spenderBars = computed(() => (data.value?.top_spenders || []).map(s => ({ label: s.lobbyist, value: s.cost_max })))
</script>
<template>
  <div class="dq"><header class="dq-hdr"><div><router-link to="/data-quality" class="dq-back">{{ $t('nav.back_data_quality') }}</router-link><h1>{{ $t('lobbying_d_q.eu_lobbying_register') }}</h1><p class="dq-sub">{{ $t('lobbying_d_q.transparency_register_lobbyist_registrat') }}</p></div><ThemeToggle /></header>
    <div v-if="loading" class="dq-loading">{{ $t('app.loading_2') }}</div>
    <template v-else-if="data">
      <SourcePipelinePanel source-id="lobbying" />

      <div class="dq-stats">
        <PocketableChart
          chart="stat"
          chart-key="lobbying_total"
          :chart-props="{ value: data.total.toLocaleString(), label: 'Lobbyists' }"
          name="Lobbyists"
        />
        <PocketableChart
          chart="stat"
          chart-key="lobbying_ep_passes"
          :chart-props="{ value: data.with_ep_passes.toLocaleString(), label: 'EP Pass Holders' }"
          name="EP Pass Holders"
        />
        <PocketableChart
          chart="stat"
          chart-key="lobbying_matched"
          :chart-props="{ value: data.matched_to_company.toLocaleString(), label: 'Matched to Company' }"
          name="Matched to Company"
        />
      </div>
      <div class="dq-gauges">
        <PocketableChart
          chart="gauge"
          chart-key="lobbying_match_rate"
          :chart-props="{ value: data.match_rate, label: 'Company Match Rate' }"
          name="Company Match Rate"
        />
      </div>
      <section class="dq-section">
        <h2>{{ $t('lobbying_d_q.registrations_over_time') }}</h2>
        <PocketableChart
          chart="ts_bar"
          chart-key="lobbying_registrations_timeline"
          :chart-props="{ data: regTimeline, valueLabel: 'Registrations' }"
          :name="$t('lobbying_d_q.registrations_over_time')"
        />
      </section>
      <section class="dq-section">
        <h2>{{ $t('lobbying_d_q.top_countries') }}</h2>
        <PocketableChart
          chart="bar_h"
          chart-key="lobbying_by_country"
          :chart-props="{ data: countryBars }"
          :name="$t('lobbying_d_q.top_countries')"
        />
      </section>
      <section class="dq-section">
        <h2>{{ $t('lobbying_d_q.lobbying_cost_distribution') }}</h2>
        <PocketableChart
          chart="bar_h"
          chart-key="lobbying_cost_distribution"
          :chart-props="{ data: costBars, color: '#d97706' }"
          :name="$t('lobbying_d_q.lobbying_cost_distribution')"
        />
      </section>
      <section v-if="companyBars.length" class="dq-section">
        <h2>Most-represented companies</h2>
        <p class="dq-hint">Registrants resolved to a known company via the consolidator (Disclosure→FILED_BY→Company).</p>
        <PocketableChart
          chart="bar_h"
          chart-key="lobbying_top_companies"
          :chart-props="{ data: companyBars, maxBars: 20, color: '#0a66c2' }"
          name="Most-represented companies"
        />
      </section>
      <section v-if="categoryBars.length" class="dq-section">
        <h2>Registrant category mix</h2>
        <PocketableChart
          chart="bar_h"
          chart-key="lobbying_by_category"
          :chart-props="{ data: categoryBars, maxBars: 15, color: '#7c3aed' }"
          name="Registrant category mix"
        />
      </section>
      <section v-if="spenderBars.length" class="dq-section">
        <h2>Top declared spenders</h2>
        <p class="dq-hint">By declared annual lobbying-cost ceiling.</p>
        <PocketableChart
          chart="bar_h"
          chart-key="lobbying_top_spenders"
          :chart-props="{ data: spenderBars, maxBars: 20, format: 'eur', color: '#16a34a' }"
          name="Top declared spenders"
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
.dq-gauges { display: flex; gap: 2rem; justify-content: center; margin-bottom: 2rem; }
.dq-section { margin-bottom: 2rem; }
.dq-section h2 { font-size: 1rem; font-weight: 700; margin-bottom: 0.3rem; }
.dq-hint { font-size: 0.8rem; color: var(--muted); margin: 0 0 0.6rem; }
</style>
