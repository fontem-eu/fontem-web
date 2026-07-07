<script setup>
import { ref, onMounted, computed } from 'vue'
import { getAssistUsage, getAssistUsageHistory } from '../api/community.js'
import PocketableChart from '../components/charts/PocketableChart.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const INPUT_COLOR = '#3b82f6'  // blue-500
const OUTPUT_COLOR = '#f59e0b' // amber-500

const loading = ref(true)
const error = ref(null)

const snapshot = ref(null)    // { tokens_1h, tokens_24h, tokens_7d }
const history = ref(null)     // { days, points: [{date, tokens_in, tokens_out}] }
const daysWindow = ref(30)

const series = computed(() => {
  if (!history.value || !history.value.points || history.value.points.length === 0) return []
  return [
    {
      name: t('a_i_usage.input_tokens'),
      color: INPUT_COLOR,
      data: history.value.points.map((p) => ({ date: p.date, value: p.tokens_in })),
    },
    {
      name: t('a_i_usage.output_tokens'),
      color: OUTPUT_COLOR,
      data: history.value.points.map((p) => ({ date: p.date, value: p.tokens_out })),
    },
  ]
})

const totalIn = computed(() => {
  if (!history.value?.points) return 0
  return history.value.points.reduce((s, p) => s + p.tokens_in, 0)
})

const totalOut = computed(() => {
  if (!history.value?.points) return 0
  return history.value.points.reduce((s, p) => s + p.tokens_out, 0)
})

async function load() {
  loading.value = true
  error.value = null
  try {
    const [snap, hist] = await Promise.all([
      getAssistUsage(),
      getAssistUsageHistory(daysWindow.value),
    ])
    snapshot.value = snap
    history.value = hist
  } catch (err) {
    error.value = err.message || 'Failed to load usage data'
  } finally {
    loading.value = false
  }
}

async function changeWindow(days) {
  daysWindow.value = days
  await load()
}

function fmt(n) {
  if (n == null) return '0'
  return n.toLocaleString()
}

onMounted(load)
</script>

<template>
  <main class="usage-page">
    <h2 class="usage-title">{{ $t('a_i_usage.ai_usage_metrics') }}</h2>

    <div v-if="loading" class="usage-loading">{{ $t('app.loading_2') }}</div>

    <div v-else-if="error" class="usage-error">{{ error }}</div>

    <template v-else>
      <!-- Rolling-window summary cards -->
      <div v-if="snapshot" class="usage-cards">
        <div class="usage-card">
          <div class="usage-card-label">{{ $t('a_i_usage.last_hour') }}</div>
          <div class="usage-card-value">{{ fmt(snapshot.tokens_1h) }}</div>
          <div class="usage-card-unit">tokens</div>
        </div>
        <div class="usage-card">
          <div class="usage-card-label">{{ $t('a_i_usage.last_24_h') }}</div>
          <div class="usage-card-value">{{ fmt(snapshot.tokens_24h) }}</div>
          <div class="usage-card-unit">tokens</div>
        </div>
        <div class="usage-card">
          <div class="usage-card-label">{{ $t('a_i_usage.last_7_days') }}</div>
          <div class="usage-card-value">{{ fmt(snapshot.tokens_7d) }}</div>
          <div class="usage-card-unit">tokens</div>
        </div>
      </div>

      <!-- Period selector -->
      <div class="usage-toolbar">
        <div class="usage-window-btns">
          <button
            v-for="w in [7, 30, 90]"
            :key="w"
            :class="['usage-window-btn', { active: daysWindow === w }]"
            @click="changeWindow(w)"
          >
            {{ w }}d
          </button>
        </div>
        <div class="usage-totals">
          <span class="usage-total-chip" :style="{ borderColor: INPUT_COLOR }">
            In: {{ fmt(totalIn) }}
          </span>
          <span class="usage-total-chip" :style="{ borderColor: OUTPUT_COLOR }">
            Out: {{ fmt(totalOut) }}
          </span>
        </div>
      </div>

      <!-- Line chart -->
      <div class="usage-chart-wrap">
        <PocketableChart
:savable="false"
          chart="ts_line"
          :chart-props="{ series: series, height: 360, valueLabel: 'Tokens', formatValue: fmt }"
          name="AI Usage Metrics"
        />
      </div>
    </template>
  </main>
</template>

<style scoped>
.usage-page {
  max-width: 72rem;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}
.usage-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 1.5rem;
}
.usage-loading,
.usage-error {
  text-align: center;
  padding: 3rem;
  color: var(--muted);
  font-size: 0.9rem;
}
.usage-error { color: #ef4444; }

/* Summary cards */
.usage-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.usage-card {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  text-align: center;
}
.usage-card-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin-bottom: 0.25rem;
}
.usage-card-value {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text);
}
.usage-card-unit {
  font-size: 0.7rem;
  color: var(--muted);
}

/* Toolbar */
.usage-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.usage-window-btns {
  display: flex;
  gap: 0.35rem;
}
.usage-window-btn {
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: none;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.usage-window-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}
.usage-window-btn.active {
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}
.usage-totals {
  display: flex;
  gap: 0.6rem;
  font-size: 0.78rem;
}
.usage-total-chip {
  padding: 0.2rem 0.55rem;
  border: 1px solid;
  border-radius: 4px;
  color: var(--text);
  font-weight: 500;
}

/* Chart */
.usage-chart-wrap {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  background: var(--surface);
}
</style>
