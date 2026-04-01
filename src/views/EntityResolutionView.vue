<script setup>
import { ref, onMounted, watch } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

const state = ref('loading')
const candidates = ref([])
const selected = ref(null)
const resolving = ref(false)
const message = ref('')
const validationErrors = ref([])

// Editable merged fields (vat is a list)
const merged = ref({ name: '', country: '', lei: '', vat: [] })

const FIELDS = [
  { key: 'name', label: 'Name', placeholder: 'Company legal name' },
  { key: 'country', label: 'Country', placeholder: 'ISO alpha-3 (e.g. FRA)' },
  { key: 'lei', label: 'LEI', placeholder: '20-char alphanumeric (optional)' },
]
// VAT is handled separately — it's a list, not a string
const newVat = ref('')

onMounted(async () => {
  document.title = 'Entity Resolution — GMR'
  await loadCandidates()
})

// When selection changes, populate the editable merged fields
watch(selected, (sel) => {
  if (!sel) return
  // Merge VAT lists from both sides, deduplicate
  const dupVats = Array.isArray(sel.dup_vat) ? sel.dup_vat : (sel.dup_vat ? [sel.dup_vat] : [])
  const canVats = Array.isArray(sel.canonical_vat) ? sel.canonical_vat : (sel.canonical_vat ? [sel.canonical_vat] : [])
  const allVats = [...new Set([...canVats, ...dupVats].filter(Boolean))]
  merged.value = {
    name: sel.canonical_name ?? sel.dup_name ?? '',
    country: sel.canonical_country ?? sel.dup_country ?? '',
    lei: sel.canonical_lei ?? sel.dup_lei ?? '',
    vat: allVats,
  }
  validationErrors.value = []
  message.value = ''
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

function validateLocally() {
  const errors = []
  const m = merged.value
  if (m.name.trim().length < 2) errors.push('Name must be at least 2 characters')
  if (m.country.trim().length !== 3) errors.push('Country must be a 3-letter ISO alpha-3 code')
  if (m.lei.trim() && m.lei.trim().length !== 20) errors.push('LEI must be exactly 20 characters')
  if (m.lei.trim() && !/^[A-Z0-9]+$/i.test(m.lei.trim())) errors.push('LEI must be alphanumeric')
  for (const vat of m.vat) {
    if (vat.trim() && vat.trim().length < 4) errors.push(`VAT "${vat}" too short`)
  }
  return errors
}

async function resolve(action) {
  if (!selected.value) return
  resolving.value = true
  message.value = ''
  validationErrors.value = []

  if (action === 'approve') {
    const localErrors = validateLocally()
    if (localErrors.length) {
      validationErrors.value = localErrors
      resolving.value = false
      return
    }
  }

  try {
    const { dup_id, canonical_id } = selected.value
    const body = {
      action,
      canonical_gmr_id: canonical_id,
    }
    if (action === 'approve') {
      body.merged_properties = {
        name: merged.value.name.trim() || null,
        country: merged.value.country.trim().toUpperCase() || null,
        lei: merged.value.lei.trim() || null,
        vat: merged.value.vat.filter((v) => v.trim()),
      }
    }
    const res = await fetch(
      `/api/entity-resolution/resolve/${encodeURIComponent(dup_id)}/${encodeURIComponent(canonical_id)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    if (!res.ok) {
      const err = await res.json()
      if (err.detail?.validation_errors) {
        validationErrors.value = err.detail.validation_errors
        resolving.value = false
        return
      }
      throw new Error(`HTTP ${res.status}`)
    }
    await res.json()
    message.value = action === 'approve'
      ? `Merged into ${canonical_id.substring(0, 8)}...`
      : 'Rejected — marked as different entities'
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

function pickLeft(key) { merged.value[key] = selected.value?.[`dup_${key}`] ?? '' }
function pickRight(key) { merged.value[key] = selected.value?.[`canonical_${key}`] ?? '' }
function leftVal(key) { return selected.value?.[`dup_${key}`] ?? '' }
function rightVal(key) { return selected.value?.[`canonical_${key}`] ?? '' }
function isConflict(key) {
  const l = leftVal(key)
  const r = rightVal(key)
  return l && r && l !== r
}
function formatVatList(val) {
  if (Array.isArray(val)) return val.filter(Boolean)
  if (val) return [val]
  return []
}
function addVat() {
  const v = newVat.value.trim()
  if (v && !merged.value.vat.includes(v)) {
    merged.value.vat.push(v)
  }
  newVat.value = ''
}
function removeVat(i) { merged.value.vat.splice(i, 1) }
function addVatFromSide(side) {
  const vals = formatVatList(selected.value?.[`${side}_vat`])
  for (const v of vals) {
    if (v && !merged.value.vat.includes(v)) {
      merged.value.vat.push(v)
    }
  }
}
</script>

<template>
  <div class="er">
    <header class="er-header">
      <div>
        <router-link to="/admin" class="er-back">&larr; Admin</router-link>
        <h1>Entity Resolution</h1>
        <p class="er-subtitle">Review and merge duplicate company nodes</p>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="state === 'loading'" class="er-msg">Loading candidates...</div>
    <div v-else-if="state === 'error'" class="er-msg">Failed to load candidates.</div>
    <div v-else-if="state === 'empty'" class="er-msg">
      <p>No merge candidates pending review.</p>
      <p class="er-note">All entity conflicts have been resolved.</p>
    </div>

    <div v-else class="er-layout">
      <!-- Left sidebar: candidate list -->
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

      <!-- Main: three-panel merge view -->
      <main v-if="selected" class="er-merge">
        <div class="er-panels">
          <!-- Left: duplicate (read-only) -->
          <div class="er-panel er-panel--left">
            <h3>Duplicate (will be removed)</h3>
            <div v-for="f in FIELDS" :key="f.key" class="er-field">
              <span class="er-field__label">{{ f.label }}</span>
              <span class="er-field__value">{{ leftVal(f.key) || '\u2014' }}</span>
              <button v-if="leftVal(f.key) && leftVal(f.key) !== merged[f.key]" class="er-pick" title="Use this value" @click="pickLeft(f.key)">&larr;</button>
            </div>
            <div class="er-field">
              <span class="er-field__label">VAT</span>
              <div class="er-vat-list">
                <span v-for="v in formatVatList(selected.dup_vat)" :key="v" class="er-vat-tag">{{ v }}</span>
                <span v-if="!formatVatList(selected.dup_vat).length">&mdash;</span>
              </div>
              <button v-if="formatVatList(selected.dup_vat).length" class="er-pick" title="Add all" @click="addVatFromSide('dup')">&larr;</button>
            </div>
            <div class="er-field">
              <span class="er-field__label">gmr_id</span>
              <span class="er-field__value er-mono">{{ selected.dup_id.substring(0, 12) }}...</span>
            </div>
          </div>

          <!-- Center: editable merged result -->
          <div class="er-panel er-panel--center">
            <h3>Merge Result (editable)</h3>
            <div v-for="f in FIELDS" :key="f.key" class="er-field" :class="{ 'er-field--conflict': isConflict(f.key) }">
              <label class="er-field__label" :for="'merge-' + f.key">{{ f.label }}</label>
              <input
                :id="'merge-' + f.key"
                v-model="merged[f.key]"
                class="er-input"
                :placeholder="f.placeholder"
                :class="{ 'er-input--conflict': isConflict(f.key) }"
              />
            </div>
            <div class="er-field er-field--vat">
              <label class="er-field__label">VAT numbers</label>
              <div class="er-vat-edit">
                <div class="er-vat-tags">
                  <span v-for="(v, i) in merged.vat" :key="i" class="er-vat-tag er-vat-tag--editable">
                    {{ v }}
                    <button class="er-vat-remove" title="Remove" @click="removeVat(i)">&times;</button>
                  </span>
                </div>
                <div class="er-vat-add">
                  <input v-model="newVat" class="er-input er-input--sm" placeholder="Add VAT..." @keydown.enter.prevent="addVat()" />
                  <button class="er-pick" @click="addVat()">+</button>
                </div>
              </div>
            </div>
            <div class="er-field">
              <span class="er-field__label">gmr_id</span>
              <span class="er-field__value er-mono">{{ selected.canonical_id.substring(0, 12) }}... (canonical)</span>
            </div>
          </div>

          <!-- Right: canonical (read-only) -->
          <div class="er-panel er-panel--right">
            <h3>Canonical (will survive)</h3>
            <div v-for="f in FIELDS" :key="f.key" class="er-field">
              <span class="er-field__label">{{ f.label }}</span>
              <span class="er-field__value">{{ rightVal(f.key) || '\u2014' }}</span>
              <button v-if="rightVal(f.key) && rightVal(f.key) !== merged[f.key]" class="er-pick" title="Use this value" @click="pickRight(f.key)">&rarr;</button>
            </div>
            <div class="er-field">
              <span class="er-field__label">VAT</span>
              <div class="er-vat-list">
                <span v-for="v in formatVatList(selected.canonical_vat)" :key="v" class="er-vat-tag">{{ v }}</span>
                <span v-if="!formatVatList(selected.canonical_vat).length">&mdash;</span>
              </div>
              <button v-if="formatVatList(selected.canonical_vat).length" class="er-pick" title="Add all" @click="addVatFromSide('canonical')">&rarr;</button>
            </div>
            <div class="er-field">
              <span class="er-field__label">gmr_id</span>
              <span class="er-field__value er-mono">{{ selected.canonical_id.substring(0, 12) }}...</span>
            </div>
          </div>
        </div>

        <!-- Validation errors -->
        <div v-if="validationErrors.length" class="er-errors">
          <p v-for="(err, i) in validationErrors" :key="i" class="er-errors__item">{{ err }}</p>
        </div>

        <!-- Actions -->
        <div class="er-actions">
          <button class="er-btn er-btn--approve" :disabled="resolving" @click="resolve('approve')">
            Merge with edits
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

.er-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.er-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0.3rem 0 0; }
.er-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.er-subtitle { font-size: 0.85rem; color: var(--muted); margin-top: 0.2rem; }
.er-msg { text-align: center; padding: 4rem 1rem; color: var(--muted); }
.er-note { font-size: 0.85rem; margin-top: 0.5rem; opacity: 0.7; }

.er-layout { display: grid; grid-template-columns: 260px 1fr; gap: 1.25rem; }
@media (max-width: 768px) { .er-layout { grid-template-columns: 1fr; } }

.er-list h2 { font-size: 0.85rem; font-weight: 700; color: var(--muted); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
.er-list__item { padding: 0.6rem 0.75rem; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 0.4rem; cursor: pointer; transition: border-color 0.15s; }
.er-list__item:hover { border-color: var(--accent); }
.er-list__item--active { border-color: var(--accent); background: var(--surface); }
.er-list__names { font-size: 0.82rem; font-weight: 600; display: flex; gap: 0.3rem; align-items: center; flex-wrap: wrap; }
.er-list__arrow { color: var(--muted); font-size: 0.75rem; }
.er-list__meta { font-size: 0.7rem; color: var(--muted); margin-top: 0.2rem; }

.er-panels { display: grid; grid-template-columns: 1fr 1.2fr 1fr; gap: 0.75rem; margin-bottom: 1rem; }
@media (max-width: 900px) { .er-panels { grid-template-columns: 1fr; } }

.er-panel { border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem; background: var(--bg); }
.er-panel--left { border-top: 3px solid #d29922; }
.er-panel--center { border-top: 3px solid var(--accent); }
.er-panel--right { border-top: 3px solid #1a7f37; }

.er-panel h3 { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin-bottom: 0.6rem; }

.er-field { display: flex; justify-content: space-between; align-items: center; padding: 0.3rem 0; border-bottom: 1px solid var(--border); font-size: 0.82rem; gap: 0.3rem; }
.er-field:last-child { border-bottom: none; }
.er-field--conflict { background: rgba(210, 153, 34, 0.08); }
.er-field__label { color: var(--muted); font-size: 0.75rem; min-width: 50px; flex-shrink: 0; }
.er-field__value { font-weight: 500; text-align: right; max-width: 60%; word-break: break-all; }
.er-mono { font-family: monospace; font-size: 0.75rem; }

.er-pick { background: none; border: 1px solid var(--border); border-radius: 3px; padding: 0 0.3rem; font-size: 0.7rem; cursor: pointer; color: var(--accent); flex-shrink: 0; }
.er-pick:hover { background: var(--surface); }

.er-input { width: 100%; padding: 0.3rem 0.5rem; border: 1px solid var(--border); border-radius: 4px; font-size: 0.82rem; background: var(--bg); color: var(--text); font-family: inherit; }
.er-input:focus { outline: none; border-color: var(--accent); }
.er-input--conflict { border-color: #d29922; }

.er-errors { margin-bottom: 0.75rem; padding: 0.5rem 0.75rem; background: #ffeef0; border: 1px solid #cf222e; border-radius: 6px; }
.er-errors__item { font-size: 0.82rem; color: #cf222e; margin: 0.2rem 0; }

.er-actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
.er-btn { padding: 0.5rem 1.25rem; border: none; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
.er-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.er-btn--approve { background: #1a7f37; color: #fff; }
.er-btn--approve:hover:not(:disabled) { opacity: 0.9; }
.er-btn--reject { background: var(--border); color: var(--text); }
.er-btn--reject:hover:not(:disabled) { opacity: 0.8; }
.er-message { font-size: 0.82rem; color: var(--muted); }

.er-field--vat { flex-direction: column; align-items: flex-start; gap: 0.3rem; }
.er-vat-list { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.er-vat-edit { width: 100%; }
.er-vat-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.3rem; }
.er-vat-tag { font-size: 0.75rem; padding: 0.15rem 0.4rem; background: var(--surface, #f6f8fa); border: 1px solid var(--border); border-radius: 3px; font-family: monospace; }
.er-vat-tag--editable { display: inline-flex; align-items: center; gap: 0.2rem; }
.er-vat-remove { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.85rem; padding: 0; line-height: 1; }
.er-vat-remove:hover { color: #cf222e; }
.er-vat-add { display: flex; gap: 0.3rem; }
.er-input--sm { flex: 1; padding: 0.2rem 0.4rem; font-size: 0.78rem; }
</style>
