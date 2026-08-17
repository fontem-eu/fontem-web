<script setup>
/**
 * My briefings — the reading surface, and nothing else.
 *
 * Everything across the briefings you watch, newest first, each item tagged
 * with the briefing it came from. Managing subscriptions — regions, volume,
 * feed URLs — lives on /briefings. A page that both configures and streams
 * makes you scroll past settings to read and past content to change a
 * setting; this one only reads.
 *
 * It deliberately does NOT merge with the data-stories feed on /. Those are
 * written by people and these are produced by queries, and a stream that
 * silently mixes the two teaches nobody which is which.
 *
 * Deliberately not a feed-reader library either. Items arrive from our own
 * API as JSON, so there is no XML to parse, and the CSP forbids eval, which
 * is where most reader engines fall over. Every watch exposes a standard Atom
 * URL on /briefings for anyone who prefers their own reader.
 *
 * "New" is per-visit and kept in localStorage. A read marker is not worth a
 * round trip or a row, and keeping it local avoids deciding what "read" means
 * across devices.
 */
import { ref, computed, onMounted } from 'vue'
import { listMyWatches, getBriefing, listBriefings } from '../api/community.js'

const SEEN_KEY = 'fontem-briefings-last-visit'

const watches = ref([])
const briefings = ref([])
const items = ref([])
const loading = ref(true)
const error = ref(null)
const lastVisit = ref(null)

const newCount = computed(() => items.value.filter(isNew).length)

function isNew(item) {
  if (!lastVisit.value) return false
  return new Date(item.first_seen_at || item.item_time) > lastVisit.value
}

onMounted(async () => {
  document.title = 'My briefings — Fontem'
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (raw) lastVisit.value = new Date(raw)
  } catch { /* private mode: everything simply reads as not-new */ }
  await load()
  try {
    localStorage.setItem(SEEN_KEY, new Date().toISOString())
  } catch { /* ignore */ }
})

async function load() {
  loading.value = true
  error.value = null
  try {
    const [mine, all] = await Promise.all([listMyWatches(), listBriefings()])
    watches.value = mine
    briefings.value = all
    // One request per watched briefing, each honouring that watch's own
    // regions and volume, then merged newest-first.
    const perWatch = await Promise.all(mine.map(async (watch) => {
      const briefing = all.find((b) => b.id === watch.group_id)
      if (!briefing) return []
      const detail = await getBriefing(briefing.slug,
        { nuts: watch.nuts, volume: watch.volume_per_week })
      return (detail.items || []).map((i) => ({ ...i, _from: briefing.name }))
    }))
    // Watches overlap on purpose — Coimbra and Portugal both cover Coimbra —
    // so the same item arrives from several of them. Each feed answers its
    // own question, but the merged reading view is one stream and must show
    // a thing once. Keyed by briefing + item so the same record appearing in
    // two different briefings still reads as two findings, which it is.
    const seen = new Map()
    for (const item of perWatch.flat()) {
      const key = `${item._from}::${item.item_id}`
      if (!seen.has(key)) seen.set(key, item)
    }
    items.value = [...seen.values()].sort(
      (a, b) => new Date(b.item_time) - new Date(a.item_time),
    )
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString() : ''
}

function fmtValue(value) {
  if (value === null || value === undefined) return ''
  return new Intl.NumberFormat(undefined, {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(value)
}
</script>

<template>
  <div class="mb">
    <header class="mb-header">
      <div>
        <h1>{{ $t('briefings.my_title') }}</h1>
        <p v-if="newCount" class="mb-new-count" data-testid="new-count">
          {{ $t('briefings.n_new', { n: newCount }) }}
        </p>
      </div>
      <router-link to="/briefings" class="mb-btn" data-testid="manage-link">
        {{ $t('briefings.manage') }}
      </router-link>
    </header>

    <p v-if="error" class="mb-error" data-testid="error">{{ error }}</p>
    <p v-if="loading" class="mb-muted">{{ $t('app.loading') }}</p>

    <template v-else-if="!watches.length">
      <p class="mb-muted" data-testid="nothing-watched">{{ $t('briefings.watch_nothing_yet') }}</p>
      <router-link to="/briefings" class="mb-btn mb-primary">
        {{ $t('briefings.browse_all') }}
      </router-link>
    </template>

    <p v-else-if="!items.length" class="mb-muted" data-testid="no-items">
      {{ $t('briefings.nothing_new') }}
    </p>

    <ol v-else class="mb-items" data-testid="items">
      <li v-for="item in items" :key="`${item._from}-${item.item_id}`" class="mb-entry">
        <p class="mb-entry-top">
          <span v-if="isNew(item)" class="mb-badge" data-testid="new-badge">
            {{ $t('briefings.new') }}
          </span>
          <!-- The source tag: which briefing produced this. -->
          <span class="mb-source" data-testid="source-tag">{{ item._from }}</span>
        </p>
        <a :href="item.link" target="_blank" rel="noopener noreferrer">{{ item.title }}</a>
        <p v-if="item.summary" class="mb-entry-summary">{{ item.summary }}</p>
        <p class="mb-entry-meta">
          <time>{{ fmtDate(item.item_time) }}</time>
          <span v-for="r in item.nuts" :key="r" class="mb-chip">{{ r }}</span>
          <span v-if="item.rank_value" class="mb-value">{{ fmtValue(item.rank_value) }}</span>
        </p>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.mb { max-width: 820px; margin: 0 auto; padding: 0 1rem 4rem; }
.mb-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.25rem; }
.mb-header h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
.mb-new-count { font-size: 0.85rem; color: var(--accent); margin: 0.3rem 0 0; font-weight: 600; }
.mb-muted { color: var(--muted); font-size: 0.9rem; }
.mb-error { color: #c0392b; font-size: 0.85rem; }
.mb-btn { font: inherit; font-size: 0.86rem; padding: 0.45rem 0.9rem; border-radius: 8px; border: 1px solid var(--border); background: var(--surface, #f6f8fa); color: inherit; text-decoration: none; white-space: nowrap; }
.mb-primary { border-color: var(--accent); color: var(--accent); font-weight: 600; display: inline-block; margin-top: 0.8rem; }
.mb-items { list-style: none; margin: 0; padding: 0; display: grid; gap: 1rem; }
.mb-entry { border-bottom: 1px solid var(--border); padding-bottom: 0.9rem; }
.mb-entry-top { display: flex; gap: 0.5rem; align-items: center; margin: 0 0 0.2rem; }
.mb-badge { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--accent); border: 1px solid var(--accent); border-radius: 999px; padding: 0.05rem 0.45rem; }
.mb-source { font-size: 0.72rem; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 0.05rem 0.45rem; }
.mb-entry a { font-weight: 600; font-size: 0.98rem; color: var(--text); text-decoration: none; }
.mb-entry a:hover { color: var(--accent); text-decoration: underline; }
.mb-entry-summary { font-size: 0.85rem; color: var(--muted); margin: 0.25rem 0 0; }
.mb-entry-meta { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; font-size: 0.75rem; color: var(--muted); margin: 0.35rem 0 0; }
.mb-chip { font-size: 0.72rem; padding: 0.05rem 0.4rem; border: 1px solid var(--border); border-radius: 999px; }
.mb-value { font-variant-numeric: tabular-nums; }
</style>
