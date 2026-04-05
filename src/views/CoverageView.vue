<script setup>
import { ref, onMounted, computed } from 'vue'

const data = ref(null)
const state = ref('loading')

onMounted(async () => {
  document.title = 'Test Coverage Matrix — GMR'
  try {
    const res = await fetch('/coverage-matrix.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    data.value = await res.json()
    state.value = 'done'
  } catch {
    state.value = 'error'
  }
})

/* Flatten all requirements from sections for category stats */
const allReqs = computed(() => {
  if (!data.value?.sections) return []
  return data.value.sections.flatMap((s) => s.requirements)
})

const categories = computed(() => {
  const cats = {}
  for (const r of allReqs.value) {
    if (!cats[r.category]) cats[r.category] = { covered: 0, total: 0 }
    cats[r.category].total++
    if (r.covered) cats[r.category].covered++
  }
  return Object.entries(cats).map(([name, stats]) => ({
    name,
    ...stats,
    pct: Math.round((stats.covered / stats.total) * 100),
  }))
})
</script>

<template>
  <div class="cov">
    <header class="cov-header">
      <div>
        <router-link to="/admin" class="cov-back">&larr; Admin</router-link>
        <h1>Test Coverage Matrix</h1>
        <p class="cov-sub">Requirements mapped to unit, integration, and e2e tests across all repos</p>
      </div>
    </header>

    <div v-if="state === 'loading'" class="cov-msg">Loading matrix...</div>
    <div v-else-if="state === 'error'" class="cov-msg">Failed to load coverage matrix.</div>

    <div v-else-if="data">
      <!-- Summary -->
      <div class="cov-summary">
        <div class="cov-stat">
          <span class="cov-stat__num" :style="{ color: data.summary.coverage_pct === 100 ? '#1a7f37' : 'var(--accent)' }">
            {{ data.summary.coverage_pct }}%
          </span>
          <span class="cov-stat__label">Requirement Coverage</span>
        </div>
        <div class="cov-stat">
          <span class="cov-stat__num">{{ data.summary.covered_requirements }}/{{ data.summary.total_requirements }}</span>
          <span class="cov-stat__label">Requirements Covered</span>
        </div>
        <div class="cov-stat">
          <span class="cov-stat__num">{{ data.summary.total_unit_tests }}</span>
          <span class="cov-stat__label">Frontend Unit Tests</span>
        </div>
        <div class="cov-stat">
          <span class="cov-stat__num">{{ data.summary.total_e2e_tests }}</span>
          <span class="cov-stat__label">E2E Tests</span>
        </div>
        <div class="cov-stat">
          <span class="cov-stat__num">{{ data.summary.total_backend_tests }}</span>
          <span class="cov-stat__label">Backend Tests</span>
        </div>
      </div>

      <!-- Repo breakdown -->
      <div v-if="data.summary.repos" class="cov-repos">
        <div v-for="(counts, repo) in data.summary.repos" :key="repo" class="cov-repo">
          <span class="cov-repo__name">{{ repo }}</span>
          <span v-for="(count, kind) in counts" :key="kind" class="cov-repo__badge">
            {{ count }} {{ kind }}
          </span>
        </div>
      </div>

      <!-- Category breakdown -->
      <h2>Coverage by Category</h2>
      <div class="cov-cats">
        <div v-for="cat in categories" :key="cat.name" class="cov-cat">
          <span class="cov-cat__name">{{ cat.name }}</span>
          <div class="cov-bar">
            <div class="cov-bar__fill" :style="{ width: cat.pct + '%' }"></div>
          </div>
          <span class="cov-cat__pct">{{ cat.covered }}/{{ cat.total }}</span>
        </div>
      </div>

      <!-- Sections with requirements -->
      <div v-for="section in data.sections" :key="section.name" class="cov-section">
        <h2>{{ section.name }}</h2>
        <p v-if="section.description" class="cov-sub">{{ section.description }}</p>

        <div class="cov-table-wrap">
          <table class="cov-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Requirement</th>
                <th>Category</th>
                <th>Status</th>
                <th>Tests</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in section.requirements" :key="r.id">
                <td class="mono">{{ r.id }}</td>
                <td>{{ r.title }}</td>
                <td>{{ r.category }}</td>
                <td>
                  <span :class="r.covered ? 'cov-badge--ok' : 'cov-badge--no'" class="cov-badge">
                    {{ r.covered ? 'Covered' : 'Gap' }}
                  </span>
                </td>
                <td class="cov-tests">{{ r.tests.length }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p class="cov-meta">Generated: {{ data.generated_at?.substring(0, 19) }}</p>
    </div>
  </div>
</template>

<style scoped>
.cov { max-width: 1100px; margin: 0 auto; padding: 0 1rem 4rem; }
.cov-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.cov-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0.3rem 0 0; color: var(--text); }
.cov-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.cov-sub { font-size: 0.82rem; color: var(--muted); margin-top: 0.2rem; }
.cov-msg { text-align: center; padding: 4rem 1rem; color: var(--muted); }
h2 { font-size: 0.9rem; font-weight: 700; margin: 2rem 0 0.5rem; color: var(--text); text-transform: uppercase; letter-spacing: 0.04em; }

.cov-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem; }
.cov-stat { padding: 0.75rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 4px; text-align: center; }
.cov-stat__num { display: block; font-size: 1.4rem; font-weight: 700; color: var(--accent); }
.cov-stat__label { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }

.cov-repos { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.5rem; }
.cov-repo { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; }
.cov-repo__name { font-weight: 600; color: var(--text); }
.cov-repo__badge { padding: 0.15rem 0.4rem; background: var(--surface); border: 1px solid var(--border); border-radius: 3px; font-size: 0.7rem; color: var(--muted); }

.cov-cats { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.5rem; }
.cov-cat { display: flex; align-items: center; gap: 0.75rem; }
.cov-cat__name { width: 110px; font-size: 0.8rem; font-weight: 600; text-transform: capitalize; color: var(--text); }
.cov-bar { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
.cov-bar__fill { height: 100%; background: #1a7f37; border-radius: 3px; }
.cov-cat__pct { font-size: 0.75rem; color: var(--muted); width: 40px; text-align: right; }

.cov-section { margin-bottom: 0.5rem; }

.cov-table-wrap { overflow-x: auto; }
.cov-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.cov-table th { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 2px solid var(--border); font-weight: 600; color: var(--muted); font-size: 0.7rem; text-transform: uppercase; }
.cov-table td { padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--border); color: var(--text); }
.mono { font-family: monospace; font-size: 0.75rem; color: var(--muted); }
.cov-tests { text-align: center; }

.cov-badge { font-size: 0.65rem; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 3px; }
.cov-badge--ok { background: #d1fae5; color: #065f46; }
.cov-badge--no { background: #fee2e2; color: #991b1b; }

.cov-meta { font-size: 0.7rem; color: var(--muted); margin-top: 2rem; text-align: right; }
</style>
