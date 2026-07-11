<script setup>
/**
 * Unified search results page.
 *
 * Reached by submitting the header search bar (Enter / the search button).
 * Fans out to the graph API (companies, public bodies, people, lobbyists,
 * contracts, cohesion projects, sanctioned entities) and the community API
 * (public data stories) in parallel, and renders a single faceted result
 * list. All filter state lives in the URL query so a search is shareable and
 * survives back/forward.
 *
 * Advanced filters: entity-type facets, a NUTS region (code prefix), and a
 * created/published date range. The region picker is seeded from the NUTS-0
 * boundaries today; it deepens once NUTS 1-3 land in the graph.
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { searchGraph, searchStories } from '../api/search.js'
import { fetchBoundaries } from '../api/geo.js'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const GRAPH_TYPES = ['company', 'authority', 'person', 'lobbyist', 'contract', 'cohesion', 'sanction']
const ALL_TYPES = [...GRAPH_TYPES, 'story']
const LIMIT = 20

function parseTypes(v) {
  if (!v) return [...ALL_TYPES]
  const wanted = String(v).split(',').filter(Boolean)
  const picked = ALL_TYPES.filter((x) => wanted.includes(x))
  return picked.length ? picked : [...ALL_TYPES]
}

const query = ref(route.query.q || '')
const selectedTypes = ref(parseTypes(route.query.types))
const region = ref(route.query.nuts || '')
const dateFrom = ref(route.query.date_from || '')
const dateTo = ref(route.query.date_to || '')
const showAdvanced = ref(Boolean(route.query.nuts || route.query.date_from || route.query.date_to))

const graphResults = ref([])
const storyResults = ref([])
const counts = ref({})
const loading = ref(false)
const error = ref('')
const hasMore = ref(false)
const offset = ref(0)
const regions = ref([])

const submittedQuery = computed(() => route.query.q || '')

// Data stories, normalised into the same shape the graph results use so the
// card list can render them uniformly. Shown first — they're editorial.
const merged = computed(() => {
  const stories = storyResults.value.map((s) => ({
    type: 'story',
    id: s.id,
    title: s.title,
    subtitle: s.abstract || '',
    date: s.created_at || s.updated_at || null,
    country: null,
  }))
  return [...stories, ...graphResults.value]
})

const typeCount = (tp) => counts.value[tp] ?? 0

function routeLink(r) {
  if (r.type === 'company') return `/company/${encodeURIComponent(r.id)}`
  if (r.type === 'contract') return `/contract/${encodeURIComponent(r.id)}`
  if (r.type === 'story') return `/stories/${encodeURIComponent(r.id)}`
  return null // authority/lobbyist/person/cohesion/sanction have no detail page yet
}

async function runSearch(reset = true) {
  const q = submittedQuery.value
  if (!q) { graphResults.value = []; storyResults.value = []; counts.value = {}; return }
  if (reset) offset.value = 0
  loading.value = true
  error.value = ''
  try {
    const graphTypes = selectedTypes.value.filter((x) => GRAPH_TYPES.includes(x))
    // A region filter is a geo narrowing; stories have no geography, so they
    // drop out of a region-filtered search (mirrors the graph backend).
    const wantStories = selectedTypes.value.includes('story') && !region.value
    const [g, s] = await Promise.all([
      graphTypes.length
        ? searchGraph({
          q, types: graphTypes, nuts: region.value || undefined,
          dateFrom: dateFrom.value || undefined, dateTo: dateTo.value || undefined,
          limit: LIMIT, offset: offset.value,
        })
        : Promise.resolve({ results: [], counts: {}, has_more: false }),
      wantStories
        ? searchStories({
          q, dateFrom: dateFrom.value || undefined, dateTo: dateTo.value || undefined,
          limit: LIMIT, offset: offset.value,
        })
        : Promise.resolve([]),
    ])
    if (reset) {
      graphResults.value = g.results || []
      storyResults.value = s || []
    } else {
      graphResults.value = [...graphResults.value, ...(g.results || [])]
      storyResults.value = [...storyResults.value, ...(s || [])]
    }
    counts.value = { ...(g.counts || {}), story: (s || []).length }
    hasMore.value = Boolean(g.has_more) || (s || []).length >= LIMIT
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}

function applyToUrl() {
  const q = {}
  if (query.value.trim()) q.q = query.value.trim()
  if (selectedTypes.value.length && selectedTypes.value.length < ALL_TYPES.length) {
    q.types = selectedTypes.value.join(',')
  }
  if (region.value) q.nuts = region.value
  if (dateFrom.value) q.date_from = dateFrom.value
  if (dateTo.value) q.date_to = dateTo.value
  router.push({ path: '/search', query: q })
}

function onSubmit() { applyToUrl() }

function toggleType(tp) {
  const s = new Set(selectedTypes.value)
  if (s.has(tp)) s.delete(tp)
  else s.add(tp)
  selectedTypes.value = ALL_TYPES.filter((x) => s.has(x))
  applyToUrl()
}

function loadMore() {
  offset.value += LIMIT
  runSearch(false)
}

function clearFilters() {
  selectedTypes.value = [...ALL_TYPES]
  region.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  applyToUrl()
}

watch(() => route.query, () => {
  query.value = route.query.q || ''
  selectedTypes.value = parseTypes(route.query.types)
  region.value = route.query.nuts || ''
  dateFrom.value = route.query.date_from || ''
  dateTo.value = route.query.date_to || ''
  runSearch(true)
})

onMounted(async () => {
  runSearch(true)
  try {
    const geo = await fetchBoundaries(0)
    regions.value = (geo?.features || [])
      .map((f) => ({
        code: f.properties?.code || f.properties?.NUTS_ID || f.id,
        name: f.properties?.name || f.properties?.NAME_LATN || f.properties?.code || f.id,
      }))
      .filter((r) => r.code)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
  } catch { /* region picker is optional — the code input still works */ }
})
</script>

