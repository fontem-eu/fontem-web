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
const lags = ref([])
const jobs = ref([])
onMounted(async () => {
  const grab = async (url) => {
    try { const r = await fetch(url); return r.ok ? await r.json() : [] } catch { return [] }
  }
  const [l, j] = await Promise.all([
    grab('/api/data-quality/consumer-lag'),
    grab('/api/data-quality/etl-runs/by-cronjob?per_job=4'),
  ])
  lags.value = Array.isArray(l) ? l : []
  jobs.value = Array.isArray(j) ? j : []
})

const failing = computed(() => data.value?.failing || [])
const totals = computed(() => data.value?.summary || null)
const allGreen = computed(() => totals.value && failing.value.length === 0)

// A consumer is only "fine" at zero. Past that the number alone does not
// say whether it is slow or stopped, so the severity leans on how far
// behind it is and the row shows when it last committed.
const LAG_WARN = 1000
const LAG_BAD = 100000
function lagLevel(l) {
  if (!l.lag) return 'ok'
  return l.lag >= LAG_BAD ? 'bad' : (l.lag >= LAG_WARN ? 'warn' : 'ok')
}
function pct(l) {
  if (!l.head_seq) return 0
  return Math.min(100, Math.max(0, (l.last_seq / l.head_seq) * 100))
}

// A run left in 'running' long after it started did not finish — the
// process died without recording a terminal status, so the ledger shows
// neither success nor failure. Surfacing it as its own state is the
// whole point: it is invisible in every other view.
const STUCK_AFTER_MS = 6 * 3600 * 1000
function runState(run) {
  if (run.status !== 'running') return run.status
  const age = Date.now() - new Date(run.started_at).getTime()
  return age > STUCK_AFTER_MS ? 'stuck' : 'running'
}
function runTitle(run) {
  const when = String(run.started_at).slice(0, 16).replace('T', ' ')
  const state = runState(run)
  return `${state} · ${when}${run.summary ? ` · ${run.summary}` : ''}`
}
function jobLevel(job) {
  const states = job.runs.map(runState)
  if (states.includes('stuck')) return 'stuck'
  if (states[0] === 'failed') return 'bad'
  if (states.includes('failed')) return 'warn'
  return 'ok'
}
const sortedJobs = computed(() => {
  const rank = { stuck: 0, bad: 1, warn: 2, ok: 3 }
  return [...jobs.value].sort(
    (a, b) => rank[jobLevel(a)] - rank[jobLevel(b)]
      || a.cronjob_name.localeCompare(b.cronjob_name),
  )
})
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

      <div class="dq-section">
        <h2>{{ $t('assertion_monitor.consumers') }}</h2>
        <p class="dq-sub">{{ $t('assertion_monitor.consumers_sub') }}</p>
        <div v-if="!lags.length" class="dq-loading">{{ $t('assertion_monitor.no_consumers') }}</div>
        <div v-for="l in lags" :key="l.consumer_name" class="am-lag">
          <div class="am-lag-head">
            <strong>{{ l.consumer_name }}</strong>
            <span v-if="!l.lag" class="am-chip am-chip-ok">{{ $t('assertion_monitor.caught_up') }}</span>
            <span v-else :class="['am-num', `am-num-${lagLevel(l)}`]">
              {{ l.lag.toLocaleString() }} {{ $t('assertion_monitor.behind') }}
            </span>
            <span class="am-since">{{ String(l.updated_at || '').slice(0, 16).replace('T', ' ') }}</span>
          </div>
          <div class="am-bar" role="presentation">
            <div :class="['am-bar-fill', `am-bar-${lagLevel(l)}`]" :style="{ width: pct(l) + '%' }"></div>
          </div>
        </div>
      </div>

      <div class="dq-section">
        <h2>{{ $t('assertion_monitor.etl_runs') }}</h2>
        <p class="dq-sub">{{ $t('assertion_monitor.etl_runs_sub') }}</p>
        <div v-if="!sortedJobs.length" class="dq-loading">{{ $t('assertion_monitor.no_etl_runs') }}</div>
        <div v-for="job in sortedJobs" :key="job.cronjob_name" class="am-job">
          <span :class="['am-dot', `am-dot-${jobLevel(job)}`]" aria-hidden="true"></span>
          <span class="am-job-name">{{ job.cronjob_name }}</span>
          <span class="am-runs">
            <span
v-for="run in job.runs" :key="run.run_id"
                  :class="['am-run', `am-run-${runState(run)}`]" :title="runTitle(run)">{{ runState(run).slice(0, 1).toUpperCase() }}</span>
          </span>
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
.am-chip-ok { background: color-mix(in srgb, #2da44e 15%, transparent); color: #2da44e; }
.am-lag { border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 0.9rem; margin-bottom: 0.5rem; }
.am-lag-head { display: flex; gap: 0.6rem; align-items: baseline; flex-wrap: wrap; }
.am-num { font-variant-numeric: tabular-nums; font-size: 0.8rem; font-weight: 600; }
.am-num-ok { color: var(--muted); }
.am-num-warn { color: #bf8700; }
.am-num-bad { color: #cf222e; }
.am-bar { height: 4px; border-radius: 2px; background: var(--border); margin-top: 0.5rem; overflow: hidden; }
.am-bar-fill { height: 100%; }
.am-bar-ok { background: #2da44e; }
.am-bar-warn { background: #bf8700; }
.am-bar-bad { background: #cf222e; }
.am-job { display: flex; gap: 0.6rem; align-items: center; padding: 0.4rem 0; border-bottom: 1px solid var(--border); }
.am-job:last-child { border-bottom: 0; }
.am-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.am-dot-ok { background: #2da44e; }
.am-dot-warn { background: #bf8700; }
.am-dot-bad { background: #cf222e; }
.am-dot-stuck { background: #8250df; }
.am-job-name { font-size: 0.85rem; flex: 1 1 auto; }
.am-runs { display: flex; gap: 3px; }
.am-run { width: 18px; height: 18px; border-radius: 3px; font-size: 0.6rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center; color: #fff; cursor: default; }
.am-run-success { background: #2da44e; }
.am-run-failed { background: #cf222e; }
.am-run-running { background: #bf8700; }
.am-run-stuck { background: #8250df; }
</style>
