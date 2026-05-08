<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import TickerSearch from '../components/TickerSearch.vue'
import TickerFinancials from '../components/TickerFinancials.vue'
import DataViewSelector from '../components/DataViewSelector.vue'
import Wordmark from '../components/Wordmark.vue'
import RecentlyPublishedCarousel from '../components/RecentlyPublishedCarousel.vue'
import { useAnalytics } from '../composables/useAnalytics.js'
import { listReports } from '../api/community.js'

const route = useRoute()
const router = useRouter()

const VIEW_GROUPS = [
  {
    key: 'overview', label: 'Overview',
    views: [
      { key: 'profile', label: 'Profile' },
      { key: 'graph', label: 'Graph Explorer' },
    ],
  },
  {
    key: 'financials', label: 'Financials',
    views: [
      { key: 'summary',      label: 'Summary' },
      { key: 'fundamentals', label: 'Fundamentals' },
      { key: 'income',       label: 'Income' },
      { key: 'cashflow',     label: 'Cash Flow' },
      { key: 'balance',      label: 'Balance' },
      { key: 'valuation',    label: 'Valuation' },
    ],
  },
  {
    key: 'procurement', label: 'Procurement',
    views: [
      { key: 'contracts',       label: 'Contracts' },
      { key: 'entity-nuts-map', label: 'Business Map' },
    ],
  },
  {
    key: 'analysis', label: 'Analysis',
    views: [{ key: 'gmr-long', label: 'Long-Term Value' }],
  },
]

const selectedTicker = computed(() => route.params.ticker || null)
const selectedView = computed(() => route.params.view || 'summary')

function onCompanyResolved(info) {
  if (info?.name) {
    const view = selectedView.value || 'summary'
    const label = view.charAt(0).toUpperCase() + view.slice(1)
    document.title = `${info.name} — ${label} | Fontem`
  }
}

const { track } = useAnalytics()

function onTickerSelect(symbol) {
  track('ticker-selected', { symbol })
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(symbol)
  const view = isUuid ? 'profile' : selectedView.value
  router.push('/c/' + symbol + '/' + view)
}

function onViewChange(view) {
  track('view-changed', { symbol: selectedTicker.value, view })
  router.push('/c/' + selectedTicker.value + '/' + view)
}

function onClose() {
  document.title = 'Fontem — EU Enterprise Knowledge Graph'
  router.push('/')
}

// ── Landing-extra: explainer, example chips, how-it-works, recent stories ──

// Each chip lands on a different platform feature, not just a search result —
// so the very first click rewards the visitor with rich data. If any of these
// IDs ever 404 after a re-ingest, swap with another well-known entity from
// the same family. The slug-URL follow-up will make this less fragile.
const EXAMPLE_CHIPS = [
  {
    key: 'company',
    label: 'Search a company: Fujitsu Tech Sol ES',
    to: '/c/a73f2b1c-2fca-5ad8-a0ad-8b86d24b5371/profile',
  },
  {
    key: 'graph',
    label: 'Explore a corporate network: Siemens AG',
    to: '/c/f4259a89-88f7-5796-a22a-1c8c1999cc69/graph',
  },
  {
    key: 'story',
    label: 'Read a community data story',
    to: '/stories/d13f6e62-da50-4d4f-a401-8ab409e69ae4',
  },
  {
    key: 'atlas',
    label: 'Map a Eurostat dataset across Europe',
    to: '/atlas',
  },
]

// `gif` slot is reserved (CSS aspect-ratio 16/9). When the asset lands in
// public/ via a follow-up PR, set the path here and the slot un-hides
// without reflowing the surrounding layout.
const STEPS = [
  {
    key: 'search',
    name: 'Search',
    desc: 'Look up any company, contracting authority, lobbyist or EU-funded project by name or identifier.',
    svg: '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    gif: null,
    gifAlt: 'Searching for an entity in Fontem',
  },
  {
    key: 'crosscheck',
    name: 'Cross-check',
    desc: 'Compare what TED, GLEIF, the Transparency Register, Cohesion and other sources say about the same entity, side by side.',
    svg: '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7H3v4"/><path d="M3 7l5 5"/><path d="M17 17h4v-4"/><path d="M21 17l-5-5"/></svg>',
    gif: null,
    gifAlt: 'Switching between procurement, financial and lobbying views',
  },
  {
    key: 'publish',
    name: 'Publish',
    desc: 'Write up what you find as a data story and publish it — private, signed-in only, or fully public.',
    svg: '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 14h6"/><path d="M9 18h4"/></svg>',
    gif: null,
    gifAlt: 'Publishing a data story from the editor',
  },
]