<template>
  <main class="search-view" data-testid="search-view">
    <form class="search-hero" @submit.prevent="onSubmit">
      <input
        v-model="query"
        type="search"
        class="search-hero-input"
        data-testid="search-input"
        :placeholder="t('search.placeholder')"
        :aria-label="t('search.placeholder')"
      />
      <button type="submit" class="btn-primary" data-testid="search-submit">
        {{ t('search.button') }}
      </button>
    </form>

    <p v-if="submittedQuery" class="search-summary" data-testid="search-summary">
      {{ t('search.results_for') }} <strong>“{{ submittedQuery }}”</strong>
    </p>

    <div class="search-body">
      <aside class="search-facets" data-testid="search-facets">
        <h2 class="facets-title">{{ t('search.filter_by_type') }}</h2>
        <ul class="facet-list">
          <li v-for="tp in ALL_TYPES" :key="tp">
            <label class="facet-check">
              <input
                type="checkbox"
                :checked="selectedTypes.includes(tp)"
                :data-testid="`facet-${tp}`"
                @change="toggleType(tp)"
              />
              <span class="facet-name">{{ t(`search.type.${tp}`) }}</span>
              <span class="facet-count">{{ typeCount(tp) }}</span>
            </label>
          </li>
        </ul>

        <button
          type="button"
          class="advanced-toggle"
          data-testid="advanced-toggle"
          :aria-expanded="showAdvanced"
          @click="showAdvanced = !showAdvanced"
        >
          {{ showAdvanced ? '▾' : '▸' }} {{ t('search.advanced') }}
        </button>

        <div v-if="showAdvanced" class="advanced-drawer" data-testid="advanced-drawer">
          <label class="adv-field">
            <span>{{ t('search.region') }}</span>
            <input
              v-model="region"
              list="search-nuts-list"
              class="adv-input"
              data-testid="adv-region"
              :placeholder="t('search.region_hint')"
              @change="applyToUrl"
            />
            <datalist id="search-nuts-list">
              <option v-for="r in regions" :key="r.code" :value="r.code">{{ r.name }}</option>
            </datalist>
          </label>
          <label class="adv-field">
            <span>{{ t('search.date_from') }}</span>
            <input v-model="dateFrom" type="date" class="adv-input" data-testid="adv-date-from" @change="applyToUrl" />
          </label>
          <label class="adv-field">
            <span>{{ t('search.date_to') }}</span>
            <input v-model="dateTo" type="date" class="adv-input" data-testid="adv-date-to" @change="applyToUrl" />
          </label>
          <button type="button" class="clear-filters" data-testid="clear-filters" @click="clearFilters">
            {{ t('search.clear_filters') }}
          </button>
        </div>
      </aside>

      <section class="search-results" data-testid="search-results">
        <p v-if="error" class="search-error" data-testid="search-error">{{ error }}</p>
        <p v-else-if="loading && !merged.length" class="search-status">{{ t('search.loading') }}</p>
        <p v-else-if="submittedQuery && !merged.length" class="search-status" data-testid="search-empty">
          {{ t('search.no_results') }}
        </p>

        <ul v-if="merged.length" class="result-list">
          <li v-for="(r, i) in merged" :key="`${r.type}-${r.id}-${i}`" class="result-card" :data-testid="`result-${r.type}`">
            <span class="result-type" :class="`type-${r.type}`">{{ t(`search.type.${r.type}`) }}</span>
            <div class="result-body">
              <component
                :is="routeLink(r) ? 'RouterLink' : 'span'"
                :to="routeLink(r) || undefined"
                class="result-title"
              >{{ r.title }}</component>
              <p v-if="r.subtitle" class="result-subtitle">{{ r.subtitle }}</p>
              <p class="result-meta">
                <span v-if="r.country" class="result-country">{{ r.country }}</span>
                <span v-if="r.date" class="result-date">{{ r.date }}</span>
              </p>
            </div>
          </li>
        </ul>

        <button
          v-if="hasMore && merged.length"
          type="button"
          class="load-more"
          data-testid="load-more"
          :disabled="loading"
          @click="loadMore"
        >
          {{ loading ? t('search.loading') : t('search.load_more') }}
        </button>
      </section>
    </div>
  </main>
