<script setup>
import { ref, computed, onMounted } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

// Talks to gmr-consolidator via the gmr-community-api proxy.
const API = '/api/consolidator'

const state = ref('loading')        // loading | ready | error
const message = ref('')
const candidates = ref([])
const rules = ref([])
const filterRule = ref('')
const filterEntityType = ref('')

async function fetchRules () {
  try {
    const res = await fetch(`${API}/rules`)
    if (res.ok) rules.value = await res.json()
  } catch { /* leave empty — chip just won't render */ }
}

async function fetchCandidates () {
  state.value = 'loading'
  message.value = ''
  const params = new URLSearchParams({ reviewed: 'false', limit: '100' })
  if (filterEntityType.value) params.set('entity_type', filterEntityType.value)
  try {
    const res = await fetch(`${API}/candidates?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    candidates.value = await res.json()
    state.value = 'ready'
  } catch (e) {
    state.value = 'error'
    message.value = e.message
  }
}

const visibleCandidates = computed(() => {
  if (!filterRule.value) return candidates.value
  return candidates.value.filter(c => c.rule_name === filterRule.value)
})

async function decide (cand, decision) {
  const reviewer = (window.localStorage.getItem('gmr.reviewer') || 'anonymous')
  try {
    const res = await fetch(
      `${API}/candidates/${encodeURIComponent(cand.from_id)}/${encodeURIComponent(cand.to_id)}/decide`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewer }),
      },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    candidates.value = candidates.value.filter(c => c !== cand)
    message.value = `Recorded ${decision} for ${cand.from_id} → ${cand.to_id}.`
  } catch (e) {
    message.value = `Decision failed: ${e.message}`
  }
}

function fmtTs (iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function fmtConfidence (n) {
  return typeof n === 'number' ? n.toFixed(2) : '—'
}

onMounted(() => { fetchRules(); fetchCandidates() })
</script>

<template>
  <div class="page">
    <header class="row">
      <h1>Consolidation review queue</h1>
      <ThemeToggle />
    </header>

    <p class="hint">
      Each card is a <code>:SAME_AS</code> candidate the consolidator surfaced.
      The <strong>rule</strong> badge tells you which rule produced it.
      Decide <em>Merge</em>, <em>Not the same</em>, or <em>Related, not same</em>.
    </p>

    <div class="filters">
      <label>
        Entity:
        <select v-model="filterEntityType" @change="fetchCandidates">
          <option value="">All</option>
          <option value="Company">Company</option>
          <option value="Authority">Authority</option>
        </select>
      </label>
      <label>
        Rule:
        <select v-model="filterRule">
          <option value="">All rules</option>
          <option v-for="r in rules" :key="r.name" :value="r.name">{{ r.name }}</option>
        </select>
      </label>
      <button @click="fetchCandidates">Refresh</button>
    </div>

    <p v-if="message" class="message">{{ message }}</p>

    <div v-if="state === 'loading'">Loading…</div>
    <div v-else-if="state === 'error'" class="error">
      Could not reach consolidator: {{ message }}
    </div>
    <div v-else-if="visibleCandidates.length === 0">No pending candidates 🎉</div>

    <ul v-else class="cards">
      <li v-for="cand in visibleCandidates" :key="cand.from_id + cand.to_id" class="card" :class="{ conflict: cand.conflict }">
        <header class="card-header">
          <span class="rule">{{ cand.rule_name }}</span>
          <span class="conf" :title="`confidence ${cand.confidence}`">conf {{ fmtConfidence(cand.confidence) }}</span>
          <span v-if="cand.conflict" class="conflict-tag">conflict</span>
          <span class="ts">{{ fmtTs(cand.detected_at) }}</span>
        </header>
        <div class="card-body">
          <div class="entity">
            <strong>A — {{ cand.from_id }}</strong>
            <pre>{{ JSON.stringify(cand.source_entity || {}, null, 2) }}</pre>
          </div>
          <div class="entity">
            <strong>B — {{ cand.to_id }}</strong>
            <pre>{{ JSON.stringify(cand.target_entity || {}, null, 2) }}</pre>
          </div>
        </div>
        <footer class="actions">
          <button class="primary" @click="decide(cand, 'merge')">Merge A ← B</button>
          <button @click="decide(cand, 'reject')">Not the same</button>
          <button @click="decide(cand, 'keep_as_related')">Related, not same</button>
        </footer>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.page { max-width: 1100px; margin: 1rem auto; padding: 0 1rem; }
.row { display: flex; align-items: center; justify-content: space-between; }
.hint { font-size: 0.92rem; opacity: 0.85; }
.filters { display: flex; gap: 1rem; align-items: end; margin: 1rem 0; }
.filters select { padding: 0.3rem; }
.message { padding: 0.5rem; background: var(--bg-muted, #f4f4f4); border-radius: 4px; }
.error { color: #c00; }
.cards { list-style: none; padding: 0; display: grid; gap: 1rem; }
.card { border: 1px solid var(--border, #ccc); border-radius: 6px; padding: 0.8rem; }
.card.conflict { border-color: #d97706; background: rgba(217, 119, 6, 0.04); }
.card-header { display: flex; gap: 0.6rem; align-items: baseline; flex-wrap: wrap; }
.rule { font-weight: 600; font-family: ui-monospace, monospace; }
.conf { font-family: ui-monospace, monospace; opacity: 0.8; }
.conflict-tag { font-size: 0.75rem; padding: 0.1rem 0.4rem; background: #d97706; color: #fff; border-radius: 3px; }
.ts { margin-left: auto; opacity: 0.6; font-size: 0.85rem; }
.card-body { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.6rem; }
.entity pre { background: var(--bg-muted, #f4f4f4); padding: 0.5rem; max-height: 220px; overflow: auto; font-size: 0.78rem; }
.actions { display: flex; gap: 0.5rem; margin-top: 0.6rem; flex-wrap: wrap; }
button { padding: 0.4rem 0.8rem; cursor: pointer; }
button.primary { font-weight: 600; }
</style>
