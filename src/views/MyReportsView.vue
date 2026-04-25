<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listReports, createReport } from '../api/community.js'

const router = useRouter()

const reports = ref([])
const loading = ref(true)
const error = ref(null)
const creating = ref(false)

onMounted(async () => {
  try {
    const data = await listReports({ scope: 'mine' })
    reports.value = data.reports || data || []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})

async function startNewReport() {
  creating.value = true
  error.value = null
  try {
    const report = await createReport('Untitled Analysis', '')
    if (report?.id) {
      router.push(`/reports/${report.id}/edit`)
    }
  } catch (err) {
    error.value = err.message
  } finally {
    creating.value = false
  }
}

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

function truncate(text, maxLen = 140) {
  if (!text || text.length <= maxLen) return text || ''
  return text.slice(0, maxLen) + '...'
}
</script>

<template>
  <div class="report-list" data-testid="my-reports">
    <div class="list-header">
      <h1 class="list-title">My Reports</h1>
      <button
        class="new-report-btn"
        :disabled="creating"
        data-testid="new-report-btn"
        @click="startNewReport"
      >
        {{ creating ? 'Creating...' : 'Start a new analysis' }}
      </button>
    </div>

    <div v-if="error" class="error-bar" data-testid="my-reports-error">{{ error }}</div>

    <div v-if="loading" class="loading-msg">Loading reports...</div>

    <div
      v-else-if="reports.length === 0"
      class="empty-msg"
      data-testid="my-reports-empty"
    >
      <p class="empty-msg-text">No reports yet. Start your first analysis above.</p>
      <router-link
        to="/feed"
        class="empty-cta-btn"
        data-testid="my-reports-empty-cta"
      >
        Or read recent public reports →
      </router-link>
    </div>

    <div v-else class="report-cards">
      <div
        v-for="r in reports"
        :key="r.id"
        class="report-card"
        :data-testid="`report-card-${r.id}`"
        @click="router.push(`/reports/${r.id}`)"
      >
        <div class="card-top">
          <h2 class="card-title">{{ r.title }}</h2>
          <span
            class="visibility-badge"
            :class="`badge-${r.visibility || 'private'}`"
          >
            {{ r.visibility || 'private' }}
          </span>
        </div>
        <p v-if="r.abstract" class="card-abstract">{{ truncate(r.abstract) }}</p>
        <div class="card-meta">
          <span v-if="r.author">{{ r.author.name || r.author }}</span>
          <span v-if="r.updated_at">&middot; {{ formatDate(r.updated_at) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.report-list {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}
.list-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}
.new-report-btn {
  padding: 0.5rem 1.2rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.new-report-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.error-bar {
  padding: 0.5rem 0.75rem;
  margin-bottom: 1rem;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 4px;
  font-size: 0.8rem;
}
.empty-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
.empty-msg-text { margin: 0; }
.empty-cta-btn {
  display: inline-block;
  padding: 0.45rem 1rem;
  border: 1px solid var(--accent);
  border-radius: 999px;
  font-size: 0.85rem;
  color: var(--accent);
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}
.empty-cta-btn:hover {
  background: var(--accent);
  color: #fff;
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
.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}
.card-title { font-size: 1rem; font-weight: 600; color: var(--text); margin: 0; }
.visibility-badge {
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}
.badge-public_open { background: #d1fae5; color: #065f46; }
.badge-public_auth { background: #d1fae5; color: #065f46; }
.badge-shared { background: #dbeafe; color: #1e40af; }
.badge-private { background: #f3f4f6; color: #6b7280; }
.card-abstract { font-size: 0.8rem; color: var(--muted); line-height: 1.5; margin: 0 0 0.5rem; }
.card-meta { display: flex; gap: 0.3rem; font-size: 0.7rem; color: var(--muted); }
</style>
