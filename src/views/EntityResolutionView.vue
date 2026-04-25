<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

const state = ref('loading')
const candidates = ref([])
const selected = ref(null)
const resolving = ref(false)
const message = ref('')

// Reviewer name persisted to localStorage so the consolidator's audit
// log carries something more useful than "anonymous". Falls through to
// "ui-reviewer" if the user hasn't set a name.
const REVIEWER_KEY = 'gmr-reviewer-name'
const reviewerName = ref(localStorage.getItem(REVIEWER_KEY) || '')
function persistReviewer() {
  if (reviewerName.value.trim()) {
    localStorage.setItem(REVIEWER_KEY, reviewerName.value.trim())
  }
}
const effectiveReviewer = computed(
  () => reviewerName.value.trim() || 'ui-reviewer'
)

onMounted(async () => {
  document.title = 'Entity Resolution — Fontem'
  await loadCandidates()
})

async function loadCandidates() {
  state.value = 'loading'
  try {
    // Real endpoint on the consolidator (reverse-proxied through nginx).
    // The earlier /api/entity-resolution/* route never existed.
    const res = await fetch('/api/consolidator/candidates?reviewed=false&limit=100')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    candidates.value = await res.json()
    state.value = candidates.value.length > 0 ? 'done' : 'empty'
    selected.value = candidates.value[0] || null
  } catch (e) {
    state.value = 'error'
    message.value = `Error: ${e.message}`
  }
}

async function decide(decision, fromId, toId) {
  if (!selected.value) return
  resolving.value = true
  message.value = ''
  persistReviewer()
  try {
    const url = `/api/consolidator/candidates/${encodeURIComponent(fromId)}/${encodeURIComponent(toId)}/decide`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reviewer: effectiveReviewer.value }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`HTTP ${res.status}: ${err.slice(0, 120)}`)
    }
    const body = await res.json()
    message.value = decisionMessage(body.outcome, fromId, toId)
    // Drop the resolved pair from the queue and pick the next one.
    candidates.value = candidates.value.filter(
      (c) => !(c.from_id === selected.value.from_id && c.to_id === selected.value.to_id)
    )
    selected.value = candidates.value[0] || null
    if (candidates.value.length === 0) state.value = 'empty'
  } catch (e) {
    message.value = `Error: ${e.message}`
  } finally {
    resolving.value = false
  }
}

function decisionMessage(outcome, fromId, toId) {
  const f = fromId.slice(0, 8)
  const t = toId.slice(0, 8)
  switch (outcome) {
    case 'manual_merge':
      return `Merged ${t}… into ${f}…`
    case 'manual_reject':
      return `Rejected — ${f}… and ${t}… are different entities`
    case 'manual_keep_related':
      return `Kept as related — ${f}… and ${t}… are distinct but linked`
    default:
      return outcome
  }
}

// Display helpers for the two side-by-side panels. Both Authority and
// Company nodes are flagged through this view, so we render whichever
// keys exist on each entity in a stable preferred order.
const PREFERRED_KEYS = [
  'name', 'country', 'name_lang',
  'lei', 'vat', 'cik',
  'authority_id', 'gmr_id',
]
function entityRows(entity) {
  if (!entity) return []
  const seen = new Set()
  const rows = []
  for (const k of PREFERRED_KEYS) {
    if (entity[k] !== undefined && entity[k] !== null && entity[k] !== '') {
      rows.push([k, entity[k]])
      seen.add(k)
    }
  }
  // Plus any other primitive props (skip the embedding vector and the
  // 23 translated-name fields which would crowd the card).
  for (const [k, v] of Object.entries(entity)) {
    if (seen.has(k)) continue
    if (k.startsWith('name_') && k !== 'name_lang') continue
    if (k.endsWith('_embedding') || k.endsWith('_embedding_encoder')
        || k.endsWith('_embedding_dim')) continue
    if (Array.isArray(v) && v.length > 5) continue
    if (typeof v === 'object' && v !== null) continue
    rows.push([k, v])
  }
  return rows.slice(0, 12) // Keep cards readable.
}

function ruleBadge(rule) {
  // Short, human-readable display name for the rule.
  return rule.replace(/_authority$|_company$/, '').replace(/_/g, ' ')
}

