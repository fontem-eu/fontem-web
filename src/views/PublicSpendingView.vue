<script setup>
/**
 * Public Spending — the procurement-graph entry point.
 *
 * Three panels:
 *   1. A centered search card (the old "search-as-the-product"
 *      home, now scoped to its own tab).
 *   2. Top companies HQ'd in the user's country, ranked by total
 *      contract value won.
 *   3. Top authorities in the user's country, ranked by total
 *      contract value awarded.
 *
 * Country comes from a best-effort GeoIP lookup on the API side.
 * If detection fails (DB missing, IP not in range), the panels
 * gracefully degrade to a country picker.
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import TickerSearch from '../components/TickerSearch.vue'
import Wordmark from '../components/Wordmark.vue'
import { useAnalytics } from '../composables/useAnalytics.js'
import { fetchMyCountry, fetchRecommendations } from '../api/euroTracker.js'

const router = useRouter()
const { track } = useAnalytics()

// EU + EFTA + UK alpha-3 list, used by the picker. Hardcoded
// because: (a) it's stable, (b) avoids a round-trip just to seed
// a dropdown, (c) we don't want the picker to surface every ISO
// country — the recommendations only know about EU procurement.
const COUNTRIES = [
  { a3: 'AUT', name: 'Austria' },        { a3: 'BEL', name: 'Belgium' },
  { a3: 'BGR', name: 'Bulgaria' },       { a3: 'HRV', name: 'Croatia' },
  { a3: 'CYP', name: 'Cyprus' },         { a3: 'CZE', name: 'Czechia' },
  { a3: 'DNK', name: 'Denmark' },        { a3: 'EST', name: 'Estonia' },
  { a3: 'FIN', name: 'Finland' },        { a3: 'FRA', name: 'France' },
  { a3: 'DEU', name: 'Germany' },        { a3: 'GRC', name: 'Greece' },
  { a3: 'HUN', name: 'Hungary' },        { a3: 'IRL', name: 'Ireland' },
  { a3: 'ITA', name: 'Italy' },          { a3: 'LVA', name: 'Latvia' },
  { a3: 'LTU', name: 'Lithuania' },      { a3: 'LUX', name: 'Luxembourg' },
  { a3: 'MLT', name: 'Malta' },          { a3: 'NLD', name: 'Netherlands' },
  { a3: 'POL', name: 'Poland' },         { a3: 'PRT', name: 'Portugal' },
  { a3: 'ROU', name: 'Romania' },        { a3: 'SVK', name: 'Slovakia' },
  { a3: 'SVN', name: 'Slovenia' },       { a3: 'ESP', name: 'Spain' },
  { a3: 'SWE', name: 'Sweden' },
  // Non-EU, but included in TED and worth surfacing.
  { a3: 'NOR', name: 'Norway' },         { a3: 'CHE', name: 'Switzerland' },
  { a3: 'GBR', name: 'United Kingdom' },
]

const country = ref(null)
const detectedSource = ref('unknown')
const companies = ref([])
const authorities = ref([])
const loading = ref(true)
const error = ref(null)

const countryLabel = computed(() => {
  if (!country.value) return null
  return COUNTRIES.find((c) => c.a3 === country.value)?.name || country.value
})

function onTickerSelect(symbol) {
  track('ticker-selected', { symbol, source: 'public-spending' })
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(symbol)
  const view = isUuid ? 'profile' : 'summary'
  router.push('/c/' + symbol + '/' + view)
}

function onCompanyClick(company) {
  track('public-spending-company-click', { id: company.id })
  router.push('/c/' + company.id + '/profile')
}

function onAuthorityClick(authority) {
  // Authorities render at the shared entity profile, same route as
  // companies (`/c/:id/profile` → HomeView resolves the UUID to the
  // authority and shows its contracts). The old `/authority/:id` path
  // was never wired in the router, so this used to dump users on the
  // 404 page when they opened an authority from the rankings.
  track('public-spending-authority-click', { id: authority.id })
  router.push('/c/' + authority.id + '/profile')
}

async function loadFor(c) {
  loading.value = true
  error.value = null
  try {
    const data = await fetchRecommendations(c, { limit: 10 })
    companies.value = data.companies || []
    authorities.value = data.authorities || []
  } catch (err) {
    error.value = err.message
    companies.value = []
    authorities.value = []
  } finally {
    loading.value = false
  }
}

async function onCountryChange(event) {
  country.value = event.target.value
  await loadFor(country.value)
}

onMounted(async () => {
  try {
    const detect = await fetchMyCountry()
    country.value = detect.country  // alpha-3 or null
    detectedSource.value = detect.source || 'unknown'
  } catch {
    country.value = null
    detectedSource.value = 'unknown'
  }
  if (country.value) {
    await loadFor(country.value)
  } else {
    loading.value = false
  }
})

function formatEur(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 1e9) return `€${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `€${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `€${(n / 1e3).toFixed(0)}K`
  return `€${n.toFixed(0)}`
}
</script>

<template>
  <div class="public-spending" data-testid="public-spending">
    <header class="hero">
      <div class="hero-logo"><Wordmark size="lg" /></div>
      <h1 class="hero-title">{{ $t('public_spending.public_spending') }}</h1>
      <p class="hero-sub">{{ $t('public_spending.intro') }}</p>
      <TickerSearch
        :selected-symbol="null"
        :compact="true"
        class="hero-search"
        data-testid="ps-search"
        @select="onTickerSelect"
      />
    </header>

    <!-- Country bar — shows the detected country with a switcher.
         Nothing is gated on auth; switching is a client-side filter
         change, no preference stored. -->
    <div class="country-bar" data-testid="ps-country-bar">
      <span class="country-bar-label">
        <template v-if="country && detectedSource === 'geoip'">Showing top in</template>
        <template v-else-if="country">Showing top in</template>
        <template v-else>Pick a country to see top companies and authorities:</template>
      </span>
      <select
        :value="country || ''"
        class="country-select"
        data-testid="ps-country-select"
        @change="onCountryChange"
      >
        <option v-if="!country" value="">— pick a country —</option>
        <option v-for="c in COUNTRIES" :key="c.a3" :value="c.a3">
          {{ c.name }}
        </option>
      </select>
    </div>

    <!-- Recommendation panels — two columns on desktop, stacked on
         mobile. Skeleton-style loading state to avoid layout jump. -->
    <section v-if="country" class="panels" data-testid="ps-panels">
      <div v-if="error" class="error-bar" data-testid="ps-error">{{ error }}</div>

      <div class="panel" data-testid="ps-companies">
        <h2 class="panel-title">Top companies in {{ countryLabel }}</h2>
        <p class="panel-sub">By total EU procurement contract value won.</p>
        <ol v-if="!loading && companies.length" class="entity-list">
          <li
            v-for="c in companies"
            :key="c.id"
            class="entity-row"
            tabindex="0"
            :data-testid="`ps-company-${c.id}`"
            @click="onCompanyClick(c)"
            @keydown.enter="onCompanyClick(c)"
          >
            <span class="entity-name">{{ c.name }}</span>
            <span class="entity-stats">
              {{ formatEur(c.total_value_eur) }} · {{ c.contract_count }} contracts
            </span>
          </li>
        </ol>
        <p v-else-if="loading" class="muted">Loading…</p>
        <p v-else class="muted">No companies found for {{ countryLabel }}.</p>
      </div>

      <div class="panel" data-testid="ps-authorities">
        <h2 class="panel-title">Top authorities in {{ countryLabel }}</h2>
        <p class="panel-sub">By total contract value awarded.</p>
        <ol v-if="!loading && authorities.length" class="entity-list">
          <li
            v-for="a in authorities"
            :key="a.id"
            class="entity-row"
            tabindex="0"
            :data-testid="`ps-authority-${a.id}`"
            @click="onAuthorityClick(a)"
            @keydown.enter="onAuthorityClick(a)"
          >
            <span class="entity-name">{{ a.name }}</span>
            <span class="entity-stats">
              {{ formatEur(a.total_value_eur) }} · {{ a.contract_count }} contracts
            </span>
          </li>
        </ol>
        <p v-else-if="loading" class="muted">Loading…</p>
        <p v-else class="muted">No authorities found for {{ countryLabel }}.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.public-spending {
  max-width: 60rem;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.hero { display: flex; flex-direction: column; align-items: center; gap: 0.7rem; }
.hero-logo { margin-bottom: 0.4rem; }
.hero-title {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0;
  color: var(--text);
}
.hero-sub {
  font-size: 0.95rem;
  color: var(--muted);
  text-align: center;
  margin: 0;
  max-width: 38rem;
}
.hero-search { width: 100%; max-width: 38rem; margin-top: 0.5rem; }

.country-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--muted);
}
.country-bar-label { font-weight: 500; }
.country-select {
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 4px;
  font-size: 0.9rem;
}

.panels {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
}
@media (min-width: 768px) {
  .panels { grid-template-columns: 1fr 1fr; }
}
.panel {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.panel-title { font-size: 1.05rem; font-weight: 600; margin: 0; color: var(--text); }
.panel-sub   { font-size: 0.78rem; color: var(--muted); margin: 0 0 0.4rem; }

.entity-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.entity-row {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.6rem 0.4rem;
  border-top: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.1s;
  outline: none;
}
.entity-row:first-child { border-top: 0; }
.entity-row:hover, .entity-row:focus-visible {
  background: var(--accent-bg, rgba(10, 102, 194, 0.06));
}
.entity-name  { font-size: 0.92rem; color: var(--text); font-weight: 500; }
.entity-stats { font-size: 0.78rem; color: var(--muted); }

.error-bar {
  grid-column: 1 / -1;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--err, #b3261e);
  font-size: 0.85rem;
}
.muted { color: var(--muted); font-size: 0.85rem; }
</style>
