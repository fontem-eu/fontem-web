<script setup>
/**
 * The reader: everything new across the briefings you watch.
 *
 * Deliberately NOT a feed-reader library. The items arrive from our own API
 * as JSON, so there is no XML to parse and nothing to gain from pulling a
 * reader engine in — and our CSP forbids eval, which is where most of them
 * fall over. The open-source win here is the other direction: every watch
 * exposes a standard Atom URL, so anyone who already has a reader they like
 * can use it instead of this page.
 *
 * "New" is per-visit and stored locally rather than server-side. A read
 * marker is not something worth a round trip or a row, and keeping it in the
 * browser means we do not have to decide what "read" means across devices.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { listMyWatches, getBriefing, listBriefings } from '../api/community.js'

const { t } = useI18n()

const SEEN_KEY = 'fontem-briefings-last-visit'

const watches = ref([])
const briefings = ref([])
const items = ref([])
const loading = ref(true)
const error = ref(null)
const copied = ref('')
const lastVisit = ref(null)

// Watches carry group_id; the catalogue is keyed by slug. Resolving here
// keeps the API honest (a watch is not a briefing) without making the page
// ask for a lookup it can do itself.
const watchedBriefings = computed(() => watches.value.map((w) => ({
  watch: w,
  briefing: briefings.value.find((b) => b.id === w.group_id)
    || { name: t('briefings.a_briefing'), slug: '' },
})))

const newCount = computed(
  () => items.value.filter((i) => isNew(i)).length,
)

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
    const perWatch = await Promise.all(watchedBriefings.value.map(async ({ watch, briefing }) => {
      if (!briefing.slug) return []
      const detail = await getBriefing(briefing.slug,
        { nuts: watch.nuts, volume: watch.volume_per_week })
      return detail.items.map((i) => ({ ...i, _briefing: briefing.name }))
    }))
    items.value = perWatch.flat().sort(
      (a, b) => new Date(b.item_time) - new Date(a.item_time),
    )
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function copyFeed(url) {
  try {
    await navigator.clipboard.writeText(url)
    copied.value = url
    setTimeout(() => { copied.value = '' }, 2000)
  } catch {
    error.value = t('briefings.copy_failed')
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
      <router-link to="/briefings" class="mb-btn">{{ $t('briefings.browse_all') }}</router-link>
    </header>

    <p v-if="error" class="mb-error" data-testid="error">{{ error }}</p>
    <p v-if="loading" class="mb-muted">{{ $t('app.loading') }}</p>

    <template v-else-if="!watches.length">
      <p class="mb-muted" data-testid="nothing-watched">{{ $t('briefings.watch_nothing_yet') }}</p>
      <router-link to="/briefings" class="mb-btn mb-primary">
        {{ $t('briefings.browse_all') }}
      </router-link>
    </template>

    <template v-else>
      <!-- The feeds, so a real reader can take over from this page. -->
      <section class="mb-feeds" data-testid="feeds">
        <h2>{{ $t('briefings.your_feeds') }}</h2>
        <p class="mb-muted">{{ $t('briefings.feeds_hint') }}</p>
        <ul class="mb-feed-list">
          <li v-for="{ watch, briefing } in watchedBriefings" :key="watch.id">
            <span class="mb-feed-name">{{ briefing.name }}</span>
            <span class="mb-chips">
              <span v-for="r in watch.nuts" :key="r" class="mb-chip">{{ r }}</span>
              <span class="mb-chip">{{ $t('briefings.n_a_week', { n: watch.volume_per_week }) }}</span>
            </span>
            <button
              class="mb-copy" :data-testid="`copy-${watch.id}`" @click="copyFeed(watch.feed_url)"
            >{{ copied === watch.feed_url ? $t('briefings.copied') : $t('briefings.copy_feed') }}</button>
          </li>
        </ul>
      </section>

      <p v-if="!items.length" class="mb-muted" data-testid="no-items">
        {{ $t('briefings.nothing_new') }}
      </p>
      <ol v-else class="mb-items" data-testid="items">
        <li v-for="item in items" :key="`${item._briefing}-${item.item_id}`" class="mb-entry">
          <p class="mb-entry-top">
            <span v-if="isNew(item)" class="mb-badge" data-testid="new-badge">
              {{ $t('briefings.new') }}
            </span>
            <span class="mb-source">{{ item._briefing }}</span>
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
    </template>
  </div>
</template>

<style scoped>
.mb { max-width: 900px; margin: 0 auto; padding: 0 1rem 4rem; }
.mb-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.25rem; }
.mb-header h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
.mb-new-count { font-size: 0.85rem; color: var(--accent); margin: 0.3rem 0 0; font-weight: 600; }
.mb-muted { color: var(--muted); font-size: 0.9rem; }
.mb-error { color: #c0392b; font-size: 0.85rem; }
.mb-btn { font: inherit; font-size: 0.88rem; padding: 0.45rem 0.9rem; border-radius: 8px; border: 1px solid var(--border); background: var(--surface, #f6f8fa); color: inherit; text-decoration: none; white-space: nowrap; }
.mb-primary { border-color: var(--accent); color: var(--accent); font-weight: 600; display: inline-block; margin-top: 0.8rem; }
.mb-feeds { border: 1px solid var(--border); border-radius: 10px; padding: 0.9rem 1rem; margin-bottom: 1.5rem; }
.mb-feeds h2 { font-size: 1rem; margin: 0 0 0.2rem; }
.mb-feed-list { list-style: none; margin: 0.6rem 0 0; padding: 0; display: grid; gap: 0.5rem; }
.mb-feed-list li { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; font-size: 0.88rem; }
.mb-feed-name { font-weight: 600; flex: 1; }
.mb-chips { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.mb-chip { font-size: 0.72rem; padding: 0.05rem 0.4rem; border: 1px solid var(--border); border-radius: 999px; color: var(--muted); }
.mb-copy { font: inherit; font-size: 0.78rem; padding: 0.25rem 0.6rem; border: 1px solid var(--border); border-radius: 7px; background: none; color: var(--accent); cursor: pointer; }
.mb-items { list-style: none; margin: 0; padding: 0; display: grid; gap: 1rem; }
.mb-entry { border-bottom: 1px solid var(--border); padding-bottom: 0.9rem; }
.mb-entry-top { display: flex; gap: 0.5rem; align-items: center; margin: 0 0 0.2rem; }
.mb-badge { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--accent); border: 1px solid var(--accent); border-radius: 999px; padding: 0.05rem 0.45rem; }
.mb-source { font-size: 0.75rem; color: var(--muted); }
.mb-entry a { font-weight: 600; font-size: 0.98rem; color: var(--text); text-decoration: none; }
.mb-entry a:hover { color: var(--accent); text-decoration: underline; }
.mb-entry-summary { font-size: 0.85rem; color: var(--muted); margin: 0.25rem 0 0; }
.mb-entry-meta { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; font-size: 0.75rem; color: var(--muted); margin: 0.35rem 0 0; }
.mb-value { font-variant-numeric: tabular-nums; }
</style>
