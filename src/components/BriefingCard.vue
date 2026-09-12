<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * One finding on the landing feed.
 *
 * The card used to lay out one string: the sentence its query composed,
 * "A awarded 34769555 EUR to B and 1 other". Measured on a 412px phone
 * that sentence took six lines at 16px while the contract's own title —
 * the part a reader recognises — sat clamped to one 12px row underneath.
 * The hierarchy was upside down and the interesting line was the one
 * being cut.
 *
 * Now the parts get their own places, in the order a reader wants them:
 *
 *   header    date · where (NUTS chain)
 *   headline  the contract's title, or the lobbyist's name — big
 *   value     how much, compact, with the integrity badge beside it
 *   relation  who → to whom, as a structure rather than a sentence
 *
 * The parts come from `facets`, which the query emits alongside the
 * sentence. Items that predate facets keep only the sentence, and the
 * card still renders: the sentence becomes the relation row and the
 * summary the headline. Nothing here assumes facets exist.
 *
 * Colour is a 4px left border keyed on the briefing group. A painted
 * card would fight the text; a rule in the margin reads at a glance and
 * costs nothing.
 */
const props = defineProps({
  item: { type: Object, required: true },
})

const { t, locale } = useI18n()

/** Flag count → badge level, for counts of one or more. */
const LEVEL_ABOVE_ONE = { 1: 'warn', 2: 'bad' }

const facets = computed(() => props.item.facets || {})

/** The big text: what the query says the finding IS. */
const headline = computed(() => facets.value.headline || props.item.summary || '')

/** Buyer / declarant, and how many more stood beside them. */
const from = computed(() => facets.value.from || '')
const fromMore = computed(() => Number(facets.value.from_more) || 0)
/** Suppliers. `to_more` is how many the query left out of the list. */
const to = computed(() => (Array.isArray(facets.value.to) ? facets.value.to : []))
const toMore = computed(() => Number(facets.value.to_more) || 0)

/** True once the query gave us parts; false for a sentence-only item. */
const structured = computed(() => Boolean(from.value || to.value.length))

const value = computed(() => {
  const v = facets.value.value_eur ?? props.item.rank_value
  if (v == null || !Number.isFinite(Number(v))) return ''
  try {
    return new Intl.NumberFormat(locale.value, {
      style: 'currency', currency: 'EUR', notation: 'compact',
      maximumFractionDigits: 1,
    }).format(Number(v))
  } catch {
    return `${Math.round(Number(v))} EUR`
  }
})

/**
 * The integrity badge, or null when the query said nothing.
 *
 * `red_flags` is a count from the ETL's own integrity checks. Zero is a
 * finding in its own right — "this one followed the rules" — which is
 * why it gets a green mark rather than silence. One flag is worth a
 * look; two or more is worth a hard one. Null means not assessed, and an
 * unassessed award must not be painted green by default.
 */
const integrity = computed(() => {
  const n = facets.value.red_flags
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return null
  const count = Number(n)
  // Zero is a clean finding, one is worth a look, two or more a hard one.
  const level = count === 0 ? 'ok' : LEVEL_ABOVE_ONE[Math.min(count, 2)]
  const reasons = []
  if (facets.value.single_bidder === true) reasons.push(t('feed.flag_single_bidder'))
  return {
    level, count,
    label: count === 0 ? t('feed.integrity_ok') : t('feed.integrity_flags', count, { n: count }),
    reasons,
  }
})

/**
 * "Modified": the contract's chain holds more than the award, or the
 * award was never loaded and everything we know is a restatement. The
 * value shown is then the latest restated one, and the reader should
 * know it moved.
 */
const modified = computed(() => facets.value.modified === true)
const awardMissing = computed(() => facets.value.award_ingested === false)

