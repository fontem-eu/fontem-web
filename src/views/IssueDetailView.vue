<script setup>
import { isAuthed, getAccessToken } from '../api/session.js'
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getIssue, addComment, voteIssue } from '../api/community.js'
import { sanitizeMarkdown } from '../utils/sanitize.js'

const route = useRoute()
const issueId = route.params.id

const issue = ref(null)
const loading = ref(true)
const error = ref(null)
const commentBody = ref('')
const submittingComment = ref(false)
const voting = ref(false)

const hasToken = computed(() => isAuthed.value)

onMounted(async () => {
  await fetchIssue()
})

async function fetchIssue() {
  loading.value = true
  error.value = null
  try {
    issue.value = await getIssue(issueId)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function submitComment() {
  if (!commentBody.value.trim()) return
  submittingComment.value = true
  error.value = null
  try {
    await addComment(issueId, commentBody.value.trim())
    commentBody.value = ''
    await fetchIssue()
  } catch (err) {
    error.value = err.message
  } finally {
    submittingComment.value = false
  }
}

async function vote(direction) {
  voting.value = true
  error.value = null
  try {
    await voteIssue(issueId, direction)
    await fetchIssue()
  } catch (err) {
    error.value = err.message
  } finally {
    voting.value = false
  }
}

async function moderateAction(action) {
  error.value = null
  try {
    const token = getAccessToken()
    const res = await fetch(`/capi/issues/${encodeURIComponent(issueId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ status: action }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${text}`)
    }
    await fetchIssue()
  } catch (err) {
    error.value = err.message
  }
}

function statusClass(status) {
  const map = { open: 'pill-open', resolved: 'pill-resolved', rejected: 'pill-rejected', closed: 'pill-closed' }
  return map[status] || 'pill-closed'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

function renderMarkdown(text) {
  if (!text) return ''
  // Minimal markdown: bold, italic, code, line breaks
  const html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
  return sanitizeMarkdown(html)
}
</script>

<template>
  <div class="issue-detail" data-testid="issue-detail-view">
    <router-link to="/issues" class="issue-back">{{ $t('nav.back_to_issues') }}</router-link>

    <p v-if="error" class="issue-error" data-testid="issue-detail-error">{{ error }}</p>
    <p v-if="loading" class="issue-loading">{{ $t('issue_detail.loading_issue') }}</p>

    <template v-if="issue">
      <!-- Header -->
      <div class="issue-header" data-testid="issue-detail-header">
        <h1>{{ issue.title }}</h1>
        <div class="issue-header-meta">
          <span class="issue-pill" :class="statusClass(issue.status)" data-testid="issue-detail-status">
            {{ issue.status }}
          </span>
          <span v-if="issue.author" class="issue-author">by {{ issue.author }}</span>
          <span class="issue-date">{{ formatDate(issue.created_at) }}</span>
          <router-link
            v-if="issue.entity_type && issue.entity_id"
            :to="`/company/${issue.entity_id}`"
            class="issue-entity-link"
            data-testid="issue-detail-entity"
          >
            {{ issue.entity_type }}: {{ issue.entity_id }}
          </router-link>
        </div>
      </div>

      <!-- Body -->
      <!-- content sanitized via DOMPurify in renderMarkdown -> sanitizeMarkdown (src/utils/sanitize.js) -->
      <!-- eslint-disable vue/no-v-html -->
      <div
        class="issue-body"
        data-testid="issue-detail-body"
        v-html="renderMarkdown(issue.body)"
      />
      <!-- eslint-enable vue/no-v-html -->

      <!-- Votes -->
      <div class="issue-votes" data-testid="issue-detail-votes">
        <button
          class="vote-btn vote-up"
          data-testid="issue-vote-up"
          :disabled="voting"
          @click="vote('up')"
        >&#9650;</button>
        <span class="vote-count">{{ issue.vote_count ?? 0 }}</span>
        <button
          class="vote-btn vote-down"
          data-testid="issue-vote-down"
          :disabled="voting"
          @click="vote('down')"
        >&#9660;</button>
      </div>

      <!-- Moderator actions -->
      <div v-if="hasToken" class="issue-mod-actions" data-testid="issue-mod-actions">
        <button class="mod-btn mod-resolve" data-testid="issue-resolve" @click="moderateAction('resolved')">{{ $t('issue_detail.resolve') }}</button>
        <button class="mod-btn mod-reject" data-testid="issue-reject" @click="moderateAction('rejected')">{{ $t('issue_detail.reject') }}</button>
        <button class="mod-btn mod-close" data-testid="issue-close" @click="moderateAction('closed')">{{ $t('app.close') }}</button>
      </div>

      <!-- Comments -->
      <div class="issue-comments" data-testid="issue-comments">
        <h2>Comments ({{ (issue.comments || []).length }})</h2>

        <div v-if="!(issue.comments || []).length" class="issue-no-comments">{{ $t('issue_detail.no_comments_yet') }}</div>

        <div
          v-for="comment in (issue.comments || [])"
          :key="comment.id"
          class="comment-item"
          data-testid="issue-comment"
        >
          <div class="comment-meta">
            <span class="comment-author">{{ comment.author || $t('app.anonymous') }}</span>
            <span class="comment-date">{{ formatDate(comment.created_at) }}</span>
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -- content sanitized via DOMPurify in renderMarkdown -> sanitizeMarkdown (src/utils/sanitize.js) -->
          <div class="comment-body" v-html="renderMarkdown(comment.body)" />
        </div>

        <!-- Add comment -->
        <div class="comment-form" data-testid="issue-comment-form">
          <textarea
            v-model="commentBody"
            class="comment-textarea"
            data-testid="issue-comment-input"
            rows="3"
            :placeholder="$t('issue_detail.add_a_comment')"
          />
          <button
            class="comment-submit"
            data-testid="issue-comment-submit"
            :disabled="submittingComment || !commentBody.trim()"
            @click="submitComment"
          >
            {{ submittingComment ? $t('app.posting') : $t('issue_detail.post_comment') }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.issue-detail {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}
.issue-back {
  font-size: 0.85rem;
  color: var(--accent);
  text-decoration: none;
}
.issue-error {
  color: #dc2626;
  font-size: 0.85rem;
  margin-top: 0.75rem;
}
.issue-loading {
  color: var(--muted);
  font-size: 0.85rem;
  margin-top: 0.75rem;
}
.issue-header {
  margin-top: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}
.issue-header h1 {
  font-size: 1.3rem;
  font-weight: 700;
  margin: 0 0 0.4rem;
}
.issue-header-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.8rem;
  color: var(--muted);
  flex-wrap: wrap;
}
.issue-pill {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
}
.pill-open { background: #dbeafe; color: #1d4ed8; }
.pill-resolved { background: #dcfce7; color: #15803d; }
.pill-rejected { background: #fee2e2; color: #b91c1c; }
.pill-closed { background: #e5e5e5; color: #6b6b6b; }
.issue-entity-link {
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}
.issue-entity-link:hover {
  text-decoration: underline;
}
.issue-body {
  padding: 1rem 0;
  font-size: 0.9rem;
  line-height: 1.6;
  border-bottom: 1px solid var(--border);
}
.issue-votes {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0;
}
.vote-btn {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.3rem 0.6rem;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--text);
}
.vote-btn:hover {
  border-color: var(--accent);
}
.vote-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.vote-count {
  font-weight: 700;
  font-size: 1rem;
  min-width: 1.5rem;
  text-align: center;
}
.issue-mod-actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border);
}
.mod-btn {
  padding: 0.4rem 0.75rem;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  color: #fff;
}
.mod-resolve { background: #16a34a; }
.mod-reject { background: #dc2626; }
.mod-close { background: #6b7280; }
.mod-btn:hover { opacity: 0.9; }
.issue-comments {
  padding-top: 1rem;
}
.issue-comments h2 {
  font-size: 1.05rem;
  font-weight: 700;
  margin: 0 0 0.75rem;
}
.issue-no-comments {
  color: var(--muted);
  font-size: 0.85rem;
  margin-bottom: 1rem;
}
.comment-item {
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--border);
}
.comment-meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--muted);
  margin-bottom: 0.3rem;
}
.comment-author {
  font-weight: 600;
  color: var(--text);
}
.comment-body {
  font-size: 0.9rem;
  line-height: 1.5;
}
.comment-form {
  margin-top: 1rem;
}
.comment-textarea {
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  font-size: 0.85rem;
  resize: vertical;
  box-sizing: border-box;
}
.comment-submit {
  margin-top: 0.5rem;
  padding: 0.45rem 0.85rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
}
.comment-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
