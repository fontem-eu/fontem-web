<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import PocketableChart from '../../components/charts/PocketableChart.vue'

onMounted(() => { document.title = 'Assertion Monitor — Fontem' })
const data = ref(null)
const loading = ref(true)
onMounted(async () => {
  try { const r = await fetch('/api/data-quality/assertions'); if (r.ok) data.value = await r.json() } catch { /* */ }
  loading.value = false
})
const failing = computed(() => data.value?.failing || [])
const totals = computed(() => data.value?.summary || null)
const allGreen = computed(() => totals.value && failing.value.length === 0)
function sinceLabel(f) {
  if (!f.failing_since) return '—'
  const days = Math.floor((Date.now() - new Date(f.failing_since)) / 86400000)
  return days === 0 ? new Date(f.failing_since).toISOString().slice(0, 16).replace('T', ' ') : `${days}d`
}
</script>
<template>
  <div class="dq"><header class="dq-hdr"><div><router-link to="/data-quality" class="dq-back">{{ $t('nav.back_data_quality') }}</router-link><h1>{{ $t('assertion_monitor.title') }}</h1><p class="dq-sub">{{ $t('assertion_monitor.subtitle') }}</p></div><ThemeToggle /></header>
    <div v-if="loading" class="dq-loading">{{ $t('app.loading_2') }}</div>
    <template v-else-if="data && data.run_at">
      <div class="dq-stats">
        <PocketableChart
chart="stat" chart-key="am_pass"
          :chart-props="{ value: (totals.pass || 0).toLocaleString(), label: 'Passing' }" name="Passing" />
        <PocketableChart
chart="stat" chart-key="am_warn"
          :chart-props="{ value: (totals.warn || 0).toLocaleString(), label: 'Warnings' }" name="Warnings" />
        <PocketableChart
chart="stat" chart-key="am_fail"
          :chart-props="{ value: ((totals.fail || 0) + (totals.error || 0)).toLocaleString(), label: 'Failing' }" name="Failing" />
      </div>
      <p class="dq-sub">{{ $t('assertion_monitor.refreshed') }}: {{ data.run_at }}</p>

      <div v-if="allGreen" class="dq-section"><div class="dq-alert dq-alert-ok">✓ {{ $t('assertion_monitor.all_green') }}</div></div>

      <div v-else class="dq-section">
        <h2>{{ $t('assertion_monitor.failing_now') }}</h2>
        <div v-for="f in failing" :key="f.id" class="am-row">
          <div class="am-head">
            <span :class="['am-chip', f.severity === 'block' ? 'am-chip-block' : 'am-chip-warn']">{{ f.severity }}</span>
            <span class="am-fam">{{ f.family }}</span>
            <strong>{{ f.title }}</strong>
            <span class="am-since">{{ $t('assertion_monitor.since') }} {{ sinceLabel(f) }}</span>
          </div>
          <p class="am-desc">{{ f.description }}</p>
          <code class="am-obs">{{ f.observed }}</code>
        </div>
      </div>
    </template>
    <div v-else class="dq-loading">{{ $t('assertion_monitor.no_runs') }}</div>
  </div>
</template>
<style scoped>
.dq { max-width: 900px; margin: 0 auto; padding: 0 1rem 4rem; }
.dq-hdr { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.dq-hdr h1 { font-size: 1.3rem; font-weight: 700; margin: 0.3rem 0 0; }
.dq-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.dq-sub { font-size: 0.82rem; color: var(--muted); margin-top: 0.15rem; }
.dq-loading { text-align: center; padding: 3rem; color: var(--muted); }
.dq-stats { display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
.dq-section { margin: 1.5rem 0; }
.dq-section h2 { font-size: 1rem; font-weight: 600; margin-bottom: 0.6rem; }
.dq-alert { padding: 0.6rem 0.9rem; border-radius: 6px; font-size: 0.85rem; border: 1px solid var(--border); }
.dq-alert-ok { background: color-mix(in srgb, #2da44e 10%, transparent); }
.am-row { border: 1px solid var(--border); border-radius: 8px; padding: 0.7rem 0.9rem; margin-bottom: 0.6rem; }
.am-head { display: flex; gap: 0.6rem; align-items: baseline; flex-wrap: wrap; }
.am-chip { font-size: 0.7rem; padding: 0.1rem 0.45rem; border-radius: 999px; text-transform: uppercase; font-weight: 700; }
.am-chip-block { background: color-mix(in srgb, #cf222e 15%, transparent); color: #cf222e; }
.am-chip-warn { background: color-mix(in srgb, #bf8700 15%, transparent); color: #bf8700; }
.am-fam { font-size: 0.75rem; color: var(--muted); }
.am-since { margin-left: auto; font-size: 0.75rem; color: var(--muted); }
.am-desc { font-size: 0.82rem; color: var(--muted); margin: 0.35rem 0; }
.am-obs { font-size: 0.75rem; }
</style>