const date = computed(() => {
  const iso = props.item.item_time
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(locale.value, {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch {
    return iso
  }
})

const link = computed(() => props.item._link || { kind: 'none' })
</script>

<template>
  <article
    class="bcard"
    :class="[`bcard--${item._group || 'default'}`, { 'bcard--linked': link.kind !== 'none' }]"
  >
    <p class="bcard-head">
      <span class="bcard-src" data-testid="feed-briefing-source">{{ item._from }}</span>
      <time v-if="date" class="bcard-date">{{ date }}</time>
      <span
        v-if="item._where"
        class="bcard-where"
        :data-testid="`feed-briefing-where-${item.item_id}`"
      >{{ item._where }}</span>
    </p>

    <!-- The headline is the link when there is one: it is the thing the
         record is about, so it is the thing a reader clicks. -->
    <template v-if="headline">
      <router-link
        v-if="link.kind === 'internal'"
        :to="link.to"
        class="bcard-headline bcard-link"
        :data-testid="`feed-briefing-link-${item.item_id}`"
      ><span :data-testid="`feed-briefing-what-${item.item_id}`">{{ headline }}</span></router-link>
      <a
        v-else-if="link.kind === 'external'"
        :href="link.to"
        target="_blank"
        rel="noopener noreferrer"
        class="bcard-headline bcard-link"
        :data-testid="`feed-briefing-link-${item.item_id}`"
      ><span :data-testid="`feed-briefing-what-${item.item_id}`">{{ headline }}</span></a>
      <p
        v-else
        class="bcard-headline"
        :data-testid="`feed-briefing-detail-${item.item_id}`"
      ><span :data-testid="`feed-briefing-what-${item.item_id}`">{{ headline }}</span></p>
    </template>

    <p v-if="value || integrity || modified" class="bcard-figures">
      <strong v-if="value" class="bcard-value" :data-testid="`feed-briefing-value-${item.item_id}`">{{ value }}</strong>
      <span
        v-if="modified"
        class="bcard-badge bcard-badge--mod"
        :data-testid="`feed-briefing-modified-${item.item_id}`"
        :title="awardMissing ? t('feed.modified_award_missing') : t('feed.modified')"
      >{{ awardMissing ? t('feed.modified_award_missing') : t('feed.modified') }}</span>
      <span
        v-if="integrity"
        class="bcard-badge"
        :class="`bcard-badge--${integrity.level}`"
        :data-testid="`feed-briefing-integrity-${item.item_id}`"
        :title="[integrity.label, ...integrity.reasons].join(' · ')"
      >
        <span class="bcard-badge-mark" aria-hidden="true">{{ integrity.level === 'ok' ? '✓' : '!' }}</span>
        <span class="bcard-badge-text">{{ integrity.label }}<template v-if="integrity.reasons.length"> · {{ integrity.reasons.join(' · ') }}</template></span>
      </span>
    </p>

    <!-- who → to whom. When the query gave no parts, the sentence it
         composed stands in, and it doubles as the link if nothing above
         could. -->
    <p
      v-if="structured"
      class="bcard-relation"
      :data-testid="`feed-briefing-relation-${item.item_id}`"
    >
      <span class="bcard-party">{{ from }}<span v-if="fromMore" class="bcard-more"> +{{ fromMore }}</span></span>
      <!-- The arrow belongs to the supplier, not to the buyer: kept in
           the same span so a wrap moves "→ B" down together rather than
           leaving the arrow dangling at the end of the line above. -->
      <span v-if="to.length" class="bcard-party">
        <span class="bcard-arrow" aria-hidden="true">→</span>
        <template v-for="(name, i) in to" :key="name">{{ i ? ', ' : '' }}{{ name }}</template>
        <span v-if="toMore" class="bcard-more"> +{{ toMore }}</span>
      </span>
    </p>
    <p v-else class="bcard-relation bcard-relation--prose">
      <router-link
        v-if="!headline && link.kind === 'internal'"
        :to="link.to"
        class="bcard-link"
        :data-testid="`feed-briefing-link-${item.item_id}`"
      >{{ item.title || item.name || item.item_id }}</router-link>
      <a
        v-else-if="!headline && link.kind === 'external'"
        :href="link.to"
        target="_blank"
        rel="noopener noreferrer"
        class="bcard-link"
        :data-testid="`feed-briefing-link-${item.item_id}`"
      >{{ item.title || item.name || item.item_id }}</a>
      <span v-else>{{ item.title || item.name || item.item_id }}</span>
    </p>
  </article>
</template>

<style scoped>
.bcard {
  --bcard-accent: var(--muted);
  position: relative;
  padding: 0.7rem 0.9rem 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  border-left: 4px solid var(--bcard-accent);
  min-width: 0;
}
/* One hue per briefing group. Chosen to sit at similar lightness so
   neither reads as "the important one", and to hold up on both the
   light and the dark ground. */
.bcard--public-investment { --bcard-accent: #2f80c9; }
.bcard--corporate-influence { --bcard-accent: #b8741a; }

.bcard-head {
  display: flex; flex-wrap: wrap; gap: 0.25rem 0.5rem; align-items: baseline;
  margin: 0 0 0.3rem; font-size: 0.74rem; color: var(--muted); min-width: 0;
}
.bcard-src { color: var(--bcard-accent); font-weight: 700; letter-spacing: 0.02em; }
.bcard-date { white-space: nowrap; }
/* No glyph between date and place: the header wraps on a phone and a
   separator that lands at the start of a line reads as a stray mark.
   The gap is the separator. */
.bcard-where { min-width: 0; overflow-wrap: anywhere; }

/* The focal text. Three lines is enough for any contract title to be
   recognisable; the full text is one tap away. */
.bcard-headline {
  margin: 0 0 0.35rem;
  font-size: 1.02rem; font-weight: 600; line-height: 1.32; color: var(--text);
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
  overflow: hidden; overflow-wrap: anywhere;
}
.bcard-link { text-decoration: none; color: inherit; }
.bcard-link:hover, .bcard-link:focus-visible { color: var(--accent); text-decoration: underline; }

.bcard-figures {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem 0.6rem;
  margin: 0 0 0.3rem;
}
.bcard-value { font-size: 1.15rem; font-weight: 700; letter-spacing: -0.01em; }

.bcard-badge {
  display: inline-flex; align-items: center; gap: 0.3rem;
  font-size: 0.72rem; font-weight: 600; padding: 0.12rem 0.5rem 0.12rem 0.4rem;
  border-radius: 999px; border: 1px solid currentColor; line-height: 1.4;
}
.bcard-badge-mark { font-weight: 800; }
.bcard-badge--ok { color: #1f8a4c; }
.bcard-badge--warn { color: #b8741a; }
.bcard-badge--bad { color: var(--negative, #c62828); }
.bcard-badge--mod { color: var(--muted, #5b6472); border-style: dashed; }

.bcard-relation {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.2rem 0.45rem;
  margin: 0; font-size: 0.84rem; color: var(--muted); min-width: 0;
}
.bcard-party { min-width: 0; overflow-wrap: anywhere; }
.bcard-arrow { color: var(--bcard-accent); font-weight: 700; }
.bcard-more { color: var(--muted); font-weight: 600; white-space: nowrap; }
.bcard-relation--prose { font-size: 0.9rem; color: var(--text); }
</style>
