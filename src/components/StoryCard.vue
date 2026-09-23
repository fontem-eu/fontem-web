<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * One data story in the feed.
 *
 * Deliberately the same object as a BriefingCard — same geometry, same
 * type scale, same slots — because both are findings in one stream and a
 * reader should not have to change register between them. What differs
 * is what fills the slots and the kind's reserved colour:
 *
 *   header    ◆ Data story · date          (briefing: source · date · where)
 *   headline  the story's title            (briefing: the contract's title)
 *   abstract  the opening, clamped         (briefing: value + integrity badge)
 *   tags      what it is about             (briefing: who → to whom)
 *   byline    who wrote it
 *
 * A briefing item is produced by a query; a story is written by a
 * person. The plum rule in the margin is reserved for the latter and no
 * briefing group may use it, so the colour alone answers "did someone
 * write this?". The ◆ and the word "Data story" carry the same answer
 * for a reader who cannot use the colour.
 */
const props = defineProps({
  story: { type: Object, required: true },
})

const { t, locale } = useI18n()

const link = computed(() => `/stories/${props.story.id}`)

const date = computed(() => {
  const raw = props.story.updated_at || props.story.created_at
  if (!raw) return ''
  try {
    return new Date(raw).toLocaleDateString(locale.value, {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch {
    return ''
  }
})

const author = computed(() => {
  const a = props.story.author
  if (!a) return ''
  return typeof a === 'string' ? a : (a.name || '')
})

/** At most three: the strip is a hint at the subject, not an index. */
const tags = computed(() =>
  (Array.isArray(props.story.tags) ? props.story.tags : []).slice(0, 3))

const label = computed(() => t('feed.data_story'))
</script>

<template>
  <article class="bcard bcard--story bcard--linked" :data-testid="`feed-story-${story.id}`">
    <p class="bcard-head">
      <span class="bcard-src" data-testid="feed-story-kind">
        <span class="bcard-mark" aria-hidden="true">◆</span>
        {{ label }}
      </span>
      <time v-if="date" class="bcard-date">{{ date }}</time>
      <span v-if="author" class="bcard-where">{{ author }}</span>
    </p>

    <h3 class="bcard-headline">
      <router-link :to="link" class="bcard-link">{{ story.title }}</router-link>
    </h3>

    <p v-if="story.abstract" class="bcard-abstract">{{ story.abstract }}</p>

    <p v-if="tags.length" class="bcard-tags" data-testid="feed-story-tags">
      <span v-for="tag in tags" :key="tag" class="bcard-tag">{{ tag }}</span>
    </p>
  </article>
</template>

<!-- Styles are shared with BriefingCard: src/assets/feed-card.css -->
