<script setup>
import { ref, computed, onMounted } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import StatCard from '../../components/charts/StatCard.vue'
import { fetchEtlRuns } from '../../api/atlas.js'

onMounted(() => {
  document.title = 'ETL Runs — Fontem Data Quality'
})

const loading = ref(true)
const error = ref(null)
const runs = ref([])
const statusFilter = ref('') // '' | 'running' | 'success' | 'failed'

async function load() {
  loading.value = true
  error.value = null
  try {
    const data = await fetchEtlRuns({
      status: statusFilter.value || undefined,
      limit: 100,
    })
    runs.value = Array.isArray(data) ? data : []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ── Derived stats ────────────────────────────────────────────────
// "Crashed" = status='running' AND started_at older than 6 hours.
// The longest activeDeadlineSeconds in the chart is 4h (GLEIF), so
// 6h is a safe upper bound — anything older than that without a
// finished_at means the pod died before RunLog.__exit__ could fire
// (SIGKILL, OOM, node eviction). The dashboard surfaces these
// distinct from "in progress" so an operator can spot the
// difference at a glance.
const SIX_HOURS_MS = 6 * 60 * 60 * 1000

function isCrashed(run) {
  if (run.status !== 'running') return false
  const started = new Date(run.started_at).getTime()
  return Number.isFinite(started) && (Date.now() - started) > SIX_HOURS_MS
}

const stats = computed(() => {
  const t = { total: runs.value.length, success: 0, failed: 0, running: 0, crashed: 0 }
  for (const r of runs.value) {
    if (isCrashed(r)) t.crashed++
    else if (r.status === 'running') t.running++
    else if (r.status === 'success') t.success++
    else if (r.status === 'failed') t.failed++
  }
  return t
})

function fmtDuration(run) {
  if (!run.finished_at) return run.status === 'running' ? '…' : '—'
  const ms = new Date(run.finished_at) - new Date(run.started_at)
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${ms} ms`
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec} s`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min`
  return `${(min / 60).toFixed(1)} h`
}

function fmtStarted(run) {
  const d = new Date(run.started_at)
  if (Number.isNaN(d.getTime())) return run.started_at || ''
  return d.toISOString().slice(0, 16).replace('T', ' ')
}

function rowStatus(run) {
  if (isCrashed(run)) return 'crashed'
  return run.status
}
</script>

<template>
  <div class="dq">
    <header class="dq-hdr">
      <div>
        <router-link to="/data-quality" class="dq-back">&larr; Data Quality</router-link>
        <h1>{{ $t('etl_runs_d_q.etl_runs') }}</h1>
        <p class="dq-sub">{{ $t('etl_runs_d_q.recent_cronjob_invocations_from') }}<code>events.etl_run</code>. Replaces the legacy Uptime-Kuma pings; one row per loader run.</p>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="loading" class="dq-loading">{{ $t('app.loading_2') }}</div>
    <div v-else-if="error" class="dq-error">Failed to load: {{ error }}</div>
    <template v-else>
      <div class="dq-stats">
        <StatCard :value="stats.total.toLocaleString()" label="Runs (last 100)" />
        <StatCard :value="stats.success.toLocaleString()" label="Successful" />
        <StatCard :value="stats.failed.toLocaleString()" label="Failed" />
        <StatCard :value="stats.running.toLocaleString()" label="In progress" />
        <StatCard :value="stats.crashed.toLocaleString()" label="Crashed (running >6h)" />
      </div>

      <div class="dq-filters">
        <label>{{ $t('etl_runs_d_q.status') }}<select v-model="statusFilter" @change="load">
            <option value="">{{ $t('app.all') }}</option>
            <option value="success">{{ $t('etl_runs_d_q.success') }}</option>
            <option value="failed">{{ $t('etl_runs_d_q.failed') }}</option>
            <option value="running">{{ $t('etl_runs_d_q.running') }}</option>
          </select>
        </label>
        <button class="dq-refresh" @click="load">{{ $t('etl_runs_d_q.refresh') }}</button>
      </div>

      <section class="dq-section">
        <h2>{{ $t('etl_runs_d_q.recent_runs') }}</h2>
        <div v-if="runs.length === 0" class="dq-empty">
          No runs recorded yet. ETL CronJobs are still suspended, or the
          events.etl_run table hasn't been bootstrapped — check the
          gitops infra bootstrap job.
        </div>
        <table v-else class="dq-table">
          <thead>
            <tr>
              <th>{{ $t('etl_runs_d_q.cronjob') }}</th>
              <th>{{ $t('etl_runs_d_q.started') }}</th>
              <th>{{ $t('etl_runs_d_q.duration') }}</th>
              <th>{{ $t('etl_runs_d_q.status_2') }}</th>
              <th>{{ $t('app.image') }}</th>
              <th>{{ $t('etl_runs_d_q.summary') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in runs"
              :key="r.run_id"
              :class="['row', `row-${rowStatus(r)}`]"
            >
              <td class="mono">{{ r.cronjob_name }}</td>
              <td class="mono">{{ fmtStarted(r) }}</td>
              <td>{{ fmtDuration(r) }}</td>
              <td>
                <span :class="['pill', `pill-${rowStatus(r)}`]">{{ rowStatus(r) }}</span>
              </td>
              <td class="mono">{{ r.image_tag || '—' }}</td>
              <td class="summary">
                <template v-if="r.status === 'failed' && r.error_message">
                  <details>
                    <summary class="err">{{ r.error_message.split('\n').pop().slice(0, 100) }}</summary>
                    <pre>{{ r.error_message }}</pre>
                  </details>
                </template>
                <template v-else>{{ r.summary || '—' }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dq { max-width: 1100px; margin: 0 auto; padding: 0 1rem 4rem; }
.dq-hdr { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.dq-hdr h1 { font-size: 1.3rem; font-weight: 700; margin: 0.3rem 0 0; }
.dq-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.dq-sub { font-size: 0.82rem; color: var(--muted); margin-top: 0.15rem; }
.dq-loading, .dq-empty, .dq-error { text-align: center; padding: 3rem; color: var(--muted); }
.dq-error { color: var(--danger, #c44); }
.dq-stats { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.dq-filters { display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; font-size: 0.85rem; }
.dq-filters select { padding: 0.3rem 0.5rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg); color: var(--fg); }
.dq-refresh { padding: 0.3rem 0.8rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg); color: var(--fg); cursor: pointer; }
.dq-refresh:hover { background: var(--bg-hover, var(--border)); }
.dq-section { margin-bottom: 2rem; }
.dq-section h2 { font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem; }
.dq-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.dq-table th, .dq-table td { padding: 0.5rem 0.6rem; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
.dq-table th { font-weight: 600; color: var(--muted); }
.mono { font-family: monospace; }
.summary { max-width: 28rem; overflow-wrap: anywhere; }
.summary pre { background: var(--bg-code, rgba(0,0,0,.04)); padding: 0.5rem; border-radius: 4px; font-size: 0.75rem; white-space: pre-wrap; margin: 0.4rem 0 0; }
.summary details summary { cursor: pointer; }
.err { color: var(--danger, #c44); }
.pill { display: inline-block; padding: 0.1rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
.pill-success { background: rgba(34,139,34,.15); color: #1f7a1f; }
.pill-failed  { background: rgba(204,68,68,.15); color: #c44; }
.pill-running { background: rgba(70,130,180,.15); color: #46658b; }
.pill-crashed { background: rgba(204,68,68,.25); color: #a22; }
.row-failed td { background: rgba(204,68,68,.04); }
.row-crashed td { background: rgba(204,68,68,.07); }
</style>
