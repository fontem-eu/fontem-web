<script setup>
/**
 * Petitions showcase — a curated, two-section view of European Citizens'
 * Initiatives (no status filter chips):
 *
 *  1. "Collecting signatures" — ONGOING initiatives, most-supported first.
 *  2. "Reached the required signatures" — SUBMITTED / VERIFICATION / ANSWERED
 *     (states an ECI only enters after a successful 1,000,000+ collection),
 *     most-recently-registered first.
 *
 * Each section paginates independently with its own "Show more" button,
 * following the load-more pattern used by SearchView.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchPetitions } from '../api/petitions.js'

const { t } = useI18n()
const NUM = new Intl.NumberFormat()

// Status sets + page sizes for each section.
const COLLECTING_STATUSES = 'ONGOING'
const REACHED_STATUSES = 'SUBMITTED,VERIFICATION,ANSWERED'
const COLLECTING_PAGE = 3
const REACHED_PAGE = 5

const error = ref('')

const collecting = ref([])
const collectingOffset = ref(0)
const collectingHasMore = ref(false)
const collectingLoading = ref(false)

const reached = ref([])
const reachedOffset = ref(0)
const reachedHasMore = ref(false)
const reachedLoading = ref(false)

function statusLabel(s) {
  const key = `petitions.status.${s.toLowerCase()}`
  const label = t(key)
  return label === key ? s : label
}

async function loadCollecting(reset = true) {
  if (reset) collectingOffset.value = 0
  collectingLoading.value = true
  try {
    const data = await fetchPetitions({
      statuses: COLLECTING_STATUSES,
      sort: 'supporters',
      limit: COLLECTING_PAGE,
      offset: collectingOffset.value,
    })
    const rows = data.results || []
    collecting.value = reset ? rows : [...collecting.value, ...rows]
    collectingHasMore.value = rows.length >= COLLECTING_PAGE
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    collectingLoading.value = false
  }
}

async function loadReached(reset = true) {
  if (reset) reachedOffset.value = 0
  reachedLoading.value = true
  try {
    const data = await fetchPetitions({
      statuses: REACHED_STATUSES,
      sort: 'recent',
      limit: REACHED_PAGE,
      offset: reachedOffset.value,
    })
    const rows = data.results || []
    reached.value = reset ? rows : [...reached.value, ...rows]
    reachedHasMore.value = rows.length >= REACHED_PAGE
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    reachedLoading.value = false
  }
}

function loadMoreCollecting() {
  collectingOffset.value += COLLECTING_PAGE
  loadCollecting(false)
}

function loadMoreReached() {
  reachedOffset.value += REACHED_PAGE
  loadReached(false)
}

// A uniform descriptor per section so the template renders both with one loop.
const sections = computed(() => [
  {
    key: 'collecting',
    title: t('petitions.collecting'),
    items: collecting.value,
    hasMore: collectingHasMore.value,
    loading: collectingLoading.value,
    loadMore: loadMoreCollecting,
  },
  {
    key: 'reached',
    title: t('petitions.reached'),
    items: reached.value,
    hasMore: reachedHasMore.value,
    loading: reachedLoading.value,
    loadMore: loadMoreReached,
  },
])

onMounted(() => {
  loadCollecting(true)
  loadReached(true)
})
</script>

<template>
  <main class="petitions-view" data-testid="petitions-view">
    <header class="pt-head">
      <h1>{{ t('petitions.title') }}</h1>
      <p class="pt-sub">{{ t('petitions.subtitle') }}</p>
    </header>

    <p v-if="error" class="pt-error" data-testid="petitions-error">{{ error }}</p>

    <section
      v-for="sec in sections"
      :key="sec.key"
      class="pt-section"
      :data-testid="`section-${sec.key}`"
    >
      <h2 class="pt-section-title">{{ sec.title }}</h2>

      <p
        v-if="!sec.items.length && sec.loading"
        class="pt-status"
      >{{ t('petitions.loading') }}</p>
      <p
        v-else-if="!sec.items.length"
        class="pt-status"
        :data-testid="`empty-${sec.key}`"
      >{{ t('petitions.empty') }}</p>

      <ul v-else class="pt-list">
        <li
          v-for="r in sec.items"
          :key="r.petition_id"
          class="pt-card"
          data-testid="petition-card"
        >
          <RouterLink
            class="pt-title"
            :to="`/petitions/${encodeURIComponent(r.petition_id)}`"
          >{{ r.title || r.petition_id }}</RouterLink>
          <div class="pt-meta">
            <span class="pt-badge" :data-status="r.status">{{ statusLabel(r.status) }}</span>
            <span class="pt-supporters" data-testid="petition-supporters">
              {{ NUM.format(r.total_supporters || 0) }} {{ t('petitions.supporters') }}
            </span>
            <span v-if="r.registration_date" class="pt-date">{{ r.registration_date }}</span>
          </div>
        </li>
      </ul>

      <button
        v-if="sec.hasMore"
        type="button"
        class="pt-more"
        :data-testid="`show-more-${sec.key}`"
        :disabled="sec.loading"
        @click="sec.loadMore()"
      >
        {{ sec.loading ? t('petitions.loading') : t('petitions.show_more') }}
      </button>
    </section>
  </main>
</template>

<style scoped>
.petitions-view { max-width: 900px; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
.pt-head h1 { margin: 0 0 0.25rem; }
.pt-sub { color: var(--text); opacity: 0.7; margin: 0 0 1.5rem; }
.pt-section { margin-bottom: 2rem; }
.pt-section-title { font-size: 1.15rem; margin: 0 0 0.75rem; }
.pt-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.pt-card { border: 1px solid var(--border); border-radius: 10px; padding: 0.85rem; background: var(--surface, transparent); }
.pt-title { font-weight: 600; color: var(--text); text-decoration: none; }
.pt-title:hover { color: var(--accent); text-decoration: underline; }
.pt-meta { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.4rem; font-size: 0.85rem; align-items: center; }
.pt-badge {
  text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.03em;
  border: 1px solid var(--border); border-radius: 6px; padding: 0.1rem 0.4rem; opacity: 0.85;
}
.pt-badge[data-status="ANSWERED"] { border-color: var(--accent); color: var(--accent); }
.pt-supporters { font-variant-numeric: tabular-nums; }
.pt-date, .pt-status { opacity: 0.65; }
.pt-more {
  margin-top: 1rem; width: 100%; background: none; border: 1px solid var(--border);
  border-radius: 8px; padding: 0.5rem 0.75rem; cursor: pointer; color: var(--text); font-size: 0.88rem;
}
.pt-more:disabled { opacity: 0.5; cursor: not-allowed; }
.pt-error { color: #c0392b; }
</style>
