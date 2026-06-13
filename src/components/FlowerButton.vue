<script setup>
import { isAuthed } from '../api/session.js'
/**
 * FlowerButton — Medium-style clap for stories.
 *
 * Renders a small lavender-sprig icon next to a +N counter. Each
 * click adds one flower to the signed-in user's count for the
 * current story, optimistically; on failure (cap reached, network
 * error, auth lost) the optimistic update rolls back and the
 * authoritative count from the server takes over.
 *
 * The component is self-contained — it owns its own auth check
 * (SSR-safe `typeof localStorage`), fetches state on mount, and
 * exposes nothing to the parent beyond the report id prop. Unauth
 * users see the button disabled with a sign-in tooltip; the server
 * also rejects the POST, so there's no way around the gate.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getFlowers, giveFlower } from '../api/community.js'

const props = defineProps({
  reportId: { type: String, required: true },
  // Cap mirrored from FlowerService.MAX_FLOWERS_PER_USER. Defaults
  // to 50 so the disabled state works before the first GET lands,
  // and gets overwritten with the server's authoritative value once
  // the load resolves (defence in depth if the server ever raises
  // the cap without a frontend redeploy).
  maxPerUser: { type: Number, default: 50 },
})

const { t } = useI18n()

const total = ref(0)
const mine = ref(0)
// confirmedMine = server-acknowledged count (no optimistic bumps).
// We gate capReached off this so an in-flight 50th click doesn't
// flash the "max reached" tooltip during the ~RTT before the server
// confirms or the rollback restores prior state.
const confirmedMine = ref(0)
const cap = ref(props.maxPerUser)
const busy = ref(false)
const justGiven = ref(false)
let pulseTimer = null

// Inline auth check (no central composable in this repo). SSR-safe.
const hasToken = computed(
  () => typeof localStorage !== 'undefined' && isAuthed.value,
)

const capReached = computed(
  () => hasToken.value && confirmedMine.value >= cap.value,
)
const disabled = computed(() => busy.value || !hasToken.value || capReached.value)

const tooltip = computed(() => {
  if (!hasToken.value) return t('flower_button.sign_in_tooltip')
  if (capReached.value) return t('flower_button.cap_tooltip', { max: cap.value })
  return t('flower_button.give_tooltip')
})

// Accessible name has to include the count, otherwise SR users hear
// only the verb ("Give a flower") and never learn the social signal.
// aria-label on a button overrides descendant text, so build the
// label explicitly from the same data the visible text shows.
const ariaLabel = computed(() => {
  const head = t('flower_button.give', {
    total: total.value,
    mine: mine.value,
  })
  return `${head} — ${tooltip.value}`
})

async function loadState() {
  try {
    const r = await getFlowers(props.reportId)
    total.value = r.total ?? 0
    mine.value = r.mine ?? 0
    confirmedMine.value = r.mine ?? 0
    if (typeof r.max_per_user === 'number') cap.value = r.max_per_user
  } catch {
    // 404 on a private story or backend hiccup — leave the counter
    // at 0 and disabled. No toast: this widget should never be
    // load-bearing for the page itself.
  }
}

async function give() {
  if (disabled.value) return
  busy.value = true
  // Optimistic: bump both counters before the request fires so the
  // user gets immediate feedback. confirmedMine stays put — the
  // capReached gate reads from it, so an in-flight 50th click can't
  // briefly flash "max reached".
  const prevTotal = total.value
  const prevMine = mine.value
  total.value = prevTotal + 1
  mine.value = prevMine + 1
  justGiven.value = true
  if (pulseTimer) clearTimeout(pulseTimer)
  pulseTimer = setTimeout(() => { justGiven.value = false }, 1200)
  try {
    const r = await giveFlower(props.reportId)
    // Replace the optimistic values with the server's authoritative
    // numbers — keeps us aligned with other concurrent clappers.
    if (r && typeof r.total === 'number') total.value = r.total
    if (r && typeof r.mine === 'number') {
      mine.value = r.mine
      confirmedMine.value = r.mine
    }
    if (r && typeof r.max_per_user === 'number') cap.value = r.max_per_user
  } catch {
    // Rollback on any failure (400 cap, 401 stale token, 5xx).
    total.value = prevTotal
    mine.value = prevMine
  } finally {
    busy.value = false
  }
}

onMounted(loadState)
onUnmounted(() => {
  if (pulseTimer) clearTimeout(pulseTimer)
})
</script>

<template>
  <button
    type="button"
    class="flower-btn"
    :class="{ 'flower-given': justGiven, 'flower-cap': capReached }"
    :disabled="disabled"
    :title="tooltip"
    :aria-label="ariaLabel"
    data-testid="flower-button"
    @click="give"
  >
    <!-- Tiny lavender sprig: a stem with a few bud circles. fill /
         stroke use currentColor so theme + state drive the colour. -->
    <svg
      class="flower-icon"
      width="14"
      height="14"
      viewBox="0 0 24 32"
      aria-hidden="true"
    >
      <g stroke="currentColor" stroke-linecap="round" fill="none" stroke-width="1.4">
        <line x1="12" y1="17" x2="12" y2="30" />
        <path d="M12 23 q-3 -1 -4.5 -3" />
        <path d="M12 25 q3 -1 4.5 -3" />
      </g>
      <g fill="currentColor">
        <circle cx="12" cy="3.2" r="1.6" />
        <circle cx="9.6" cy="6.3" r="1.7" />
        <circle cx="14.4" cy="6.3" r="1.7" />
        <circle cx="12" cy="9.4" r="1.8" />
        <circle cx="9.4" cy="12.3" r="1.7" />
        <circle cx="14.6" cy="12.3" r="1.7" />
        <circle cx="12" cy="15.2" r="1.5" />
      </g>
    </svg>
    <span class="flower-count" data-testid="flower-count">{{ total }}</span>
    <!-- Sub-divided section: visible separator + the caller's own
         count rendered as "+N" so it reads as a contribution, not
         metadata. Hidden when mine=0 to avoid a "+0" pill on a
         story you haven't clapped. -->
    <span
      v-if="mine > 0"
      class="flower-mine"
      data-testid="flower-mine"
    >+{{ mine }}</span>
  </button>
</template>

<style scoped>
.flower-btn {
  display: inline-flex;
  align-items: stretch;
  gap: 0;
  /* No horizontal padding — the inner segments own their padding so
     the divider runs the full vertical height of the pill. */
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--brand-secondary);
  font-size: 0.9rem;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
  user-select: none;
}
.flower-btn:hover:not(:disabled) {
  border-color: var(--brand-secondary);
  background: color-mix(in oklab, var(--brand-secondary) 10%, var(--surface));
}
.flower-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
/* Brief "you gave a flower" pulse — slight scale + colour bump so
   the click reads as a tactile action without firing a toast. */
.flower-btn.flower-given {
  color: var(--accent);
  border-color: var(--accent);
  transform: scale(1.04);
  transition: transform 180ms ease;
}
.flower-btn.flower-cap {
  color: var(--muted);
}
.flower-icon {
  flex: 0 0 auto;
  margin-left: 0.7rem;
  align-self: center;
}
.flower-count {
  padding: 0.45rem 0.7rem 0.45rem 0.4rem;
  display: inline-flex;
  align-items: center;
}
/* The +N sub-section: visibly divided from the total via a left
   border, slightly tinted background so it reads as a distinct
   "your contribution" panel. Sits flush against the right edge. */
.flower-mine {
  padding: 0.45rem 0.75rem;
  border-left: 1px solid var(--border);
  background: color-mix(in oklab, var(--brand-secondary) 8%, transparent);
  color: var(--brand-secondary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  display: inline-flex;
  align-items: center;
}
.flower-btn:hover:not(:disabled) .flower-mine {
  border-left-color: var(--brand-secondary);
  background: color-mix(in oklab, var(--brand-secondary) 16%, transparent);
}
.flower-btn.flower-given .flower-mine {
  border-left-color: var(--accent);
  color: var(--accent);
}
</style>
