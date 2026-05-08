<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listReports } from '../api/community.js'

const router = useRouter()

const stories = ref([])
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    const data = await listReports({ scope: 'public', limit: 50 })
    // The /data-stories list endpoint still returns `{ reports: [...] }`
    // (see Phase A1 — backend internals stay named Report); accept the
    // legacy `reports` key plus a future `stories` key, and the bare
    // array shape some tests use.
    stories.value = data.stories || data.reports || data || []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function truncate(text, maxLen = 180) {
  if (!text || text.length <= maxLen) return text || ''
  return text.slice(0, maxLen) + '...'
}
</script>

<template>
  <div class="feed" data-testid="feed">
    <h1 class="feed-title">Feed</h1>
    <p class="feed-sub">Public data stories from the community, newest first.</p>

    <div v-if="error" class="error-bar" data-testid="feed-error">{{ error }}</div>

    <div v-if="loading" class="loading-msg">Loading feed...</div>

    <div
      v-else-if="stories.length === 0"
      class="empty-msg"
      data-testid="feed-empty"
    >
      Nothing here yet. When people publish public data stories, they'll show up here.
    </div>

    <div v-else class="report-cards">
      <article
        v-for="s in stories"
        :key="s.id"
        class="report-card"
        :data-testid="`feed-card-${s.id}`"
        @click="router.push(`/stories/${s.id}`)"
      >
        <h2 class="card-title">{{ s.title }}</h2>
        <p v-if="s.abstract" class="card-abstract">{{ truncate(s.abstract) }}</p>
        <div v-if="s.tags && s.tags.length" class="card-tags" data-testid="feed-card-tags">
          <span v-for="t in s.tags" :key="t" class="tag-pill">{{ t }}</span>
        </div>
        <div class="card-meta">
          <span v-if="s.author">{{ s.author.name || s.author }}</span>
          <span v-if="s.updated_at">&middot; {{ formatDate(s.updated_at) }}</span>
        </div>
      </article>
    </div>
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
.report-cards { display: flex; flex-direction: column; gap: 0.75rem; }
.report-card {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1rem;
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.15s;
}
.report-card:hover { border-color: var(--accent); }
.card-title { font-size: 1rem; font-weight: 600; color: var(--text); margin: 0 0 0.35rem; }
.card-abstract { font-size: 0.8rem; color: var(--muted); line-height: 1.5; margin: 0 0 0.5rem; }
.card-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0 0 0.5rem; }
.tag-pill {
  font-size: 0.7rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: var(--accent-bg, rgba(10, 102, 194, 0.12));
  color: var(--accent, #0a66c2);
  font-weight: 500;
}
.card-meta { display: flex; gap: 0.3rem; font-size: 0.7rem; color: var(--muted); }
</style>
