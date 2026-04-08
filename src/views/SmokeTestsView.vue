<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

onMounted(() => { document.title = 'Smoke Tests — GMR Admin' })

const plan = ref(null)
const loading = ref(true)
const error = ref(null)
const filter = ref('all')

async function loadPlan() {
  try {
    const resp = await fetch('/admin/smoke-tests/plan.json')
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    plan.value = await resp.json()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(loadPlan)

const categories = computed(() => {
  if (!plan.value) return []
  const cats = [...new Set(plan.value.flows.map(f => f.category))]
  return cats.map(cat => ({
    name: cat,
    flows: plan.value.flows.filter(f => f.category === cat),
  }))
})

const filtered = computed(() => {
  if (filter.value === 'all') return categories.value
  return categories.value
    .map(c => ({
      ...c,
      flows: c.flows.filter(f => f.type === filter.value),
    }))
    .filter(c => c.flows.length > 0)
})

const stats = computed(() => {
  if (!plan.value) return {}
  const flows = plan.value.flows
  return {
    total: flows.length,
    ui: flows.filter(f => f.type === 'ui').length,
    api: flows.filter(f => f.type === 'api').length,
    critical: flows.filter(f => f.critical).length,
  }
})

function typeBadge(type) {
  return type === 'ui' ? 'st-badge--ui' : 'st-badge--api'
}
</script>

<template>
  <div class="st">
    <header class="st-header">
      <div>
        <router-link to="/admin" class="st-back">&larr; Admin</router-link>
        <h1>Production Smoke Tests</h1>
        <p class="st-sub">{{ plan?.description || 'Loading...' }}</p>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="loading" class="st-loading">Loading test plan...</div>
    <div v-else-if="error" class="st-error">Failed to load test plan: {{ error }}</div>

    <template v-else>
      <!-- Stats bar -->
      <div class="st-stats">
        <div class="st-stat">
          <span class="st-stat-num">{{ stats.total }}</span>
          <span class="st-stat-label">Total Flows</span>
        </div>
        <div class="st-stat">
          <span class="st-stat-num">{{ stats.ui }}</span>
          <span class="st-stat-label">UI Tests</span>
        </div>
        <div class="st-stat">
          <span class="st-stat-num">{{ stats.api }}</span>
          <span class="st-stat-label">API Tests</span>
        </div>
        <div class="st-stat">
          <span class="st-stat-num">{{ stats.critical }}</span>
          <span class="st-stat-label">Critical</span>
        </div>
      </div>

      <!-- Schedule info -->
      <div class="st-schedule">
        <strong>Schedule:</strong> {{ plan.schedule }} (every 8 hours)
        &middot;
        <strong>Target:</strong> <a :href="plan.target" target="_blank">{{ plan.target }}</a>
      </div>

      <!-- Filter -->
      <div class="st-filter">
        <button :class="{ active: filter === 'all' }" @click="filter = 'all'">All</button>
        <button :class="{ active: filter === 'ui' }" @click="filter = 'ui'">UI</button>
        <button :class="{ active: filter === 'api' }" @click="filter = 'api'">API</button>
      </div>

      <!-- Test flows by category -->
      <div v-for="cat in filtered" :key="cat.name" class="st-category">
        <h2>{{ cat.name }}</h2>
        <div v-for="flow in cat.flows" :key="flow.id" class="st-flow">
          <div class="st-flow-header">
            <span class="st-flow-id">{{ flow.id }}</span>
            <span :class="['st-badge', typeBadge(flow.type)]">{{ flow.type.toUpperCase() }}</span>
            <span v-if="flow.critical" class="st-badge st-badge--critical">CRITICAL</span>
            <strong>{{ flow.title }}</strong>
          </div>
          <p class="st-flow-desc">{{ flow.description }}</p>
          <ol class="st-steps">
            <li v-for="(step, i) in flow.steps" :key="i">{{ step }}</li>
          </ol>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.st { max-width: 900px; margin: 0 auto; padding: 0 1rem 4rem; }
.st-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.st-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0.3rem 0 0; }
.st-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.st-sub { font-size: 0.85rem; color: var(--muted); margin-top: 0.2rem; }

.st-loading, .st-error { text-align: center; padding: 3rem; color: var(--muted); }
.st-error { color: #e74c3c; }

.st-stats { display: flex; gap: 1.5rem; margin-bottom: 1.5rem; }
.st-stat { text-align: center; }
.st-stat-num { display: block; font-size: 1.6rem; font-weight: 700; color: var(--accent); }
.st-stat-label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }

.st-schedule { font-size: 0.85rem; color: var(--muted); margin-bottom: 1rem; padding: 0.75rem; background: var(--surface, #f6f8fa); border-radius: 8px; border: 1px solid var(--border); }
.st-schedule a { color: var(--accent); }

.st-filter { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
.st-filter button { padding: 0.35rem 0.75rem; border: 1px solid var(--border); border-radius: 6px; background: var(--surface, #f6f8fa); color: var(--fg); cursor: pointer; font-size: 0.8rem; }
.st-filter button.active { background: var(--accent); color: #fff; border-color: var(--accent); }

.st-category h2 { font-size: 1.1rem; font-weight: 700; margin: 1.5rem 0 0.75rem; padding-bottom: 0.4rem; border-bottom: 1px solid var(--border); }

.st-flow { padding: 1rem; margin-bottom: 0.75rem; background: var(--surface, #f6f8fa); border: 1px solid var(--border); border-radius: 8px; }
.st-flow-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; flex-wrap: wrap; }
.st-flow-id { font-family: monospace; font-size: 0.8rem; color: var(--muted); min-width: 80px; }
.st-flow-desc { font-size: 0.85rem; color: var(--muted); margin: 0 0 0.5rem; }

.st-badge { font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 700; letter-spacing: 0.03em; }
.st-badge--ui { background: #dbeafe; color: #1d4ed8; }
.st-badge--api { background: #d1fae5; color: #065f46; }
.st-badge--critical { background: #fee2e2; color: #991b1b; }

:root[data-theme="dark"] .st-badge--ui { background: #1e3a5f; color: #93c5fd; }
:root[data-theme="dark"] .st-badge--api { background: #064e3b; color: #6ee7b7; }
:root[data-theme="dark"] .st-badge--critical { background: #7f1d1d; color: #fca5a5; }

.st-steps { margin: 0; padding-left: 1.5rem; font-size: 0.82rem; color: var(--fg); }
.st-steps li { margin-bottom: 0.2rem; }
</style>
