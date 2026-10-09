<script setup>
/**
 * Everything I started or was asked to read.
 *
 * One list, not two: the question a person actually has is "what is
 * waiting for me", and splitting it by who opened the review answers a
 * different question. The rows say which is which.
 */
import { ref, onMounted } from 'vue'
import { myReviews } from '../api/community.js'
import { PAGE_SIZE, appendPage, cursorOf, mayHaveMore } from '../utils/paging.js'

const reviews = ref([])
const loading = ref(true)
const error = ref('')
// Thirty at a time, most recently active first. Nothing ever leaves this
// list, and it came back whole: the e2e account's 1,513 reviews took 22
// seconds to arrive and failed a promotion gate.
const hasMore = ref(false)
const loadingMore = ref(false)
let cursor = ''

function takePage(page) {
  hasMore.value = mayHaveMore(page, PAGE_SIZE.reviews)
  if (Array.isArray(page) && page.length) cursor = cursorOf(page.at(-1))
}

async function load() {
  try {
    const page = (await myReviews()) || []
    reviews.value = page
    takePage(page)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  try {
    const page = (await myReviews({ before: cursor })) || []
    const had = reviews.value.length
    reviews.value = appendPage(reviews.value, page)
    takePage(page)
    if (reviews.value.length === had) hasMore.value = false
  } catch (err) {
    error.value = err.message
  } finally {
    loadingMore.value = false
  }
}

function summarise(changes) {
  if (!changes) return ''
  const parts = []
  if (changes.added) parts.push(`+${changes.added}`)
  if (changes.changed) parts.push(`~${changes.changed}`)
  if (changes.removed) parts.push(`-${changes.removed}`)
  return parts.join(' ')
}

onMounted(load)
</script>

<template>
  <main class="my-reviews" data-testid="my-reviews">
    <h1>{{ $t('review.my_reviews') }}</h1>
    <p v-if="loading" class="mr-note">{{ $t('review.loading') }}</p>
    <p v-else-if="error" class="mr-error" data-testid="my-reviews-error">{{ error }}</p>
    <p
      v-else-if="!reviews.length"
      class="mr-note"
      data-testid="my-reviews-empty"
    >{{ $t('review.none_yet') }}</p>

    <ul v-else class="mr-list">
      <li v-for="r in reviews" :key="r.id" class="mr-row" data-testid="my-review-row">
        <RouterLink class="mr-link" :to="`/stories/${r.report_id}/reviews/${r.id}`">
          <span class="mr-title">{{ r.report_title || r.title }}</span>
          <span class="mr-meta">
            <span class="mr-kind">
              {{ r.kind === 'change' ? $t('review.kind_change') : $t('review.kind_article') }}
            </span>
            <span>{{ $t('review.state_' + r.state) }}</span>
            <span v-if="summarise(r.changes)" class="mr-changes">{{ summarise(r.changes) }}</span>
            <!-- Whose it is: mine to finish, or somebody else's to read. -->
            <span class="mr-who" data-testid="my-review-who">
              {{ r.mine ? $t('review.started_by_me') : $t('review.asked_of_me') }}
            </span>
          </span>
        </RouterLink>
      </li>
    </ul>
    <button
      v-if="!loading && hasMore && reviews.length"
      type="button"
      class="mr-more"
      data-testid="my-reviews-show-more"
      :disabled="loadingMore"
      @click="loadMore"
    >{{ loadingMore ? $t('app.loading_more') : $t('app.show_more') }}</button>
  </main>
</template>

<style scoped>
.my-reviews { max-width: 46rem; margin: 0 auto; padding: 1rem; }
.my-reviews h1 { font-size: 1.3rem; margin: 0 0 0.75rem; }
.mr-note { color: var(--muted, #666); font-size: 0.9rem; }
.mr-error { color: #991b1b; font-size: 0.9rem; }
.mr-list { list-style: none; margin: 0; padding: 0; }
.mr-row { border-top: 1px solid var(--border, #eee); }
.mr-link {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.65rem 0.25rem;
  color: inherit;
  text-decoration: none;
  touch-action: manipulation;
}
.mr-link:hover { background: var(--bezel, rgb(0 0 0 / 4%)); }
.mr-title { font-size: 0.95rem; }
.mr-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.76rem;
  color: var(--muted, #666);
}
.mr-kind { font-weight: 600; }
.mr-changes { font-variant-numeric: tabular-nums; }
.mr-more {
  display: block;
  margin: 1rem auto 0;
  padding: 0.45rem 0.9rem;
  border: 1px solid var(--border, #eee);
  border-radius: 6px;
  background: var(--surface, transparent);
  color: inherit;
  cursor: pointer;
  font-size: 0.85rem;
  touch-action: manipulation;
}
.mr-more:disabled { opacity: 0.6; cursor: default; }
</style>
