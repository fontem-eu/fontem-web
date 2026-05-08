<script setup>
/**
 * Sideways-scrolling carousel for the "Recently published" landing
 * strip. Auto-advances every 5s. User interaction (touch, mouse hover,
 * keyboard focus) pauses; ~3s after the last interaction ends, autoplay
 * resumes. Tap a dot to jump.
 *
 * Accessibility: aria-roledescription="carousel", live region announces
 * the active index, prefers-reduced-motion disables autoplay (the strip
 * still works as a manually-scrollable list).
 */
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  stories: { type: Array, required: true },
})

const router = useRouter()

const trackRef = ref(null)
const currentIndex = ref(0)
const paused = ref(false)

// Autoplay lifecycle. Two timers:
//   `autoTimer`   — fires every AUTO_MS, advancing by one card.
//   `resumeTimer` — set when the user finishes interacting; resumes
//                   autoplay after RESUME_MS so the user has a moment
//                   to read before the carousel moves under them.
const AUTO_MS = 5000
const RESUME_MS = 3000
let autoTimer = null
let resumeTimer = null

function scrollToIndex(i) {
  const track = trackRef.value
  if (!track) return
  const child = track.children[i]
  if (!child) return
  // offsetLeft of child relative to its (positioned) parent — the track
  // has scrollable overflow, so we scroll the track itself.
  track.scrollTo({
    left: child.offsetLeft - track.offsetLeft,
    behavior: 'smooth',
  })
}

function next() {
  if (paused.value || props.stories.length === 0) return
  currentIndex.value = (currentIndex.value + 1) % props.stories.length
  scrollToIndex(currentIndex.value)
}

function startAuto() {
  if (autoTimer) clearInterval(autoTimer)
  autoTimer = setInterval(next, AUTO_MS)
}

function stopAuto() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null }
}

function pause() {
  paused.value = true
  stopAuto()
  if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null }
}

function scheduleResume() {
  if (resumeTimer) clearTimeout(resumeTimer)
  resumeTimer = setTimeout(() => {
    paused.value = false
    startAuto()
  }, RESUME_MS)
}

function goTo(i) {
  pause()
  currentIndex.value = i
  scrollToIndex(i)
  scheduleResume()
}

function onCardClick(story) {
  // Pointerdown already paused via @pointerdown on the root; the click
  // navigates and the component unmounts, so no resume needed.
  router.push(`/stories/${story.id}`)
}

// Detect manual scroll (swipe / trackpad) and sync currentIndex to the
// card whose leading edge is closest to scrollLeft. Only meaningful
// while paused — during autoplay, our own smooth-scroll fires this too.
function onScroll() {
  if (!paused.value) return
  const track = trackRef.value
  if (!track) return
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < track.children.length; i++) {
    const off = track.children[i].offsetLeft - track.offsetLeft
    const d = Math.abs(off - track.scrollLeft)
    if (d < bestDist) { bestDist = d; best = i }
  }
  if (best !== currentIndex.value) currentIndex.value = best
}

let prefersReduced = false

onMounted(() => {
  prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
  if (!prefersReduced && props.stories.length > 1) startAuto()
})

onBeforeUnmount(() => {
  stopAuto()
  if (resumeTimer) clearTimeout(resumeTimer)
})

// If the stories list grows after mount (e.g. tests inject new data),
// kick autoplay back on.
watch(() => props.stories.length, (n, prev) => {
  if (!prefersReduced && n > 1 && prev <= 1) startAuto()
  if (n <= 1) stopAuto()
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function truncate(text, maxLen = 140) {
  if (!text || text.length <= maxLen) return text || ''
  return text.slice(0, maxLen) + '…'
}
</script>

<template>
  <div
    class="carousel"
    role="region"
    aria-roledescription="carousel"
    aria-label="Recently published data stories"
    data-testid="recent-carousel"
    @pointerdown="pause"
    @pointerup="scheduleResume"
    @pointercancel="scheduleResume"
    @pointerleave="scheduleResume"
    @mouseenter="pause"
    @mouseleave="scheduleResume"
    @focusin="pause"
    @focusout="scheduleResume"
  >
    <div ref="trackRef" class="track" @scroll.passive="onScroll">
      <article
        v-for="(s, i) in stories"
        :key="s.id"
        class="card"
        :class="{ active: i === currentIndex }"
        :data-testid="`recent-story-${s.id}`"
        :aria-current="i === currentIndex ? 'true' : null"
        :tabindex="0"
        @click="onCardClick(s)"
        @keydown.enter="onCardClick(s)"
        @keydown.space.prevent="onCardClick(s)"
      >
        <h3 class="title">{{ s.title }}</h3>
        <p v-if="s.abstract" class="abstract">{{ truncate(s.abstract) }}</p>
        <div class="meta">
          <span v-if="s.updated_at">{{ formatDate(s.updated_at) }}</span>
        </div>
      </article>
    </div>

    <div
      v-if="stories.length > 1"
      class="dots"
      role="tablist"
      aria-label="Carousel position"
      data-testid="recent-carousel-dots"
    >
      <button
        v-for="(s, i) in stories"
        :key="s.id"
        type="button"
        class="dot"
        :class="{ active: i === currentIndex }"
        :aria-label="`Show story ${i + 1} of ${stories.length}`"
        :aria-selected="i === currentIndex"
        role="tab"
        @click="goTo(i)"
      />
    </div>

    <span class="visually-hidden" aria-live="polite">
      Story {{ currentIndex + 1 }} of {{ stories.length }}
    </span>
  </div>
</template>

<style scoped>
.carousel {
  position: relative;
}
.track {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  padding: 0.25rem 0.25rem 0.5rem;
  /* Hide native scrollbars on Webkit — the dots are the affordance. */
  -ms-overflow-style: none;
}
.track::-webkit-scrollbar { display: none; }

.card {
  flex: 0 0 92%;
  max-width: 92%;
  scroll-snap-align: center;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 1rem;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
  /* Same-size cards even with short abstracts — keeps the carousel
     from jiggling vertically as it advances. */
  display: flex;
  flex-direction: column;
  min-height: 9rem;
}
.card:hover, .card:focus-visible {
  border-color: var(--accent, #0a66c2);
  outline: none;
}
.card.active { border-color: var(--accent, #0a66c2); }
.title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.4rem;
  color: var(--text);
}
.abstract {
  font-size: 0.88rem;
  color: var(--muted);
  margin: 0 0 0.6rem;
  line-height: 1.4;
  flex: 1;
}
.meta {
  font-size: 0.78rem;
  color: var(--muted);
}

@media (min-width: 640px) {
  .card { flex-basis: 60%; max-width: 60%; }
}
@media (min-width: 1024px) {
  .card { flex-basis: 32%; max-width: 32%; }
}

.dots {
  display: flex;
  justify-content: center;
  gap: 0.4rem;
  margin-top: 0.6rem;
}
.dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  border: 0;
  padding: 0;
  background: var(--border);
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}
.dot.active {
  background: var(--accent, #0a66c2);
  transform: scale(1.2);
}
.dot:focus-visible {
  outline: 2px solid var(--accent, #0a66c2);
  outline-offset: 2px;
}

.visually-hidden {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0);
  white-space: nowrap; border: 0;
}
</style>