const recentStories = ref([])
const demoVideo = ref(null)

onMounted(async () => {
  try {
    // Fetch enough rows that the carousel has something to rotate
    // through. 8 is a sweet spot: at AUTO_MS=5s that's a 40s loop,
    // long enough to read each card without feeling stale.
    const data = await listReports({ scope: 'public', limit: 8 })
    recentStories.value = Array.isArray(data)
      ? data
      : (data?.stories ?? data?.reports ?? [])
  } catch {
    // DonateView pattern: silent degrade — never a scary banner on the homepage.
  }

  // Honour prefers-reduced-motion — pause the demo loop. The browser
  // will already not autoplay if a user has heavy motion-reduction
  // settings, but the explicit pause + a `controls` toggle would be
  // a future polish; for now, just halt the loop.
  if (typeof window !== 'undefined' && demoVideo.value) {
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (prefersReduced?.matches) {
      try { demoVideo.value.pause() } catch { /* noop */ }
    }
  }
})

</script>

<template>
  <div class="mx-auto w-full px-4 sm:px-6" :class="selectedTicker ? 'max-w-6xl' : 'max-w-3xl'">
    <main>
      <!-- ── Landing: centered search card ──────────────────── -->
      <div v-if="!selectedTicker" class="landing" data-testid="landing">
        <div class="landing-card">
          <div class="landing-logo">
            <Wordmark size="lg" />
          </div>
          <TickerSearch
            ref="graphSearchInput"
            :selected-symbol="null"
            :compact="true"
            class="landing-search"
            @select="onTickerSelect"
          />
          <p class="landing-hint">
            Search companies, public entities, lobbyists and more…
          </p>
        </div>

        <!-- ── Landing-extra: onboarding ───────────────────── -->
        <!-- Section order is deliberate: chips give an immediate
             "what could I do here" affordance, How-it-works frames
             the workflow, Recently-published shows it's alive, and
             the 45-second tour rewards anyone still scrolling. -->
        <section class="landing-extra" data-testid="landing-extra">
          <div class="example-chips" data-testid="example-chips">
            <span class="example-chips-label">Try:</span>
            <router-link
              v-for="c in EXAMPLE_CHIPS"
              :key="c.key"
              :to="c.to"
              class="example-chip"
              :data-testid="`example-chip-${c.key}`"
            >{{ c.label }}</router-link>
          </div>

          <section class="howitworks" data-testid="howitworks">
            <h2 class="howitworks-title">How it works</h2>
            <div class="howitworks-grid">
              <div
                v-for="s in STEPS"
                :key="s.key"
                class="howitworks-step"
                :class="{ 'has-gif': !!s.gif }"
                :data-testid="`howitworks-step-${s.key}`"
              >
                <!-- Inline SVG from a hardcoded const, no user input. -->
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div class="howitworks-icon" aria-hidden="true" v-html="s.svg" />
                <div class="howitworks-step-name">{{ s.name }}</div>
                <p class="howitworks-step-desc">{{ s.desc }}</p>
                <div
                  v-if="s.gif"
                  class="howitworks-gif"
                  :style="{ backgroundImage: `url(${s.gif})` }"
                  role="img"
                  :aria-label="s.gifAlt"
                />
              </div>
            </div>
          </section>

          <section
            v-if="recentStories.length"
            class="recent-reports"
            data-testid="recent-stories"
          >
            <h2 class="recent-reports-title">Recently published</h2>
            <RecentlyPublishedCarousel :stories="recentStories" />
            <router-link to="/feed" class="recent-reports-more">See all public data stories →</router-link>
          </section>

          <section class="demo-clip" data-testid="landing-demo">
            <h2 class="demo-clip-title">A 45-second tour</h2>
            <div class="demo-clip-frame">
              <video
                ref="demoVideo"
                class="demo-clip-video"
                src="/landing-demo.mp4"
                autoplay
                muted
                loop
                playsinline
                preload="metadata"
                aria-label="Walkthrough: searching a company, exploring procurement, and publishing a data story"
              />
            </div>
            <p class="demo-clip-caption">
              A signed-in researcher walks from a search to a published data story.
              Recorded against the live platform — no animation, no edits.
            </p>
          </section>
        </section>
      </div>

      <!-- ── Ticker detail ─────────────────────────────────── -->
      <div v-if="selectedTicker" class="mt-6 flex flex-col gap-0 sm:flex-row sm:items-start sm:gap-4" data-testid="ticker-detail">
        <DataViewSelector
          :model-value="selectedView"
          :groups="VIEW_GROUPS"
          @update:model-value="onViewChange"
        />
        <TickerFinancials
          :symbol="selectedTicker"
          :view="selectedView"
          class="min-w-0 flex-1"
          @close="onClose"
          @company-resolved="onCompanyResolved"
        />
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Landing flow: card up top, then onboarding strip beneath. The previous
   layout vertically centered a single card via min-height + justify-content;
   that doesn't compose with extra sections below, so it's now a normal
   flow with breathing room above. */
