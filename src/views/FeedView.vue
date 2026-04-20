<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listReports } from '../api/community.js'

const router = useRouter()

const reports = ref([])
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    const data = await listReports({ scope: 'public', limit: 50 })
    reports.value = data.reports || data || []
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
    <p class="feed-sub">Public reports from the community, newest first.</p>

    <div v-if="error" class="error-bar" data-testid="feed-error">{{ error }}</div>

    <div v-if="loading" class="loading-msg">Loading feed...</div>

    <div
      v-else-if="reports.length === 0"
      class="empty-msg"
      data-testid="feed-empty"
    >
      Nothing here yet. When people publish public reports, they'll show up here.
    </div>

    <div v-else class="report-cards">
      <article
        v-for="r in reports"
        :key="r.id"
        class="report-card"
        :data-testid="`feed-card-${r.id}`"
        @click="router.push(`/reports/${r.id}`)"
      >
        <h2 class="card-title">{{ r.title }}</h2>
        <p v-if="r.abstract" class="card-abstract">{{ truncate(r.abstract) }}</p>
        <div class="card-meta">
          <span v-if="r.author">{{ r.author.name || r.author }}</span>
          <span v-if="r.updated_at">&middot; {{ formatDate(r.updated_at) }}</span>
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
.card-meta { display: flex; gap: 0.3rem; font-size: 0.7rem; color: var(--muted); }
</style>
