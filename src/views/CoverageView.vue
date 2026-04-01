<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

const data = ref(null)
const state = ref('loading')

onMounted(async () => {
  document.title = 'E2E Coverage Matrix — GMR'
  try {
    const res = await fetch('/coverage-matrix.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    data.value = await res.json()
    state.value = 'done'
  } catch {
    state.value = 'error'
  }
})

const categories = computed(() => {
  if (!data.value?.requirements) return []
  const cats = {}
  for (const r of data.value.requirements) {
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
        <h1>E2E Coverage Matrix</h1>
        <p class="cov-sub">Requirements mapped to Playwright end-to-end tests</p>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="state === 'loading'" class="cov-msg">Loading matrix...</div>
    <div v-else-if="state === 'error'" class="cov-msg">Failed to load coverage matrix.</div>

    <div v-else-if="data">
      <!-- Summary -->
      <div class="cov-summary">
        <div class="cov-stat">
          <span class="cov-stat__num" :style="{ color: data.summary.coverage_pct === 100 ? 'var(--green, #1a7f37)' : 'var(--accent)' }">
            {{ data.summary.coverage_pct }}%
          </span>
          <span class="cov-stat__label">Requirement Coverage</span>
        </div>
        <div class="cov-stat">
          <span class="cov-stat__num">{{ data.summary.covered_requirements }}/{{ data.summary.total_requirements }}</span>
          <span class="cov-stat__label">Requirements Covered</span>
        </div>
        <div class="cov-stat">
          <span class="cov-stat__num">{{ data.summary.mapped_tests }}/{{ data.summary.total_e2e_tests }}</span>
          <span class="cov-stat__label">Tests Mapped</span>
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

      <!-- Requirements table -->
      <h2>Requirements</h2>
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
            <tr v-for="r in data.requirements" :key="r.id">
              <td class="mono">{{ r.id }}</td>
              <td>{{ r.title }}</td>
              <td>{{ r.category }}</td>
              <td>
                <span :class="r.covered ? 'cov-badge--ok' : 'cov-badge--no'" class="cov-badge">
                  {{ r.covered ? 'Covered' : 'Uncovered' }}
                </span>
              </td>
              <td class="cov-tests">{{ r.tests.length }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Unmapped tests -->
      <div v-if="data.unmapped_tests.length">
        <h2>Unmapped Tests ({{ data.unmapped_tests.length }})</h2>
        <p class="cov-sub">These e2e tests exist but aren't mapped to any requirement yet.</p>
        <ul class="cov-unmapped">
          <li v-for="t in data.unmapped_tests" :key="t">{{ t }}</li>
        </ul>
      </div>

      <p class="cov-meta">Generated: {{ data.generated_at?.substring(0, 19) }}</p>
    </div>
  </div>
</template>

<style scoped>
.cov { max-width: 1100px; margin: 0 auto; padding: 0 1rem 4rem; }
.cov-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.cov-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0.3rem 0 0; }
.cov-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.cov-sub { font-size: 0.85rem; color: var(--muted); margin-top: 0.2rem; }
.cov-msg { text-align: center; padding: 4rem 1rem; color: var(--muted); }
h2 { font-size: 1rem; font-weight: 700; margin: 1.5rem 0 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }

.cov-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem; }
.cov-stat { padding: 0.75rem 1rem; background: var(--surface, #f6f8fa); border: 1px solid var(--border); border-radius: 8px; text-align: center; }
.cov-stat__num { display: block; font-size: 1.5rem; font-weight: 700; color: var(--accent); }
.cov-stat__label { font-size: 0.75rem; color: var(--muted); }

.cov-cats { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem; }
.cov-cat { display: flex; align-items: center; gap: 0.75rem; }
.cov-cat__name { width: 100px; font-size: 0.85rem; font-weight: 600; text-transform: capitalize; }
.cov-bar { flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
.cov-bar__fill { height: 100%; background: var(--green, #1a7f37); border-radius: 4px; }
.cov-cat__pct { font-size: 0.8rem; color: var(--muted); width: 40px; text-align: right; }

.cov-table-wrap { overflow-x: auto; }
.cov-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.cov-table th { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 2px solid var(--border); font-weight: 600; }
.cov-table td { padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--border); }
.mono { font-family: monospace; font-size: 0.8rem; }
.cov-tests { text-align: center; }

.cov-badge { font-size: 0.7rem; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 3px; }
.cov-badge--ok { background: var(--done-bg, #dafbe1); color: var(--done-text, #1a7f37); }
.cov-badge--no { background: #ffeef0; color: var(--red, #cf222e); }

.cov-unmapped { font-size: 0.8rem; color: var(--muted); padding-left: 1.5rem; }
.cov-unmapped li { margin: 0.2rem 0; }
.cov-meta { font-size: 0.75rem; color: var(--muted); margin-top: 2rem; text-align: right; }
</style>
