<script setup>
import { ref, onMounted } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

const state = ref('loading')
const candidates = ref([])
const selected = ref(null)
const resolving = ref(false)
const message = ref('')

onMounted(async () => {
  document.title = 'Entity Resolution — GMR'
  await loadCandidates()
})

async function loadCandidates() {
  state.value = 'loading'
  try {
    const res = await fetch('/api/entity-resolution/candidates?limit=100')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    candidates.value = data.candidates
    state.value = candidates.value.length > 0 ? 'done' : 'empty'
    if (!selected.value && candidates.value.length > 0) {
      selected.value = candidates.value[0]
    }
  } catch {
    state.value = 'error'
  }
}

async function resolve(action) {
  if (!selected.value) return
  resolving.value = true
  message.value = ''
  try {
    const { dup_id, canonical_id } = selected.value
    const res = await fetch(
      `/api/entity-resolution/resolve/${encodeURIComponent(dup_id)}/${encodeURIComponent(canonical_id)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, canonical_gmr_id: canonical_id }),
      },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await res.json()
    message.value = action === 'approve'
      ? `Merged into ${canonical_id.substring(0, 8)}...`
      : 'Rejected — marked as different entities'
    // Remove from list and select next
    candidates.value = candidates.value.filter(
      (c) => c.dup_id !== dup_id || c.canonical_id !== canonical_id,
    )
    selected.value = candidates.value.length > 0 ? candidates.value[0] : null
    if (candidates.value.length === 0) state.value = 'empty'
  } catch (e) {
    message.value = `Error: ${e.message}`
  } finally {
    resolving.value = false
  }
}

function propDiff(left, right, key) {
  const l = left?.[key] ?? null
  const r = right?.[key] ?? null
  if (l === r) return 'same'
  if (l === null) return 'right-only'
  if (r === null) return 'left-only'
  return 'conflict'
}

const FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'country', label: 'Country' },
  { key: 'lei', label: 'LEI' },
  { key: 'vat', label: 'VAT' },
]

function leftField(key) { return selected.value?.[`dup_${key}`] ?? '—' }
function rightField(key) { return selected.value?.[`canonical_${key}`] ?? '—' }
function mergedField(key) {
  const l = selected.value?.[`dup_${key}`]
  const r = selected.value?.[`canonical_${key}`]
  return r ?? l ?? '—'
}
</script>

<template>
  <div class="er">
    <header class="er-header">
      <div>
        <router-link to="/" class="er-back">&larr; Home</router-link>
        <h1>Entity Resolution</h1>
        <p class="er-subtitle">Review and merge duplicate company nodes</p>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="state === 'loading'" class="er-msg">Loading candidates...</div>
    <div v-else-if="state === 'error'" class="er-msg">Failed to load candidates.</div>
    <div v-else-if="state === 'empty'" class="er-msg">
      <p>No merge candidates pending review.</p>
      <p class="er-note">All entity conflicts have been resolved. New candidates appear after data loads.</p>
    </div>

    <div v-else class="er-layout">
      <!-- Left: candidate list -->
      <aside class="er-list">
        <h2>Candidates ({{ candidates.length }})</h2>
        <div
          v-for="c in candidates"
          :key="c.dup_id + c.canonical_id"
          class="er-list__item"
          :class="{ 'er-list__item--active': selected === c }"
          @click="selected = c"
        >
          <div class="er-list__names">
            <span>{{ c.dup_name || c.dup_id.substring(0, 8) }}</span>
            <span class="er-list__arrow">&harr;</span>
            <span>{{ c.canonical_name || c.canonical_id.substring(0, 8) }}</span>
          </div>
          <div class="er-list__meta">
            {{ c.method || 'auto' }} &middot; {{ (c.confidence * 100).toFixed(0) }}%
          </div>
        </div>
      </aside>

      <!-- Right: merge view -->
      <main v-if="selected" class="er-merge">
        <!-- Three-panel merge view -->
        <div class="er-panels">
          <!-- Left: duplicate -->
          <div class="er-panel er-panel--left">
            <h3>Duplicate (will be removed)</h3>
            <div v-for="f in FIELDS" :key="f.key" class="er-field" :class="'er-field--' + propDiff(selected, null, f.key)">
              <span class="er-field__label">{{ f.label }}</span>
              <span class="er-field__value">{{ leftField(f.key) }}</span>
            </div>
            <div class="er-field">
              <span class="er-field__label">gmr_id</span>
              <span class="er-field__value er-mono">{{ selected.dup_id.substring(0, 12) }}...</span>
            </div>
          </div>

          <!-- Center: merged result -->
          <div class="er-panel er-panel--center">
            <h3>Merge Result</h3>
            <div v-for="f in FIELDS" :key="f.key" class="er-field" :class="'er-field--' + propDiff({[`dup_${f.key}`]: leftField(f.key)}, {[`canonical_${f.key}`]: rightField(f.key)}, '')">
              <span class="er-field__label">{{ f.label }}</span>
              <span class="er-field__value" :class="{'er-conflict': propDiff(selected, selected, f.key) === 'conflict'}">
                {{ mergedField(f.key) }}
              </span>
            </div>
            <div class="er-field">
              <span class="er-field__label">gmr_id</span>
              <span class="er-field__value er-mono">{{ selected.canonical_id.substring(0, 12) }}... (canonical wins)</span>
            </div>
          </div>

          <!-- Right: canonical -->
          <div class="er-panel er-panel--right">
            <h3>Canonical (will survive)</h3>
            <div v-for="f in FIELDS" :key="f.key" class="er-field">
              <span class="er-field__label">{{ f.label }}</span>
              <span class="er-field__value">{{ rightField(f.key) }}</span>
            </div>
            <div class="er-field">
              <span class="er-field__label">gmr_id</span>
              <span class="er-field__value er-mono">{{ selected.canonical_id.substring(0, 12) }}...</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="er-actions">
          <button class="er-btn er-btn--approve" :disabled="resolving" @click="resolve('approve')">
            Merge (canonical wins)
          </button>
          <button class="er-btn er-btn--reject" :disabled="resolving" @click="resolve('reject')">
            Not the same entity
          </button>
          <span v-if="message" class="er-message">{{ message }}</span>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.er { max-width: 1200px; margin: 0 auto; padding: 0 1rem 4rem; }

.er-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border);
  margin-bottom: 1.5rem;
}
.er-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0.3rem 0 0; }
.er-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.er-back:hover { text-decoration: underline; }
.er-subtitle { font-size: 0.85rem; color: var(--muted); margin-top: 0.2rem; }
.er-msg { text-align: center; padding: 4rem 1rem; color: var(--muted); }
.er-note { font-size: 0.85rem; margin-top: 0.5rem; opacity: 0.7; }

.er-layout { display: grid; grid-template-columns: 280px 1fr; gap: 1.25rem; }
@media (max-width: 768px) { .er-layout { grid-template-columns: 1fr; } }

/* ── Candidate list ── */
.er-list h2 { font-size: 0.85rem; font-weight: 700; color: var(--muted); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
.er-list__item {
  padding: 0.6rem 0.75rem; border: 1px solid var(--border);
  border-radius: 6px; margin-bottom: 0.4rem; cursor: pointer;
  transition: border-color 0.15s;
}
.er-list__item:hover { border-color: var(--accent); }
.er-list__item--active { border-color: var(--accent); background: var(--surface); }
.er-list__names { font-size: 0.82rem; font-weight: 600; display: flex; gap: 0.3rem; align-items: center; flex-wrap: wrap; }
.er-list__arrow { color: var(--muted); font-size: 0.75rem; }
.er-list__meta { font-size: 0.7rem; color: var(--muted); margin-top: 0.2rem; }

/* ── Three-panel merge view ── */
.er-panels { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; }
@media (max-width: 768px) { .er-panels { grid-template-columns: 1fr; } }

.er-panel {
  border: 1px solid var(--border); border-radius: 8px;
  padding: 0.75rem; background: var(--bg);
}
.er-panel--left { border-top: 3px solid var(--warning, #d29922); }
.er-panel--center { border-top: 3px solid var(--accent); }
.er-panel--right { border-top: 3px solid var(--success, #1a7f37); }

.er-panel h3 {
  font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--muted); margin-bottom: 0.6rem;
}

.er-field {
  display: flex; justify-content: space-between;
  padding: 0.3rem 0; border-bottom: 1px solid var(--border);
  font-size: 0.82rem;
}
.er-field:last-child { border-bottom: none; }
.er-field__label { color: var(--muted); font-size: 0.75rem; }
.er-field__value { font-weight: 500; text-align: right; max-width: 60%; word-break: break-all; }
.er-conflict { color: var(--warning, #d29922); font-weight: 700; }
.er-mono { font-family: monospace; font-size: 0.75rem; }

/* ── Actions ── */
.er-actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
.er-btn {
  padding: 0.5rem 1.25rem; border: none; border-radius: 6px;
  font-size: 0.85rem; font-weight: 600; cursor: pointer;
}
.er-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.er-btn--approve { background: var(--success, #1a7f37); color: #fff; }
.er-btn--approve:hover:not(:disabled) { opacity: 0.9; }
.er-btn--reject { background: var(--border); color: var(--text); }
.er-btn--reject:hover:not(:disabled) { opacity: 0.8; }
.er-message { font-size: 0.82rem; color: var(--muted); }
</style>