.landing {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 3rem 0 4rem;
}
.landing-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 2rem 1.5rem;
  text-align: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  max-width: 32rem;
  width: 100%;
  margin: 0 auto;
}
.landing-logo {
  margin-bottom: 1.25rem;
  line-height: 1;
}
.landing-search {
  display: block;
  margin: 0 auto;
  max-width: 26rem;
}
.landing-hint {
  margin: 0.85rem 0 0;
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.4;
}
@media (min-width: 640px) {
  .landing-card { padding: 2.5rem 2rem; }
}

/* ── Landing-extra ───────────────────────────────────────── */
.landing-extra {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  margin-top: 2.25rem;
}
/* Example chips: clickable pills that mirror the .sign-in-btn affordance
   from AppHeader, but rounded fully so they read as "tags you can click". */
.example-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.example-chips-label {
  font-size: 0.78rem;
  color: var(--muted);
  margin-right: 0.25rem;
}
.example-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 0.85rem;
  color: var(--text);
  text-decoration: none;
  background: var(--surface);
  transition: border-color 0.15s, transform 0.15s, color 0.15s;
}
.example-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
  transform: translateY(-1px);
}

/* How it works: mirrors the .donate-tier card pattern from DonateView. */
.howitworks-title,
.recent-reports-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 0.85rem;
  text-align: center;
}
.howitworks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}
.howitworks-step {
  display: flex;
  flex-direction: column;
  padding: 1.25rem 1.1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: border-color 0.15s, transform 0.15s;
}
.howitworks-step:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}
.howitworks-icon {
  color: var(--accent);
  margin-bottom: 0.5rem;
  line-height: 0;
}
.howitworks-step-name {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.25rem;
}
.howitworks-step-desc {
  font-size: 0.85rem;
  color: var(--text);
  line-height: 1.5;
  margin: 0;
}
/* Reserved 16:9 slot. Hidden until the step has a `gif` set; when it does,
   the slot renders inline with the existing card content. The aspect-ratio
   property guarantees no layout reflow when the GIF asset eventually lands. */
.howitworks-gif {
  display: none;
  aspect-ratio: 16 / 9;
  background-size: cover;
  background-position: center;
  background-color: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  margin-top: 0.75rem;
}
.howitworks-step.has-gif .howitworks-gif { display: block; }

/* Demo clip: 16:10 video (matches the recorder's 1280×800 viewport),
   centered, with a subtle frame so it reads as media not a hero
   background. preload="metadata" + autoplay + muted on the element
   itself; the JS side pauses on prefers-reduced-motion. */
.demo-clip {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.demo-clip-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 0.85rem;
  text-align: center;
}
.demo-clip-frame {
  width: 100%;
  max-width: 36rem;
  aspect-ratio: 16 / 10;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.demo-clip-video {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.demo-clip-caption {
  margin: 0.85rem 0 0;
  font-size: 0.78rem;
  color: var(--muted);
  text-align: center;
  max-width: 36rem;
  line-height: 1.45;
}

/* Recent reports: report-card rules copied verbatim from FeedView so the
   visual matches /feed exactly. */
.recent-reports {
  display: flex;
  flex-direction: column;
}
.recent-reports-more {
  align-self: flex-end;
  margin-top: 0.65rem;
  font-size: 0.8rem;
  color: var(--accent);
  text-decoration: none;
}
.recent-reports-more:hover { text-decoration: underline; }
</style>
