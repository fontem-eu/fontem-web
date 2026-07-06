<script setup>
/**
 * Admin queue for quarantined contract values: the human half of the
 * value-quarantine pipeline. Each row is a withheld claim (the value
 * the notice published, removed from the stores); the reviewer either
 * enters the corrected EUR value or confirms the claim is bogus.
 * Decisions are emitted as corrective events by the API, so they
 * survive re-ingests — nothing here edits the graph directly.
 */
import { ref, onMounted } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

onMounted(() => { document.title = 'Value Review — Fontem' })

const items = ref([])
const counts = ref({})
const state = ref('loading')
const busy = ref(null)         // review id with an in-flight decision
const drafts = ref({})         // review id -> corrected value text

async function load() {
  state.value = 'loading'
  try {
    const r = await fetch('/api/value-review?status=pending')
    if (!r.ok) throw new Error(r.status)
    const json = await r.json()
    items.value = json.items
    counts.value = json.counts || {}
    state.value = items.value.length ? 'done' : 'empty'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

async function decide(item, action) {
  const body = { action }
  if (action === 'correct') {
    const v = Number(drafts.value[item.id])
    if (!Number.isFinite(v) || v <= 0) return
    body.value_eur = v
  }
  busy.value = item.id
  try {
    const r = await fetch(`/api/value-review/${item.id}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (r.ok) items.value = items.value.filter((i) => i.id !== item.id)
  } finally {
    busy.value = null
  }
}

function fmt(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('en', {
    style: 'currency', currency: 'EUR', notation: 'compact',
    maximumFractionDigits: 1,
  }).format(v)
}
</script>

<template>
  <div class="vr">
    <header class="vr-hdr">
      <div>
        <h1>{{ $t('value_review.title') }}</h1>
        <p class="vr-sub">{{ $t('value_review.subtitle') }}</p>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="state === 'loading'" class="vr-muted">{{ $t('app.loading_2') }}</div>
    <div v-else-if="state === 'error'" class="vr-muted">{{ $t('value_review.load_error') }}</div>
    <div v-else-if="state === 'empty'" class="vr-muted" data-testid="vr-empty">
      {{ $t('value_review.empty') }}
      <span v-if="counts.corrected || counts.confirmed_bogus">
        ({{ counts.corrected || 0 }} corrected · {{ counts.confirmed_bogus || 0 }} confirmed bogus)
      </span>
    </div>

    <table v-else class="vr-table" data-testid="vr-table">
      <thead>
        <tr>
          <th>{{ $t('value_review.col_contract') }}</th>
          <th>{{ $t('value_review.col_reason') }}</th>
          <th class="num">{{ $t('value_review.col_claimed') }}</th>
          <th class="num">{{ $t('value_review.col_estimate') }}</th>
          <th>{{ $t('value_review.col_decision') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id">
          <td>
            <router-link :to="`/contract/${item.ted_notice_id}`">{{ item.ted_notice_id }}</router-link>
            <div v-if="item.detail" class="vr-detail">{{ item.detail }}</div>
          </td>
          <td>
            <code>{{ item.reason }}</code>
            <div class="vr-detail">{{ item.explanation }}</div>
          </td>
          <td class="num vr-claimed">{{ fmt(item.claimed_value_eur) }}</td>
          <td class="num">{{ fmt(item.claimed_estimated_eur) }}</td>
          <td class="vr-actions">
            <input
              v-model="drafts[item.id]"
              type="number"
              min="0"
              class="vr-input"
              :placeholder="$t('value_review.corrected_placeholder')"
            >
            <button
              class="vr-btn vr-btn--fix"
              :disabled="busy === item.id"
              @click="decide(item, 'correct')"
            >{{ $t('value_review.action_correct') }}</button>
            <button
              class="vr-btn vr-btn--bogus"
              :disabled="busy === item.id"
              @click="decide(item, 'confirm_bogus')"
            >{{ $t('value_review.action_bogus') }}</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.vr { max-width: 1100px; margin: 0 auto; padding: 0 1rem 4rem; }
.vr-hdr { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.vr-hdr h1 { font-size: 1.3rem; font-weight: 700; margin: 0; }
.vr-sub { font-size: 0.82rem; color: var(--muted); margin-top: 0.15rem; max-width: 60ch; }
.vr-muted { text-align: center; padding: 3rem; color: var(--muted); }
.vr-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.vr-table th, .vr-table td { text-align: left; padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--border); vertical-align: top; }
.vr-table th { color: var(--muted); font-weight: 600; }
.vr-table .num { text-align: right; }
.vr-claimed { font-weight: 700; color: #dc2626; }
.vr-detail { color: var(--muted); font-size: 0.78rem; max-width: 42ch; }
.vr-actions { white-space: nowrap; }
.vr-input { width: 9rem; padding: 0.25rem 0.4rem; margin-right: 0.35rem; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; }
.vr-btn { padding: 0.25rem 0.6rem; border-radius: 6px; border: 1px solid var(--border); background: none; color: var(--text); cursor: pointer; margin-right: 0.3rem; }
.vr-btn--fix { border-color: #16a34a; color: #16a34a; }
.vr-btn--bogus { border-color: #dc2626; color: #dc2626; }
.vr-btn:disabled { opacity: 0.5; cursor: wait; }
</style>