function pct(v) {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`
}

function formatValue(v) {
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}
</script>

<template>
  <div class="er">
    <header class="er-header">
      <div>
        <router-link to="/admin" class="er-back">&larr; Admin</router-link>
        <h1>Entity Resolution</h1>
        <p class="er-subtitle">
          Review and decide on flagged duplicate pairs
          <span class="er-reviewer-line">
            &middot; reviewer: <input
              v-model="reviewerName"
              class="er-reviewer-input"
              placeholder="your name"
              @blur="persistReviewer"
            />
          </span>
        </p>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="state === 'loading'" class="er-msg">Loading candidates...</div>
    <div v-else-if="state === 'error'" class="er-msg">
      <p>Failed to load candidates.</p>
      <p class="er-note">{{ message }}</p>
    </div>
    <div v-else-if="state === 'empty'" class="er-msg">
      <p>No pairs pending review.</p>
      <p class="er-note">All flagged pairs have been resolved.</p>
    </div>

    <div v-else class="er-layout">
      <!-- Left sidebar: candidate list -->
      <aside class="er-list">
        <h2>Pending ({{ candidates.length }})</h2>
        <div
          v-for="c in candidates"
          :key="c.from_id + c.to_id"
          class="er-list__item"
          :class="{ 'er-list__item--active': selected === c }"
          @click="selected = c"
        >
          <div class="er-list__names">
            <span>{{ c.source_entity?.name || c.from_id.slice(0, 8) }}</span>
            <span class="er-list__arrow">&harr;</span>
            <span>{{ c.target_entity?.name || c.to_id.slice(0, 8) }}</span>
          </div>
          <div class="er-list__meta">
            {{ c.entity_type }} &middot; {{ pct(c.confidence) }}
            <span v-if="c.detections && c.detections.length > 1" class="er-list__multi">
              · {{ c.detections.length }} rules
            </span>
            <span v-if="c.conflict" class="er-list__conflict">· conflict</span>
          </div>
        </div>
      </aside>

      <!-- Main: pair-comparison view -->
      <main v-if="selected" class="er-merge">
        <!-- Detection chips: every rule that flagged this pair -->
        <div class="er-detections">
          <h3>Why flagged</h3>
          <div class="er-chips">
            <span
              v-for="d in (selected.detections && selected.detections.length
                            ? selected.detections
                            : [{ rule_name: selected.rule_name, confidence: selected.confidence, detected_at: selected.detected_at }])"
              :key="d.rule_name"
              class="er-chip"
              :title="d.detected_at"
            >
              <span class="er-chip__rule">{{ ruleBadge(d.rule_name) }}</span>
              <span class="er-chip__conf">{{ pct(d.confidence) }}</span>
            </span>
          </div>
          <p v-if="selected.conflict" class="er-conflict-note">
            One or more rules reported a hard-conflict on this pair (e.g. mismatched LEI / VAT).
            Review carefully before merging.
          </p>
        </div>

        <!-- Side-by-side entity panels -->
        <div class="er-panels">
          <div class="er-panel er-panel--left">
            <h3>Entity A
              <span class="er-panel__id">{{ selected.from_id.slice(0, 12) }}…</span>
            </h3>
            <div v-for="[k, v] in entityRows(selected.source_entity)" :key="k" class="er-field">
              <span class="er-field__label">{{ k }}</span>
              <span class="er-field__value">{{ formatValue(v) }}</span>
            </div>
          </div>
          <div class="er-panel er-panel--right">
            <h3>Entity B
              <span class="er-panel__id">{{ selected.to_id.slice(0, 12) }}…</span>
            </h3>
            <div v-for="[k, v] in entityRows(selected.target_entity)" :key="k" class="er-field">
              <span class="er-field__label">{{ k }}</span>
              <span class="er-field__value">{{ formatValue(v) }}</span>
            </div>
          </div>
        </div>

        <!-- Decision actions -->
        <div class="er-actions">
          <button
            class="er-btn er-btn--merge"
            :disabled="resolving"
            @click="decide('merge', selected.from_id, selected.to_id)"
          >
            Merge — keep A (B is removed)
          </button>
          <button
            class="er-btn er-btn--merge"
            :disabled="resolving"
            @click="decide('merge', selected.to_id, selected.from_id)"
          >
            Merge — keep B (A is removed)
          </button>
          <button
            class="er-btn er-btn--related"
            :disabled="resolving"
            @click="decide('keep_as_related', selected.from_id, selected.to_id)"
          >
            Keep as related
          </button>
          <button
            class="er-btn er-btn--reject"
            :disabled="resolving"
            @click="decide('reject', selected.from_id, selected.to_id)"
          >
            Different entities — reject
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
.er-reviewer-line { font-size: 0.8rem; }
.er-reviewer-input { font-size: 0.8rem; border: 1px solid var(--border); border-radius: 3px; padding: 0.1rem 0.3rem; background: var(--bg); color: var(--text); width: 9rem; }
.er-msg { text-align: center; padding: 4rem 1rem; color: var(--muted); }
.er-note { font-size: 0.85rem; margin-top: 0.5rem; opacity: 0.7; }

.er-layout { display: grid; grid-template-columns: 280px 1fr; gap: 1.25rem; }
@media (max-width: 768px) { .er-layout { grid-template-columns: 1fr; } }

.er-list h2 { font-size: 0.85rem; font-weight: 700; color: var(--muted); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
.er-list__item { padding: 0.6rem 0.75rem; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 0.4rem; cursor: pointer; transition: border-color 0.15s; }
.er-list__item:hover { border-color: var(--accent); }
.er-list__item--active { border-color: var(--accent); background: var(--surface); }
.er-list__names { font-size: 0.82rem; font-weight: 600; display: flex; gap: 0.3rem; align-items: center; flex-wrap: wrap; }
.er-list__arrow { color: var(--muted); font-size: 0.75rem; }
.er-list__meta { font-size: 0.7rem; color: var(--muted); margin-top: 0.2rem; }
.er-list__multi { font-weight: 600; color: var(--accent); }
.er-list__conflict { color: #cf222e; font-weight: 600; }

.er-detections { margin-bottom: 1rem; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); }
.er-detections h3 { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 0 0 0.5rem; }
.er-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.er-chip { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.5rem; background: var(--surface, #f6f8fa); border: 1px solid var(--border); border-radius: 999px; font-size: 0.78rem; }
.er-chip__rule { font-family: monospace; }
.er-chip__conf { font-weight: 700; color: var(--accent); }
.er-conflict-note { margin-top: 0.5rem; padding: 0.4rem 0.6rem; background: rgba(207, 34, 46, 0.08); color: #cf222e; border-radius: 4px; font-size: 0.78rem; }

.er-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; }
@media (max-width: 900px) { .er-panels { grid-template-columns: 1fr; } }

.er-panel { border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem; background: var(--bg); }
.er-panel--left { border-top: 3px solid #d29922; }
.er-panel--right { border-top: 3px solid #1a7f37; }
.er-panel h3 { font-size: 0.85rem; font-weight: 700; margin: 0 0 0.6rem; display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
.er-panel__id { font-family: monospace; font-size: 0.7rem; color: var(--muted); font-weight: 400; }

.er-field { display: flex; justify-content: space-between; padding: 0.3rem 0; border-bottom: 1px solid var(--border); font-size: 0.82rem; gap: 0.5rem; }
.er-field:last-child { border-bottom: none; }
.er-field__label { color: var(--muted); font-size: 0.75rem; min-width: 80px; flex-shrink: 0; font-family: monospace; }
.er-field__value { font-weight: 500; text-align: right; max-width: 65%; word-break: break-word; }

.er-actions { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; padding-top: 0.75rem; border-top: 1px solid var(--border); }
.er-btn { padding: 0.45rem 0.9rem; border: 1px solid var(--border); border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer; background: var(--bg); color: var(--text); }
.er-btn:hover:not(:disabled) { border-color: var(--accent); }
.er-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.er-btn--merge { background: #1a7f37; color: #fff; border-color: #1a7f37; }
.er-btn--merge:hover:not(:disabled) { opacity: 0.9; }
.er-btn--related { background: var(--surface, #f6f8fa); }
.er-btn--reject { background: var(--surface, #f6f8fa); color: #cf222e; }
.er-message { font-size: 0.82rem; color: var(--muted); margin-left: auto; }
</style>
