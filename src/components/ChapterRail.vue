<script setup>
/**
 * Chapter rail — auto-extracted TOC for a data story.
 *
 * Watches the rendered story body for h2/h3 elements, surfaces them
 * as a sticky left rail, and uses IntersectionObserver to spotlight
 * the section currently in view. Clicking an entry smooth-scrolls
 * to the heading.
 *
 * The rail is the user-visible signal that we've moved from "report"
 * to "data story" — it gives a long page a navigable shape and
 * survives editor changes (chapters appear/disappear as headings are
 * added) without the author having to maintain a TOC by hand.
 *
 * Pure presentational component: it receives a ref to the story
 * body element and reads the DOM. No editor coupling, so it works
 * for both the v2 read-only TipTap output and any HTML body.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  // Element ref pointing at the rendered story body. We re-read on
  // mount and whenever the `version` counter bumps so the rail can
  // refresh after the underlying content changes (editor save, route
  // remount, etc.).
  bodyRef: { type: Object, required: true },
  version: { type: Number, default: 0 },
})

const chapters = ref([])
const activeId = ref(null)
let observer = null

/**
 * Slugify a heading's text content into a stable, URL-safe id. We
 * stamp the id back on the element so anchor links + back-button
 * navigation work without help from the TipTap output.
 */
function slugify(text) {
  return (text || 'section')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'section'
}

function extractChapters() {
  const root = props.bodyRef?.value
  if (!root) {
    chapters.value = []
    return
  }
  const headings = root.querySelectorAll('h2, h3')
  const seen = new Map()
  const next = []
  headings.forEach((el, idx) => {
    const text = (el.textContent || '').trim()
    if (!text) return
    let base = slugify(text)
    // Disambiguate identical headings by suffixing -2, -3 ...
    const count = (seen.get(base) || 0) + 1
    seen.set(base, count)
    const id = count === 1 ? base : `${base}-${count}`
    el.id = id
    next.push({ id, text, level: el.tagName === 'H3' ? 3 : 2, order: idx })
  })
  chapters.value = next
}

function setupObserver() {
  if (observer) observer.disconnect()
  if (typeof IntersectionObserver === 'undefined') return
  const root = props.bodyRef?.value
  if (!root) return

  // Pick the heading whose top is closest to (but above) the
  // viewport-top trigger zone. rootMargin lifts the trigger ~30% down
  // the viewport so a chapter feels "active" once its title is near
  // the reading area, not only when it scrolls fully out of view.
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) {
        activeId.value = visible[0].target.id
      }
    },
    { rootMargin: '0px 0px -65% 0px', threshold: [0, 1] },
  )
  root.querySelectorAll('h2, h3').forEach((el) => observer.observe(el))
}

function refresh() {
  extractChapters()
  setupObserver()
}

function scrollTo(id) {
  const root = props.bodyRef?.value
  if (!root) return
  const el = root.querySelector(`#${CSS.escape(id)}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // Update hash so deep-linking + back-button work without forcing a
  // navigation — vue-router would re-render, which is overkill here.
  if (typeof history !== 'undefined' && history.replaceState) {
    history.replaceState(null, '', `#${id}`)
  }
  activeId.value = id
}

const hasContent = computed(() => chapters.value.length > 1)

onMounted(() => {
  refresh()
  // If a hash is present in the URL on mount, jump to it once the DOM
  // has settled. We do this here (not in scrollTo above) so the
  // initial-load case doesn't fight the browser's own anchor jump.
  if (typeof location !== 'undefined' && location.hash) {
    const id = location.hash.slice(1)
    requestAnimationFrame(() => scrollTo(id))
  }
})

watch(() => props.version, refresh)

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  observer = null
})
</script>

<template>
  <aside
    v-if="hasContent"
    class="chapter-rail"
    aria-label="Story chapters"
    data-testid="chapter-rail"
  >
    <h2 class="rail-title">Chapters</h2>
    <nav class="rail-nav">
      <a
        v-for="ch in chapters"
        :key="ch.id"
        :href="`#${ch.id}`"
        class="rail-link"
        :class="{
          active: activeId === ch.id,
          'level-2': ch.level === 2,
          'level-3': ch.level === 3,
        }"
        :data-testid="`chapter-link-${ch.id}`"
        @click.prevent="scrollTo(ch.id)"
      >
        {{ ch.text }}
      </a>
    </nav>
  </aside>
</template>

<style scoped>
.chapter-rail {
  width: 220px;
  flex-shrink: 0;
  align-self: flex-start;
  position: sticky;
  top: 5rem;
  border-left: 1px solid var(--border);
  padding-left: 1rem;
  font-size: 0.78rem;
}
.rail-title {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-weight: 600;
  margin: 0 0 0.6rem;
}
.rail-nav { display: flex; flex-direction: column; gap: 0.15rem; }
.rail-link {
  color: var(--muted);
  text-decoration: none;
  padding: 0.25rem 0.4rem;
  border-left: 2px solid transparent;
  margin-left: -0.4rem;
  border-radius: 0 3px 3px 0;
  line-height: 1.35;
  transition: color 0.12s, border-color 0.12s, background 0.12s;
}
.rail-link.level-3 { padding-left: 1.1rem; font-size: 0.74rem; }
.rail-link:hover { color: var(--text); }
.rail-link.active {
  color: var(--accent);
  border-left-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 7%, transparent);
}

/* Hide on narrow screens — the story is the priority. The rail is a
   nicety, not load-bearing for navigation. */
@media (max-width: 1024px) {
  .chapter-rail { display: none; }
}
</style>
