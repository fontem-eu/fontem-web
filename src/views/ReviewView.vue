<script setup>
/**
 * A review, in either kind.
 *
 * A CHANGE review shows the diff between the published text and what is
 * proposed - inline, one column, because side-by-side on a phone is two
 * unreadable columns. A FULL ARTICLE review shows the article's blocks
 * as they stand, with nothing to merge.
 *
 * Both are read the same way: block by block, with the conversation
 * attached to the block it is about.
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  getReview, commentOnReview, resolveReviewComment, publishReview,
  closeReview, inviteReviewer,
} from '../api/community.js'
import { useToast } from '../composables/useToast.js'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()

const reportId = computed(() => String(route.params.id || ''))
const reviewId = computed(() => String(route.params.reviewId || ''))

const review = ref(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)
/** Which block the comment box is open on, by anchor. */
const commentingOn = ref('')
const draftComment = ref('')
const inviteId = ref('')

/** The blocks to read, whichever kind of review this is. */
const rows = computed(() => {
  if (!review.value) return []
  if (review.value.kind === 'change') {
    return (review.value.operations || []).map((op, i) => ({
      key: anchorOf(op.after || op.before, i),
      op: op.op,
      before: op.before,
      after: op.after,
    }))
  }
  return (review.value.blocks || []).map((b, i) => ({
    key: anchorOf(b, i), op: 'equal', before: b, after: b,
  }))
})

/**
 * A comment's anchor. Content-based rather than positional, so it stays
 * attached to its paragraph when something above it is edited.
 */
function anchorOf(block, index) {
  if (!block) return `#${index}`
  return `${block.label || block.type} ${(block.text || '').slice(0, 120)}`
}

function commentsFor(key) {
  return (review.value?.comments || []).filter((c) => c.anchor === key)
}

