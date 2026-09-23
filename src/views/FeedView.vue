<script setup>
import {
  ref, onMounted, onBeforeUnmount, onActivated, onDeactivated, computed, watch, nextTick,
} from 'vue'
import { useLang } from '../composables/useLang.js'
import { useRouter, useRoute } from 'vue-router'
import { listReports, listAllTags } from '../api/community.js'
import { loadBriefingStream } from '../composables/useBriefingStream.js'
import BriefingCard from '../components/BriefingCard.vue'
import StoryCard from '../components/StoryCard.vue'
import { briefingLink } from '../utils/briefingLink.js'
import { interleaveFeed, feedKey } from '../utils/feedOrder.js'
import { loadNutsLabels, nutsLabel } from '../composables/useNutsLabels.js'
import { isAuthed } from '../api/session.js'
import { useFollowedTags } from '../composables/useFollowedTags.js'
import { useStoriesTagFilter } from '../composables/useStoriesTagFilter.js'

// Named so App.vue's KeepAlive `include` can match it: coming back
// from a detail page should restore this list and its scroll, not
// refetch it from the top.
defineOptions({ name: 'FeedView' })

/** Entries per page of the feed. */
const PAGE_SIZE = 20
/**
 * Pages that load on their own as the reader scrolls, before the feed
 * asks them to click for more. An endless feed has no bottom to reach and
 * so no point at which a reader decides they are done; five pages is a
 * hundred findings, and after that continuing should be a choice.
 */
const AUTO_PAGES = 5

const router = useRouter()
const route = useRoute()
const { lang: uiLang } = useLang()

// ── What the reader asked to see ──────────────────────────────────
//
// One feed, three views of it, all in the URL so a filtered feed can be
// shared or bookmarked:
//   (none)                 stories and briefings, interleaved
//   ?show=stories          data stories only
//   ?show=briefings        briefing findings only
//   ?briefing=<slug>       one briefing's findings only
// It replaces three separate entries in the menu (Feed, Stories,
// Briefings) that were three pages over the same stream.
//
// Held in refs taken from THIS view's route, not derived live: the view
// is kept alive, and a kept-alive component's watchers keep running
// while it is hidden, following the global route — which is the story
// the reader just opened. Derived live, the hidden feed would see "no
// filter" and refetch behind the reader's back.
const ownPath = route.path
const SHOWS = ['stories', 'briefings']

function showOf(query) {
  if (typeof query.briefing === 'string' && query.briefing) return 'briefings'
  return SHOWS.includes(query.show) ? query.show : 'all'
}
function briefingOf(query) {
  return typeof query.briefing === 'string' && query.briefing ? query.briefing : null
}
function tagOf(query) {
  const t = query.tag
  return typeof t === 'string' && t ? t : null
}

const show = ref(showOf(route.query))
const briefingSlug = ref(briefingOf(route.query))
const activeTag = ref(tagOf(route.query))

const wantStories = computed(() => show.value !== 'briefings')
// A tag is a question about stories: briefing findings carry no story
// tags, so on the mixed feed a tag filter hides them — showing them
// would imply they matched. Asked for briefings only, the tag simply
// does not apply (and its strip is hidden), rather than emptying the
// view the reader explicitly chose.
const wantBriefings = computed(() =>
  show.value === 'briefings' || (show.value === 'all' && !activeTag.value))

// ── Tags ──────────────────────────────────────────────────────────
const allTags = ref([])
const { toggle, isFollowing } = useFollowedTags()
// The last tag is remembered, so leaving for a story and coming back
// keeps the filter even though the story's back link carries no ?tag=.
const {
  getStoredTag, saveTag, clearStoredTag, getStoredView, saveView,
} = useStoriesTagFilter()

async function loadTags() {
  try {
    const r = await listAllTags()
    allTags.value = Array.isArray(r?.tags) ? r.tags : []
  } catch { /* the chip strip is enrichment, never blocking */ }
}

