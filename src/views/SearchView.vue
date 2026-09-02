<script setup>
/**
 * Unified search results page.
 *
 * Reached by submitting the header search bar. Fans out to the graph API
 * (companies, public bodies, people, lobbyists, contracts, cohesion projects,
 * sanctioned entities) and the community API (public data stories) in
 * parallel, and renders one faceted result list. All filter state lives in
 * the URL query so a search is shareable and survives back/forward.
 *
 * Advanced search (tucked behind a toggle): entity-type facets, a cascading
 * NUTS region picker (one selector per level, each gated on the level above),
 * and a date range.
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { searchGraph, searchStories } from '../api/search.js'
import NutsRegionPicker from '../components/NutsRegionPicker.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const GRAPH_TYPES = ['company', 'authority', 'person', 'lobbyist', 'contract', 'cohesion', 'sanction', 'legislation']
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
const regionCode = ref(route.query.nuts || '')
const dateFrom = ref(route.query.date_from || '')
const dateTo = ref(route.query.date_to || '')
const showAdvanced = ref(Boolean(route.query.nuts || route.query.date_from
  || route.query.date_to || (route.query.types && parseTypes(route.query.types).length < ALL_TYPES.length)))

const graphResults = ref([])
const storyResults = ref([])
const counts = ref({})
const loading = ref(false)
const error = ref('')
const hasMore = ref(false)
const offset = ref(0)

const submittedQuery = computed(() => route.query.q || '')

// The active region filter (a single NUTS code from the cascading picker).
const activeNuts = computed(() => regionCode.value)

function onRegionPicked(code) {
  regionCode.value = code || ''
  applyToUrl()
}

const merged = computed(() => {
  const stories = storyResults.value.map((s) => ({
    type: 'story',
    id: s.id,
    title: s.title,
    subtitle: s.abstract || '',
    context: '',
    date: s.created_at || s.updated_at || null,
    country: null,
  }))
  return [...stories, ...graphResults.value]
})

const typeCount = (tp) => counts.value[tp] ?? 0

const EUR = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 })

// The contextual line shown under a card: the backend `context` where present,
// else a formatted contract value.
function cardContext(r) {
  if (r.context) return r.context
  if (r.type === 'contract' && r.meta?.value_eur) return EUR.format(r.meta.value_eur)
  return ''
}

function withScheme(u) {
  return /^https?:\/\//i.test(u) ? u : `https://${u}`
}

// Where a result card links to. Internal detail pages return { to }; external
// sources (a lobbyist's site, a legal act on EUR-Lex) return { href, external }.
// Types with no destination (person, sanction) return null → non-clickable.
function cardLink(r) {
  // Both land on the full entity page — profile, graph, financials,
  // procurement, business map. Companies used to go to a thinner
  // one-off view with only contracts and cohesion grants on it, and
  // authorities to the ticker-shaped URL; the semantic URLs now render
  // the same page, so a search result reaches everything known about
  // the entity.
  if (r.type === 'company') return { to: `/company/${encodeURIComponent(r.id)}` }
  if (r.type === 'authority') return { to: `/authority/${encodeURIComponent(r.id)}` }
  if (r.type === 'contract') return { to: `/contract/${encodeURIComponent(r.id)}` }
  if (r.type === 'story') return { to: `/stories/${encodeURIComponent(r.id)}` }
  // a cohesion project links to the company that received the money
  if (r.type === 'cohesion' && r.meta?.company_gmr_id) {
    return { to: `/company/${encodeURIComponent(r.meta.company_gmr_id)}` }
  }
  // legislation → the act's authentic text on EUR-Lex (mirror provenance)
  if (r.type === 'legislation' && r.meta?.eurlex_url) {
    return { href: r.meta.eurlex_url, external: true }
  }
  // lobbyist → its EU-transparency-register-declared website
  if (r.type === 'lobbyist' && r.meta?.url) {
    return { href: withScheme(r.meta.url), external: true }
  }
  return null
}

// The tag + attributes to render the whole card as its link.
function cardTag(r) {
  const l = cardLink(r)
  return l ? (l.external ? 'a' : 'RouterLink') : 'div'
}
function cardBind(r) {
  const l = cardLink(r)
  if (!l) return {}
  if (l.external) {
    return {
      href: l.href, target: '_blank', rel: 'noopener noreferrer nofollow',
      'data-testid': 'result-external-link',
    }
  }
  return { to: l.to }
}

async function runSearch(reset = true) {
  const q = submittedQuery.value
  if (!q) { graphResults.value = []; storyResults.value = []; counts.value = {}; return }
  if (reset) offset.value = 0
  loading.value = true
  error.value = ''
  try {
    const graphTypes = selectedTypes.value.filter((x) => GRAPH_TYPES.includes(x))
    const region = activeNuts.value
    // A region filter is a geo narrowing; stories have no geography, so they
    // drop out of a region-filtered search (mirrors the graph backend).
    const wantStories = selectedTypes.value.includes('story') && !region
    const [g, s] = await Promise.all([
      graphTypes.length
        ? searchGraph({
          q, types: graphTypes, nuts: region || undefined,
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
  if (activeNuts.value) q.nuts = activeNuts.value
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
  regionCode.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  applyToUrl()
}

watch(() => route.query, () => {
  query.value = route.query.q || ''
  selectedTypes.value = parseTypes(route.query.types)
  regionCode.value = route.query.nuts || ''
  dateFrom.value = route.query.date_from || ''
  dateTo.value = route.query.date_to || ''
  runSearch(true)
})

onMounted(() => {
  runSearch(true)
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
          <div class="adv-group">
            <span class="adv-group-title">{{ t('search.filter_by_type') }}</span>
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
          </div>

          <div class="adv-group">
            <span class="adv-group-title">{{ t('search.region') }}</span>
            <NutsRegionPicker :model-value="regionCode" @update:model-value="onRegionPicked" />
          </div>

          <div class="adv-group">
            <label class="adv-field">
              <span>{{ t('search.date_from') }}</span>
              <input v-model="dateFrom" type="date" class="adv-input" data-testid="adv-date-from" @change="applyToUrl" />
            </label>
            <label class="adv-field">
              <span>{{ t('search.date_to') }}</span>
              <input v-model="dateTo" type="date" class="adv-input" data-testid="adv-date-to" @change="applyToUrl" />
            </label>
          </div>

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
          <li v-for="(r, i) in merged" :key="`${r.type}-${r.id}-${i}`" :data-testid="`result-${r.type}`">
            <component
              :is="cardTag(r)"
              v-bind="cardBind(r)"
              class="result-card"
              :class="{ 'result-card--link': cardLink(r) }"
            >
              <span class="result-type" :class="`type-${r.type}`">{{ t(`search.type.${r.type}`) }}</span>
              <div class="result-body">
                <span class="result-title">
                  {{ r.title }}
                  <span v-if="cardLink(r)?.external" class="result-ext" aria-hidden="true">↗</span>
                </span>
                <p v-if="r.subtitle" class="result-subtitle">{{ r.subtitle }}</p>
                <p v-if="cardContext(r)" class="result-context" data-testid="result-context">{{ cardContext(r) }}</p>
                <p class="result-meta">
                  <span v-if="r.country" class="result-country">{{ r.country }}</span>
                  <span v-if="r.date" class="result-date">{{ r.date }}</span>
                </p>
              </div>
            </component>
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
.search-facets { flex: 0 0 240px; }
.advanced-toggle, .clear-filters, .load-more {
  background: none; border: 1px solid var(--border); border-radius: 8px;
  padding: 0.5rem 0.75rem; cursor: pointer; color: var(--text); font-size: 0.88rem;
}
.advanced-toggle { width: 100%; text-align: left; font-weight: 600; }
.advanced-drawer { margin-top: 0.5rem; display: flex; flex-direction: column; gap: 1rem; border: 1px solid var(--border); border-radius: 10px; padding: 0.85rem; }
.adv-group { display: flex; flex-direction: column; gap: 0.4rem; }
.adv-group-title { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.03em; opacity: 0.65; }
.facet-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.facet-check { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer; }
.facet-name { flex: 1; }
.facet-count { opacity: 0.6; font-variant-numeric: tabular-nums; font-size: 0.82rem; }
.adv-field { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.82rem; }
.adv-input { padding: 0.4rem 0.5rem; border: 1px solid var(--border); border-radius: 6px; background: var(--surface, transparent); color: var(--text); width: 100%; }
.adv-input:disabled { opacity: 0.45; cursor: not-allowed; }
.clear-filters { align-self: flex-start; }
.search-results { flex: 1; min-width: 0; }
.search-status, .search-error { color: var(--text); opacity: 0.8; }
.search-error { color: #c0392b; opacity: 1; }
.result-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.result-card { display: flex; gap: 0.75rem; padding: 0.85rem; border: 1px solid var(--border); border-radius: 10px; background: var(--surface, transparent); color: var(--text); text-decoration: none; }
.result-card--link { cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease; }
.result-card--link:hover { border-color: var(--accent); background: var(--surface-hover, rgba(127, 127, 127, 0.06)); box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06); }
.result-card--link:hover .result-title { color: var(--accent); }
.result-card--link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.result-type { flex: 0 0 auto; align-self: flex-start; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em; padding: 0.15rem 0.45rem; border-radius: 6px; background: var(--accent); color: #fff; opacity: 0.9; }
.result-body { min-width: 0; }
.result-title { font-weight: 600; color: var(--text); text-decoration: none; }
.result-ext { font-size: 0.85em; opacity: 0.65; margin-left: 0.15rem; }
.result-subtitle { margin: 0.2rem 0 0; font-size: 0.88rem; opacity: 0.85; }
.result-context { margin: 0.25rem 0 0; font-size: 0.85rem; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.result-meta { margin: 0.3rem 0 0; font-size: 0.8rem; opacity: 0.6; display: flex; gap: 0.75rem; }
.load-more { margin-top: 1rem; width: 100%; }
@media (max-width: 700px) { .search-body { flex-direction: column; } .search-facets { flex-basis: auto; width: 100%; } }
</style>