const openComments = computed(
  () => (review.value?.comments || []).filter((c) => !c.resolved).length,
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    review.value = await getReview(reportId.value, reviewId.value)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function submitComment(key) {
  const body = draftComment.value.trim()
  if (!body) return
  busy.value = true
  try {
    await commentOnReview(reportId.value, reviewId.value, body, key)
    draftComment.value = ''
    commentingOn.value = ''
    await load()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

async function resolve(commentId) {
  try {
    await resolveReviewComment(reportId.value, reviewId.value, commentId)
    await load()
  } catch (err) {
    error.value = err.message
  }
}

async function invite() {
  const who = inviteId.value.trim()
  if (!who) return
  busy.value = true
  try {
    await inviteReviewer(reportId.value, reviewId.value, who)
    inviteId.value = ''
    await load()
    toast.success(t('review.reviewer_invited'))
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

async function publish() {
  busy.value = true
  error.value = ''
  try {
    await publishReview(reportId.value, reviewId.value)
    toast.success(t('review.published'))
    router.push(`/stories/${reportId.value}`)
  } catch (err) {
    // 409: the published text moved on. Refresh first — load() clears the
    // message — then say so, and leave the proposal exactly as it was.
    const message = err.status === 409
      ? t('review.behind_warning')
      : err.message
    await load()
    error.value = message
  } finally {
    busy.value = false
  }
}

async function finish(state) {
  busy.value = true
  try {
    await closeReview(reportId.value, reviewId.value, state)
    await load()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

onMounted(load)
watch(reviewId, load)
</script>

<template>
  <main class="review-view" data-testid="review-view">
    <p v-if="loading" class="review-note">{{ $t('review.loading') }}</p>
    <p v-else-if="!review" class="review-note" data-testid="review-missing">
      {{ error || $t('review.not_found') }}
    </p>

    <template v-else>
      <header class="review-head">
        <div>
          <h1 data-testid="review-title">{{ review.title }}</h1>
          <p class="review-meta" data-testid="review-meta">
            <span class="review-kind" data-testid="review-kind">
              {{ review.kind === 'change' ? $t('review.kind_change') : $t('review.kind_article') }}
            </span>
            <span>{{ $t('review.state_' + review.state) }}</span>
            <span v-if="openComments">{{ $t('review.n_open_comments', { n: openComments }) }}</span>
          </p>
        </div>

        <div class="review-actions">
          <!-- Fast-forward only. A proposal whose base moved is shown as
               behind rather than merged over. -->
          <button
            v-if="review.kind === 'change' && review.state === 'open'"
            class="review-btn review-btn--primary"
            :disabled="busy || !review.can_publish"
            data-testid="review-publish"
            @click="publish"
          >{{ $t('review.publish') }}</button>
          <button
            v-if="review.state === 'open'"
            class="review-btn"
            :disabled="busy"
            data-testid="review-finish"
            @click="finish(review.kind === 'change' ? 'closed' : 'completed')"
          >
            {{ review.kind === 'change' ? $t('review.withdraw') : $t('review.mark_done') }}
          </button>
          <RouterLink class="review-btn" :to="`/stories/${reportId}/edit`">
            {{ $t('review.back_to_editor') }}
          </RouterLink>
        </div>
      </header>

      <p
        v-if="review.behind > 0"
        class="review-behind"
        data-testid="review-behind"
      >{{ $t('review.behind', { n: review.behind }) }}</p>
      <p v-if="error" class="review-error" data-testid="review-error">{{ error }}</p>

      <section class="review-invite">
        <label class="review-invite-label" for="review-invite-input">
          {{ $t('review.invite_reviewer') }}
        </label>
        <input
          id="review-invite-input"
          v-model="inviteId"
          class="review-invite-input"
          :placeholder="$t('review.invite_placeholder')"
          data-testid="review-invite-input"
        >
        <button
          class="review-btn"
          :disabled="busy || !inviteId.trim()"
          data-testid="review-invite"
          @click="invite"
        >{{ $t('review.invite') }}</button>
        <span
          v-if="review.reviewers?.length"
          class="review-reviewers"
          data-testid="review-reviewers"
        >{{ $t('review.n_reviewers', { n: review.reviewers.length }) }}</span>
      </section>

      <ol class="review-blocks" data-testid="review-blocks">
        <li
          v-for="row in rows"
          :key="row.key"
          class="review-row"
          :class="`review-row--${row.op}`"
          :data-op="row.op"
          data-testid="review-row"
        >
          <div class="review-block">
            <template v-if="row.op === 'replace'">
              <p class="review-line review-line--del">{{ row.before.text || row.before.label }}</p>
              <p class="review-line review-line--add">{{ row.after.text || row.after.label }}</p>
            </template>
            <p
              v-else
              class="review-line"
              :class="{
                'review-line--add': row.op === 'insert',
                'review-line--del': row.op === 'delete',
              }"
            >{{ (row.after || row.before).text || (row.after || row.before).label }}</p>
          </div>

          <ul v-if="commentsFor(row.key).length" class="review-comments">
            <li
              v-for="c in commentsFor(row.key)"
              :key="c.id"
              class="review-comment"
              :class="{ 'review-comment--resolved': c.resolved }"
              data-testid="review-comment"
            >
              <span class="review-comment-body">{{ c.body }}</span>
              <button
                v-if="!c.resolved"
                class="review-comment-resolve"
                data-testid="review-comment-resolve"
                @click="resolve(c.id)"
              >{{ $t('review.resolve') }}</button>
            </li>
          </ul>

          <div v-if="commentingOn === row.key" class="review-compose">
            <textarea
              v-model="draftComment"
              class="review-compose-input"
              rows="2"
              :placeholder="$t('review.comment_placeholder')"
              data-testid="review-comment-input"
            ></textarea>
            <button
              class="review-btn"
              :disabled="busy || !draftComment.trim()"
              data-testid="review-comment-submit"
              @click="submitComment(row.key)"
            >{{ $t('review.comment') }}</button>
          </div>
          <button
            v-else
            class="review-add-comment"
            data-testid="review-add-comment"
            @click="commentingOn = row.key; draftComment = ''"
          >{{ $t('review.add_comment') }}</button>
        </li>
      </ol>
    </template>
  </main>
</template>

<style scoped>
.review-view { max-width: 52rem; margin: 0 auto; padding: 1rem; }
.review-note { color: var(--muted, #666); }
.review-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.review-head h1 { margin: 0; font-size: 1.3rem; }
.review-meta {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
  color: var(--muted, #666);
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.review-kind { font-weight: 600; color: var(--text, #222); }
.review-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.review-btn {
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--border, #ddd);
  border-radius: 6px;
  background: none;
  color: inherit;
  font-size: 0.82rem;
  cursor: pointer;
  text-decoration: none;
  touch-action: manipulation;
}
.review-btn--primary { background: var(--accent, #1d3f8f); color: #fff; border-color: transparent; }
.review-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.review-behind {
  padding: 0.5rem 0.7rem;
  background: #fef3c7;
  color: #78350f;
  border: 1px solid #fcd34d;
  border-radius: 4px;
  font-size: 0.82rem;
}
.review-error {
  padding: 0.5rem 0.7rem;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 4px;
  font-size: 0.82rem;
}

.review-invite {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin: 0.75rem 0;
  font-size: 0.82rem;
}
.review-invite-input {
  flex: 1 1 12rem;
  min-width: 0;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--border, #ddd);
  border-radius: 6px;
}
.review-reviewers { color: var(--muted, #666); }

.review-blocks { list-style: none; margin: 0; padding: 0; }
.review-row { border-top: 1px solid var(--border, #eee); padding: 0.5rem 0; }
.review-line {
  margin: 0;
  padding: 0.3rem 0.5rem;
  border-radius: 3px;
  white-space: pre-wrap;
  font-size: 0.9rem;
}
.review-line--add { background: #e6f3ea; color: #1c6640; }
.review-line--del { background: #fae9e9; color: #94292a; text-decoration: line-through; }

.review-comments { list-style: none; margin: 0.35rem 0 0; padding: 0 0 0 0.75rem; }
.review-comment {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  font-size: 0.82rem;
  padding: 0.25rem 0 0.25rem 0.5rem;
  border-left: 2px solid var(--accent, #1d3f8f);
}
.review-comment--resolved { opacity: 0.55; text-decoration: line-through; }
.review-comment-resolve, .review-add-comment {
  border: none;
  background: none;
  color: var(--accent, #1d3f8f);
  font-size: 0.76rem;
  cursor: pointer;
  padding: 0.2rem 0;
  touch-action: manipulation;
}
.review-compose { display: flex; gap: 0.4rem; margin-top: 0.35rem; }
.review-compose-input {
  flex: 1 1 auto;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border, #ddd);
  border-radius: 6px;
  font: inherit;
  font-size: 0.85rem;
}
</style>