// ── Sources ───────────────────────────────────────────────────────
//
// Stories come from the server a page at a time. Briefing findings come
// all at once: the briefing API is asked for a VOLUME per watch (at most
// 200), not for an offset, so there is no second page to ask for — the
// feed pages through what it received.
const stories = ref([])
const storiesDone = ref(false)
const loading = ref(true)
const error = ref(null)

const briefingItems = ref([])
const briefingsLoaded = ref(false)
const briefingError = ref(null)
// Bumped once the place names arrive so briefing cards re-render with
// them; the feed does not wait for names before showing findings.
const nutsReady = ref(0)

// Every reset bumps this, and a response from an older generation is
// dropped. Switching filter mid-request otherwise appends the previous
// filter's page to the new one.
let generation = 0

async function fetchStoryPage() {
  const gen = generation
  const data = await listReports({
    scope: 'public',
    limit: PAGE_SIZE,
    offset: stories.value.length,
    tag: activeTag.value || undefined,
  })
  if (gen !== generation) return
  // The endpoint returns `{ reports }` (backend internals are still named
  // Report); accept a future `stories` key and the bare array tests use.
  const page = data?.stories || data?.reports || (Array.isArray(data) ? data : [])
  stories.value = [...stories.value, ...page]
  if (page.length < PAGE_SIZE) storiesDone.value = true
}

async function loadBriefings() {
  if (briefingsLoaded.value) return
  briefingError.value = null
  try {
    briefingItems.value = await loadBriefingStream(isAuthed.value)
    briefingsLoaded.value = true
    loadNutsLabels(briefingItems.value).then(() => { nutsReady.value += 1 })
  } catch (err) {
    briefingItems.value = []
    briefingError.value = err.message
  }
}

/** The briefings present in the stream, for the "one briefing" picker. */
const availableBriefings = computed(() => {
  const seen = new Map()
  for (const b of briefingItems.value) {
    if (b._group && !seen.has(b._group)) seen.set(b._group, b._from || b._group)
  }
  return [...seen].map(([slug, name]) => ({ slug, name }))
})

const shownBriefings = computed(() => {
  if (!wantBriefings.value) return []
  // Read for the dependency only: re-run once place names arrive.
  nutsReady.value
  return briefingItems.value
    .filter((b) => !briefingSlug.value || b._group === briefingSlug.value)
    .map((b) => ({ ...b, _link: briefingLink(b), _where: nutsLabel(b) }))
})

const entries = computed(() => interleaveFeed(
  shownBriefings.value,
  wantStories.value ? stories.value : [],
  undefined,
  { storiesComplete: !wantStories.value || storiesDone.value },
))

// ── Paging ────────────────────────────────────────────────────────
const pagesShown = ref(1)
// The first page counts: pages 1-5 arrive by scrolling, then a click.
const pagesSinceClick = ref(1)
const loadingMore = ref(false)

const visibleEntries = computed(() => entries.value.slice(0, pagesShown.value * PAGE_SIZE))
const canLoadMore = computed(() =>
  entries.value.length > visibleEntries.value.length
  || (wantStories.value && !storiesDone.value))
const needsClick = computed(() => pagesSinceClick.value >= AUTO_PAGES)

/** Fetch stories until `want` entries exist or the server runs dry. */
async function fillTo(want) {
  while (wantStories.value && !storiesDone.value && entries.value.length < want) {
    const before = stories.value.length
    const gen = generation
    await fetchStoryPage()
    // A stale generation or a page that added nothing: stop, rather
    // than spin on a server that keeps answering the same way.
    if (gen !== generation || stories.value.length === before) break
  }
}

async function loadMore({ manual = false } = {}) {
  if (loadingMore.value || !canLoadMore.value) return
  if (!manual && needsClick.value) return
  loadingMore.value = true
  const gen = generation
  try {
    if (manual) pagesSinceClick.value = 0
    await fillTo((pagesShown.value + 1) * PAGE_SIZE)
    if (gen !== generation) return
    pagesShown.value += 1
    pagesSinceClick.value += 1
  } catch (err) {
    error.value = err.message
  } finally {
    loadingMore.value = false
  }
  // A short page may leave the bottom still in view, and the observer
  // only reports CHANGES of visibility — so look again ourselves.
  await nextTick()
  maybeAutoLoad()
}