</template>

<style scoped>
.search-view { max-width: 1000px; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
.search-hero { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
.search-hero-input {
  flex: 1; padding: 0.7rem 0.9rem; font-size: 1rem;
  border: 1px solid var(--border); border-radius: 10px; background: var(--surface, transparent); color: var(--text);
}
.btn-primary {
  padding: 0.7rem 1.2rem; border: none; border-radius: 10px; cursor: pointer;
  background: var(--accent); color: #fff; font-weight: 600;
}
.search-summary { color: var(--text); font-size: 0.95rem; margin: 0 0 1rem; }
.search-body { display: flex; gap: 1.5rem; align-items: flex-start; }
.search-facets { flex: 0 0 220px; }
.facets-title { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text); opacity: 0.7; margin: 0 0 0.5rem; }
.facet-list { list-style: none; padding: 0; margin: 0 0 1rem; display: flex; flex-direction: column; gap: 0.3rem; }
.facet-check { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer; }
.facet-name { flex: 1; }
.facet-count { opacity: 0.6; font-variant-numeric: tabular-nums; font-size: 0.82rem; }
.advanced-toggle, .clear-filters, .load-more {
  background: none; border: 1px solid var(--border); border-radius: 8px;
  padding: 0.45rem 0.7rem; cursor: pointer; color: var(--text); font-size: 0.85rem;
}
.advanced-toggle { width: 100%; text-align: left; margin-bottom: 0.5rem; }
.advanced-drawer { display: flex; flex-direction: column; gap: 0.6rem; border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem; }
.adv-field { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.82rem; }
.adv-input { padding: 0.4rem 0.5rem; border: 1px solid var(--border); border-radius: 6px; background: var(--surface, transparent); color: var(--text); }
.clear-filters { margin-top: 0.25rem; }
.search-results { flex: 1; min-width: 0; }
.search-status, .search-error { color: var(--text); opacity: 0.8; }
.search-error { color: #c0392b; opacity: 1; }
.result-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.result-card { display: flex; gap: 0.75rem; padding: 0.85rem; border: 1px solid var(--border); border-radius: 10px; background: var(--surface, transparent); }
.result-type { flex: 0 0 auto; align-self: flex-start; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em; padding: 0.15rem 0.45rem; border-radius: 6px; background: var(--accent); color: #fff; opacity: 0.9; }
.result-body { min-width: 0; }
.result-title { font-weight: 600; color: var(--text); text-decoration: none; }
a.result-title:hover { color: var(--accent); text-decoration: underline; }
.result-subtitle { margin: 0.2rem 0 0; font-size: 0.88rem; opacity: 0.85; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.result-meta { margin: 0.3rem 0 0; font-size: 0.8rem; opacity: 0.65; display: flex; gap: 0.75rem; }
.load-more { margin-top: 1rem; width: 100%; }
@media (max-width: 700px) { .search-body { flex-direction: column; } .search-facets { flex-basis: auto; width: 100%; } }
</style>
