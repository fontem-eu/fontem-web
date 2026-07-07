<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

// Three review queues live behind one screen:
//   - same_as     : entity duplicates flagged by the consolidator's
//                   matching rules (existing behaviour)
//   - represents  : Lobbyist → Company links the resolver-driven
//                   load_eu_lobbying ETL writes with reviewed=false
//   - sanctioned  : Company → SanctionedEntity links the
//                   resolver-driven load_eu_sanctions ETL writes with
//                   reviewed=false (always, regardless of tier — the
//                   defamation cost of an auto-approved sanction
//                   match is too high)
const MODES = [
  { id: 'same_as',    label: 'Duplicates',   relType: null },
  { id: 'represents', label: 'Lobbying',     relType: 'REPRESENTS' },
  { id: 'sanctioned', label: 'Sanctions',    relType: 'SANCTIONED' },
]
const mode = ref('same_as')

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

watch(mode, async () => {
  await loadCandidates()
})

async function loadCandidates() {
  state.value = 'loading'
  message.value = ''
  try {
    let res
    if (mode.value === 'same_as') {
      res = await fetch('/api/consolidator/candidates?reviewed=false&limit=100')
    } else {
      const cfg = MODES.find((m) => m.id === mode.value)
      res = await fetch(
        `/api/consolidator/relationships?rel_type=${cfg.relType}&reviewed=false&limit=100`,
      )
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    candidates.value = (await res.json()).map(_normalise)
    state.value = candidates.value.length > 0 ? 'done' : 'empty'
    selected.value = candidates.value[0] || null
  } catch (e) {
    state.value = 'error'
    message.value = `Error: ${e.message}`
  }
}

// Normalise both /candidates and /relationships rows into the same
// shape the template renders. The two endpoints diverge meaningfully
// on key naming, but the *display* concept (Source ↔ Target plus
// edge metadata) is identical.
function _normalise(row) {
  if (mode.value === 'same_as') {
    // /candidates row
    return {
      _mode: 'same_as',
      key: `${row.from_id}::${row.to_id}`,
      from_id: row.from_id,
      to_id: row.to_id,
      entity_type: row.entity_type,
      source_entity: row.source_entity,
      target_entity: row.target_entity,
      detections: row.detections || [
        { rule_name: row.rule_name, confidence: row.confidence,
          detected_at: row.detected_at },
      ],
      confidence: row.confidence,
      conflict: row.conflict,
    }
  }
  // /relationships row
  return {
    _mode: mode.value,
    key: row.edge_id,
    edge_id: row.edge_id,
    rel_type: row.rel_type,
    from_id: row.source.id,
    to_id: row.target.id,
    entity_type: row.source.labels[0],
    source_entity: { ...row.source.props, _label: row.source.labels[0] },
    target_entity: { ...row.target.props, _label: row.target.labels[0] },
    detections: [
      { rule_name: row.method || row.tier || 'resolver',
        confidence: row.confidence,
        detected_at: row.detected_at },
    ],
    confidence: row.confidence,
    tier: row.tier,
    conflict: false,
  }
}

async function decide(decision, fromId, toId) {
  if (!selected.value) return
  resolving.value = true
  message.value = ''
  persistReviewer()
  try {
    const body = await _postDecision(decision, fromId, toId)
    message.value = decisionMessage(body.outcome, fromId, toId)
    candidates.value = candidates.value.filter(
      (c) => c.key !== selected.value.key,
    )
    selected.value = candidates.value[0] || null
    if (candidates.value.length === 0) state.value = 'empty'
  } catch (e) {
    message.value = `Error: ${e.message}`
  } finally {
    resolving.value = false
  }
}

async function _postDecision(decision, fromId, toId) {
  let url
  let payload
  if (selected.value._mode === 'same_as') {
    url = `/api/consolidator/candidates/${encodeURIComponent(fromId)}/${encodeURIComponent(toId)}/decide`
    payload = { decision, reviewer: effectiveReviewer.value }
  } else {
    // Relationship-review endpoint: edge_id keyed, accept/reject only.
    url = `/api/consolidator/relationships/${encodeURIComponent(selected.value.edge_id)}/decide`
    payload = { decision, reviewer: effectiveReviewer.value }
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HTTP ${res.status}: ${err.slice(0, 120)}`)
  }
  return res.json()
}

function decisionMessage(outcome, fromId, toId) {
  const f = (fromId || '').slice(0, 8)
  const t = (toId || '').slice(0, 8)
  switch (outcome) {
    case 'manual_merge':
      return `Merged ${t}… into ${f}…`
    case 'manual_reject':
      return `Rejected — ${f}… and ${t}… are different entities`
    case 'manual_keep_related':
      return `Kept as related — ${f}… and ${t}… are distinct but linked`
    case 'manual_accept_relationship':
      return `Accepted — ${f}… → ${t}… relationship confirmed`
    case 'manual_reject_relationship':
      return `Rejected — ${f}… → ${t}… relationship removed`
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
        <router-link to="/admin" class="er-back">{{ $t('nav.back_admin') }}</router-link>
        <h1>{{ $t('app.entity_resolution') }}</h1>
        <p class="er-subtitle">{{ $t('entity_resolution.review_and_decide_on_flagged_candidates') }}<span class="er-reviewer-line">
            &middot; {{ $t('entity_resolution.reviewer') }} <input
              v-model="reviewerName"
              class="er-reviewer-input"
              :placeholder="$t('entity_resolution.your_name')"
              @blur="persistReviewer"
            />
          </span>
        </p>
      </div>
      <ThemeToggle />
    </header>

    <!-- Mode tabs: switch between SAME_AS / REPRESENTS / SANCTIONED queues -->
    <nav class="er-tabs" role="tablist">
      <button
        v-for="m in MODES"
        :key="m.id"
        :class="['er-tab', { 'er-tab--active': mode === m.id }]"
        :aria-selected="mode === m.id"
        role="tab"
        @click="mode = m.id"
      >
        {{ m.label }}
      </button>
    </nav>

    <div v-if="state === 'loading'" class="er-msg">{{ $t('entity_resolution.loading_candidates') }}</div>
    <div v-else-if="state === 'error'" class="er-msg">
      <p>{{ $t('entity_resolution.failed_to_load_candidates') }}</p>
      <p class="er-note">{{ message }}</p>
    </div>
    <div v-else-if="state === 'empty'" class="er-msg">
      <p>{{ $t('entity_resolution.no_pairs_pending_review') }}</p>
      <p class="er-note">{{ $t('entity_resolution.all_flagged_pairs_have_been_resolved') }}</p>
    </div>

    <div v-else class="er-layout">
      <!-- Left sidebar: candidate list -->
      <aside class="er-list">
        <h2>{{ $t('entity_resolution.pending') }} ({{ candidates.length }})</h2>
        <div
          v-for="c in candidates"
          :key="c.key"
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
              · {{ c.detections.length }} {{ $t('entity_resolution.rules') }}
            </span>
            <span v-if="c.conflict" class="er-list__conflict">· {{ $t('entity_resolution.conflict') }}</span>
          </div>
        </div>
      </aside>

      <!-- Main: pair-comparison view -->
      <main v-if="selected" class="er-merge">
        <!-- Detection chips: every rule that flagged this pair -->
        <div class="er-detections">
          <h3>{{ $t('entity_resolution.why_flagged') }}</h3>
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
          <p v-if="selected.conflict" class="er-conflict-note">{{ $t('entity_resolution.one_or_more_rules_reported_a_hard_conflic') }}</p>
        </div>

        <!-- Side-by-side entity panels -->
        <div class="er-panels">
          <div class="er-panel er-panel--left">
            <h3>{{ $t('entity_resolution.entity_a') }}<span class="er-panel__id">{{ selected.from_id.slice(0, 12) }}…</span>
            </h3>
            <div v-for="[k, v] in entityRows(selected.source_entity)" :key="k" class="er-field">
              <span class="er-field__label">{{ k }}</span>
              <span class="er-field__value">{{ formatValue(v) }}</span>
            </div>
          </div>
          <div class="er-panel er-panel--right">
            <h3>{{ $t('entity_resolution.entity_b') }}<span class="er-panel__id">{{ selected.to_id.slice(0, 12) }}…</span>
            </h3>
            <div v-for="[k, v] in entityRows(selected.target_entity)" :key="k" class="er-field">
              <span class="er-field__label">{{ k }}</span>
              <span class="er-field__value">{{ formatValue(v) }}</span>
            </div>
          </div>
        </div>

        <!-- Decision actions — vocabulary depends on the queue. SAME_AS
             pairs go merge/keep-as-related/reject; relationship claims
             go accept/reject. -->
        <div v-if="selected._mode === 'same_as'" class="er-actions">
          <button
            class="er-btn er-btn--merge"
            :disabled="resolving"
            @click="decide('merge', selected.from_id, selected.to_id)"
          >{{ $t('entity_resolution.merge_keep_a_b_is_removed') }}</button>
          <button
            class="er-btn er-btn--merge"
            :disabled="resolving"
            @click="decide('merge', selected.to_id, selected.from_id)"
          >{{ $t('entity_resolution.merge_keep_b_a_is_removed') }}</button>
          <button
            class="er-btn er-btn--related"
            :disabled="resolving"
            @click="decide('keep_as_related', selected.from_id, selected.to_id)"
          >{{ $t('entity_resolution.keep_as_related') }}</button>
          <button
            class="er-btn er-btn--reject"
            :disabled="resolving"
            @click="decide('reject', selected.from_id, selected.to_id)"
          >{{ $t('entity_resolution.different_entities_reject') }}</button>
          <span v-if="message" class="er-message">{{ message }}</span>
        </div>
        <div v-else class="er-actions">
          <button
            class="er-btn er-btn--merge"
            :disabled="resolving"
            @click="decide('accept', selected.from_id, selected.to_id)"
          >
            <template v-if="selected._mode === 'represents'">{{ $t('entity_resolution.accept_lobbyist_represents_company') }}</template>
            <template v-else-if="selected._mode === 'sanctioned'">{{ $t('entity_resolution.accept_company_is_sanctioned') }}</template>
            <template v-else>{{ $t('entity_resolution.accept_relationship') }}</template>
          </button>
          <button
            class="er-btn er-btn--reject"
            :disabled="resolving"
            @click="decide('reject', selected.from_id, selected.to_id)"
          >{{ $t('entity_resolution.reject_relationship_is_wrong') }}</button>
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
.er-tabs {
  display: flex;
  gap: 0.4rem;
  margin: 0 0 1rem;
  border-bottom: 1px solid var(--border);
}
.er-tab {
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  background: var(--bg);
  color: var(--text);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: -1px;
}
.er-tab:hover { border-color: var(--accent); }
.er-tab--active {
  border-color: var(--border);
  border-bottom: 1px solid var(--bg);
  background: var(--bg);
  color: var(--accent);
}
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