/** Throw away what is loaded and start from page one for the current filter. */
async function reload() {
  generation += 1
  stories.value = []
  storiesDone.value = false
  pagesShown.value = 1
  pagesSinceClick.value = 1
  error.value = null
  loading.value = true
  try {
    await Promise.all([
      wantStories.value ? fetchStoryPage() : Promise.resolve(),
      // Only when this view will show them: the stories-only feed must
      // not cost the reader the briefing requests.
      wantBriefings.value ? loadBriefings() : Promise.resolve(),
    ])
    await fillTo(PAGE_SIZE)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
  await nextTick()
  maybeAutoLoad()
}

// ── Infinite scroll ───────────────────────────────────────────────
const sentinel = ref(null)
const scrollSupported = typeof window !== 'undefined' && 'IntersectionObserver' in window
let observer = null

/** Pre-load a screenful before the reader actually reaches the bottom. */
const PREFETCH_PX = 600

function sentinelInView() {
  const el = sentinel.value
  if (!el || typeof window === 'undefined') return false
  const r = el.getBoundingClientRect()
  // Hidden (e.g. the kept-alive feed while a story is open) has no box.
  if (r.width === 0 && r.height === 0) return false
  return r.top <= window.innerHeight + PREFETCH_PX
}

function maybeAutoLoad() {
  if (!scrollSupported || loading.value || loadingMore.value) return
  if (needsClick.value || !canLoadMore.value) return
  if (sentinelInView()) loadMore()
}

function observe() {
  if (!scrollSupported || !sentinel.value || observer) return
  observer = new IntersectionObserver((seen) => {
    if (seen.some((e) => e.isIntersecting)) maybeAutoLoad()
  }, { rootMargin: `0px 0px ${PREFETCH_PX}px 0px` })
  observer.observe(sentinel.value)
}
function unobserve() {
  observer?.disconnect()
  observer = null
}
// The sentinel lives inside the list's v-if, so it comes and goes with
// the list; follow it rather than observing once at mount.
watch(sentinel, () => { unobserve(); observe() })
onActivated(observe)
onDeactivated(unobserve)
onBeforeUnmount(unobserve)

// Without an IntersectionObserver the feed never loads on its own, so the
// button is always there instead.
const showMoreButton = computed(() =>
  !loading.value && canLoadMore.value && (needsClick.value || !scrollSupported))
const reachedEnd = computed(() =>
  !loading.value && !canLoadMore.value && entries.value.length > 0)

// ── URL ───────────────────────────────────────────────────────────
function writeQuery(patch) {
  const next = { ...route.query, ...patch }
  for (const [k, v] of Object.entries(next)) if (v == null || v === '') delete next[k]
  router.replace({ path: route.path, query: next })
}

function setShow(value) {
  // Saved before the URL changes: the route watcher restores whatever is
  // saved when the URL carries no view, so an "All" click that left the
  // old view in storage would be undone on the spot.
  saveView(value === 'all' ? null : value)
  writeQuery({ show: value === 'all' ? null : value, briefing: null })
}
function setBriefing(slug) {
  saveView(slug ? `briefing:${slug}` : 'briefings')
  writeQuery({ briefing: slug || null, show: slug ? null : 'briefings' })
}

/**
 * Put back what the reader last chose when they arrive without saying.
 *
 * Links back to the feed — the story page's, the menu's — carry no
 * query, so without this the reader loses their view and their tag every
 * time they open something. Only fills what the URL leaves out: an
 * explicit ?show= or ?tag= always wins.
 *
 * `adopt` takes the result at once, which is what mount wants: the first
 * fetch then already carries it, instead of an unfiltered request and a
 * filtered one racing to the screen. The route watcher must NOT adopt —
 * it compares what arrives with what it holds to decide whether to
 * reload, and values adopted early would always compare equal.
 */
function restoreSaved({ adopt = false } = {}) {
  const q = route.query
  const patch = {}
  if (!q.show && !q.briefing) {
    const view = getStoredView()
    if (view?.startsWith('briefing:')) patch.briefing = view.slice('briefing:'.length)
    else if (SHOWS.includes(view)) patch.show = view
  }
  const merged = { ...q, ...patch }
  // The tag is a story filter; a briefings-only view has no stories.
  if (!tagOf(q) && showOf(merged) !== 'briefings') {
    const tag = getStoredTag()
    if (tag) patch.tag = tag
  }
  if (!Object.keys(patch).length) return false
  const next = { ...q, ...patch }
  if (adopt) {
    show.value = showOf(next)
    briefingSlug.value = briefingOf(next)
    activeTag.value = tagOf(next)
  }
  router.replace({ path: route.path, query: next })
  return true
}

function setTag(tag) {
  writeQuery({ tag })
  saveTag(tag)
}
function clearTag() {
  // Cleared before the URL changes, for the same reason as setShow.
  clearStoredTag()
  writeQuery({ tag: null })
}

// Follow the URL, but only this view's own route (see `ownPath`).
// Arriving back without a ?tag= restores the saved tag first; the held
// and saved tags agree, so the cached list is shown again untouched.
watch(() => route.fullPath, () => {
  if (route.path !== ownPath) return
  // Arrived without a view or tag: put the saved ones back. That is a
  // replace, which brings us back here with them in the URL.
  if (restoreSaved()) return
  const tag = tagOf(route.query)
  const nextShow = showOf(route.query)
  const nextSlug = briefingOf(route.query)
  const changed = nextShow !== show.value || nextSlug !== briefingSlug.value || tag !== activeTag.value
  show.value = nextShow
  briefingSlug.value = nextSlug
  activeTag.value = tag
  if (changed) reload()
})

// A new UI language means translated titles and abstracts from the API.
watch(uiLang, () => reload())

onMounted(async () => {
  restoreSaved({ adopt: true })
  await Promise.all([reload(), loadTags()])
  observe()
})

const SHOW_OPTIONS = [
  { value: 'all', label: 'app.all' },
  { value: 'stories', label: 'nav.stories' },
  { value: 'briefings', label: 'nav.briefings' },
]

const emptyMessage = computed(() =>
  show.value === 'briefings' ? 'feed.nothing_here_briefings' : 'feed.nothing_here')

const title = computed(() => ({
  stories: 'nav.stories',
  briefings: 'nav.briefings',
}[show.value] || 'feed.feed'))
const subtitle = computed(() => ({
  stories: 'feed.public_data_stories_from_the_community_n',
  briefings: 'feed.briefings_sub',
}[show.value] || 'feed.mixed_sub'))
</script>

<template>
  <div class="feed" data-testid="feed">
    <h1 class="feed-title">{{ $t(title) }}</h1>
    <p class="feed-sub">{{ $t(subtitle) }}</p>

    <!-- What to show. This used to be three menu entries — Feed, Stories,
         Briefings — for three pages over one stream. -->
    <div class="feed-filter" data-testid="feed-filter">
      <div class="feed-seg" role="group" :aria-label="$t('feed.show_label')">
        <button
          v-for="opt in SHOW_OPTIONS"
          :key="opt.value"
          type="button"
          class="feed-seg-btn"
          :class="{ active: show === opt.value && !(opt.value === 'briefings' && briefingSlug) }"
          :aria-pressed="show === opt.value && !(opt.value === 'briefings' && briefingSlug)"
          :data-testid="`feed-filter-${opt.value}`"
          @click="setShow(opt.value)"
        >{{ $t(opt.label) }}</button>
      </div>
      <select
        v-if="show !== 'stories' && availableBriefings.length"
        class="feed-pick"
        :value="briefingSlug || ''"
        :aria-label="$t('feed.pick_briefing')"
        data-testid="feed-briefing-select"
        @change="setBriefing($event.target.value)"
      >
        <option value="">{{ $t('feed.all_briefings') }}</option>
        <option v-for="b in availableBriefings" :key="b.slug" :value="b.slug">{{ b.name }}</option>
      </select>
    </div>

    <!-- Browse-by-tag chips. Tags belong to stories, so the strip only
         appears where stories do. Each chip toggles ?tag=; the star
         follows the tag (localStorage signed out, the server signed in). -->
    <div v-if="allTags.length && wantStories" class="tag-strip" data-testid="feed-tag-strip">
      <button
        type="button"
        class="tag-chip all-chip"
        :class="{ active: !activeTag }"
        data-testid="tag-chip-all"
        @click="clearTag"
      >{{ $t('app.all') }}</button>
      <span v-for="t in allTags" :key="t.tag" class="tag-chip-wrap">
        <button
          type="button"
          class="tag-chip"
          :class="{ active: activeTag === t.tag }"
          :data-testid="`tag-chip-${t.tag}`"
          @click="setTag(t.tag)"
        >
          {{ t.tag }}
          <span class="chip-count">{{ t.story_count }}</span>
        </button>
        <button
          type="button"
          class="follow-btn"
          :class="{ followed: isFollowing(t.tag) }"
          :aria-label="isFollowing(t.tag) ? `Unfollow ${t.tag}` : `Follow ${t.tag}`"
          :title="isFollowing(t.tag) ? 'Unfollow' : 'Follow'"
          :data-testid="`tag-follow-${t.tag}`"
          @click.stop="toggle(t.tag)"
        >{{ isFollowing(t.tag) ? '★' : '☆' }}</button>
      </span>
    </div>

    <p v-if="activeTag && wantStories" class="feed-active-filter" data-testid="feed-active-filter">
      {{ $t('feed.filtering_by') }}<code>{{ activeTag }}</code>.
      <button type="button" class="link-btn" @click="clearTag">{{ $t('feed.clear_filter') }}</button>
    </p>

    <div v-if="error" class="error-bar" data-testid="feed-error">{{ error }}</div>

    <div v-if="loading" class="loading-msg">{{ $t('feed.loading_feed') }}</div>

    <div v-else-if="!entries.length" class="empty-msg" data-testid="feed-empty">
      {{ $t(emptyMessage) }}
    </div>

    <template v-else>
      <!-- One stream: a data story after every few briefing findings,
           each card in its kind's colour. The ids ride on the list items
           (the e2e selects li[data-testid^="feed-briefing-"]). -->
      <ul class="feed-list" data-testid="feed-list">
        <li
          v-for="e in visibleEntries"
          :key="feedKey(e)"
          class="feed-entry"
          :data-kind="e.kind"
          :data-testid="e.kind === 'story' ? `feed-card-${e.item.id}` : `feed-briefing-${e.item.item_id}`"
        >
          <StoryCard v-if="e.kind === 'story'" :story="e.item" />
          <BriefingCard v-else :item="e.item" />
        </li>
      </ul>

      <!-- Scrolling this into view loads the next page. -->
      <div ref="sentinel" class="feed-sentinel" aria-hidden="true" data-testid="feed-sentinel" />

      <p v-if="loadingMore" class="loading-msg" data-testid="feed-loading-more">
        {{ $t('feed.loading_more') }}
      </p>
      <div v-else-if="showMoreButton" class="feed-more">
        <p v-if="needsClick" class="feed-more-note">
          {{ $t('feed.paused_after', { n: visibleEntries.length }) }}
        </p>
        <button
          type="button"
          class="feed-more-btn"
          data-testid="feed-load-more"
          @click="loadMore({ manual: true })"
        >{{ $t('feed.load_more') }}</button>
      </div>
      <p v-else-if="reachedEnd" class="feed-end" data-testid="feed-end">{{ $t('feed.end_of_feed') }}</p>
    </template>
  </div>
</template>

<style scoped>
.feed {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}
.feed-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 0.25rem;
}
.feed-sub {
  font-size: 0.8rem;
  color: var(--muted);
  margin: 0 0 1.25rem;
}
.error-bar {
  padding: 0.5rem 0.75rem;
  margin-bottom: 1rem;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 4px;
  font-size: 0.8rem;
}
.loading-msg, .empty-msg {
  text-align: center;
  padding: 2rem 0;
  font-size: 0.85rem;
  color: var(--muted);
}
/* ── Tag chip strip ─────────────────────────────────────────── */
.tag-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0 0 1rem;
}
.tag-chip-wrap {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: var(--accent-bg, rgba(10, 102, 194, 0.10));
  overflow: hidden;
}
.tag-chip {
  border: 0;
  padding: 0.2rem 0.6rem;
  background: transparent;
  color: var(--accent, #0a66c2);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.tag-chip.active,
.tag-chip.all-chip.active { background: var(--accent, #0a66c2); color: #fff; border-radius: 999px; }
.all-chip { border-radius: 999px; background: var(--accent-bg, rgba(10, 102, 194, 0.10)); }
.chip-count { font-size: 0.7rem; color: var(--muted); }
.tag-chip.active .chip-count { color: rgba(255,255,255,0.85); }
.follow-btn {
  border: 0;
  padding: 0.2rem 0.5rem;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1;
}
.follow-btn.followed { color: #f0a000; }
.feed-active-filter { font-size: 0.85rem; color: var(--muted); margin: 0 0 1rem; }
.feed-active-filter code {
  background: var(--accent-bg, rgba(10, 102, 194, 0.12));
  color: var(--accent, #0a66c2);
  padding: 0.05rem 0.35rem;
  border-radius: 4px;
}
.link-btn {
  border: 0;
  background: transparent;
  color: var(--accent, #0a66c2);
  cursor: pointer;
  font: inherit;
  padding: 0;
  margin-left: 0.4rem;
}
.link-btn:hover { text-decoration: underline; }

/* ── What to show ───────────────────────────────────────────── */
.feed-filter {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
  margin: 0 0 1rem;
}
.feed-seg {
  display: inline-flex; border: 1px solid var(--border); border-radius: 999px;
  overflow: hidden; background: var(--surface);
}
.feed-seg-btn {
  border: 0; background: transparent; color: var(--text);
  font: inherit; font-size: 0.82rem; padding: 0.3rem 0.85rem; cursor: pointer;
}
.feed-seg-btn + .feed-seg-btn { border-left: 1px solid var(--border); }
.feed-seg-btn:hover { background: var(--accent-bg, rgba(10, 102, 194, 0.10)); }
.feed-seg-btn.active { background: var(--accent, #1d4e9e); color: #fff; }
.feed-pick {
  font: inherit; font-size: 0.82rem; padding: 0.28rem 0.5rem;
  border: 1px solid var(--border); border-radius: 6px;
  background: var(--surface); color: var(--text); max-width: 100%;
}

/* ── The stream ─────────────────────────────────────────────── */
.feed-list {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 0.75rem;
}
/* On a phone the page gutter plus the card's own padding cost ~10% of a
   412px screen in empty edges. Below the tablet breakpoint the list
   takes back half the gutter; not all of it, or the cards' borders would
   sit on the screen edge. */
@media (max-width: 640px) {
  .feed-list { margin-left: -0.5rem; margin-right: -0.5rem; }
}
.feed-sentinel { height: 1px; }
.feed-more { text-align: center; padding: 1.25rem 0 0.5rem; }
.feed-more-note { font-size: 0.8rem; color: var(--muted); margin: 0 0 0.6rem; }
.feed-more-btn {
  font: inherit; font-size: 0.85rem; font-weight: 600;
  padding: 0.45rem 1.2rem; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--accent, #1d4e9e); background: transparent;
  color: var(--accent, #1d4e9e);
}
.feed-more-btn:hover { background: var(--accent, #1d4e9e); color: #fff; }
.feed-end { text-align: center; font-size: 0.8rem; color: var(--muted); padding: 1.25rem 0; }
</style>
