<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listIssues } from '../api/community.js'
import IssueCreateModal from '../components/IssueCreateModal.vue'

const router = useRouter()

const issues = ref([])
const loading = ref(true)
const error = ref(null)
const activeTab = ref('all')
const showCreate = ref(false)

const tabs = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
]

const filteredIssues = computed(() => {
  if (activeTab.value === 'all') return issues.value
  return issues.value.filter((i) => i.status === activeTab.value)
})

onMounted(async () => {
  await fetchIssues()
})

async function fetchIssues() {
  loading.value = true
  error.value = null
  try {
    const data = await listIssues()
    issues.value = data.issues || data || []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function goToIssue(id) {
  router.push(`/issues/${id}`)
}

function onCreated() {
  fetchIssues()
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
</script>

<template>
  <div class="issues-page" data-testid="issues-view">
    <header class="issues-header">
      <div>
        <h1>Issues</h1>
      </div>
      <button class="issues-raise-btn" data-testid="issues-raise-btn" @click="showCreate = true">
        Raise an Issue
      </button>
    </header>

    <nav class="issues-tabs" data-testid="issues-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="issues-tab"
        :class="{ active: activeTab === tab.key }"
        :data-testid="'issues-tab-' + tab.key"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </nav>

    <p v-if="error" class="issues-error" data-testid="issues-error">{{ error }}</p>
    <p v-if="loading" class="issues-loading">Loading issues...</p>

    <div v-if="!loading && !filteredIssues.length" class="issues-empty" data-testid="issues-empty">
      No issues found.
    </div>

    <ul v-if="!loading && filteredIssues.length" class="issues-list" data-testid="issues-list">
      <li
        v-for="issue in filteredIssues"
        :key="issue.id"
        class="issues-item"
        data-testid="issues-item"
        @click="goToIssue(issue.id)"
      >
        <div class="issues-item-top">
          <span class="issues-item-title">{{ issue.title }}</span>
          <span class="issues-pill" :class="statusClass(issue.status)" data-testid="issues-status">
            {{ issue.status }}
          </span>
        </div>
        <div class="issues-item-meta">
          <span v-if="issue.entity_type" class="issues-entity" data-testid="issues-entity">
            {{ issue.entity_type }}: {{ issue.entity_id }}
          </span>
          <span class="issues-votes">{{ issue.vote_count ?? 0 }} votes</span>
          <span class="issues-comments">{{ issue.comment_count ?? 0 }} comments</span>
          <span class="issues-date">{{ formatDate(issue.created_at) }}</span>
        </div>
      </li>
    </ul>

    <IssueCreateModal
      :visible="showCreate"
      @close="showCreate = false"
      @created="onCreated"
    />
  </div>
</template>

<style scoped>
.issues-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 1rem 4rem;
}
.issues-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.5rem 0 1rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1rem;
}
.issues-header h1 {
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0.3rem 0 0;
}
.issues-raise-btn {
  padding: 0.5rem 1rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  cursor: pointer;
  align-self: center;
}
.issues-raise-btn:hover {
  opacity: 0.9;
}
.issues-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1rem;
}
.issues-tab {
  padding: 0.4rem 0.85rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.85rem;
  color: var(--muted);
  cursor: pointer;
}
.issues-tab.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.issues-error {
  color: #dc2626;
  font-size: 0.85rem;
}
.issues-loading {
  color: var(--muted);
  font-size: 0.85rem;
}
.issues-empty {
  color: var(--muted);
  font-size: 0.9rem;
  text-align: center;
  padding: 2rem 0;
}
.issues-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.issues-item {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}
.issues-item:hover {
  background: var(--surface);
}
.issues-item-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
}
.issues-item-title {
  font-weight: 600;
  font-size: 0.95rem;
  flex: 1;
}
.issues-pill {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  white-space: nowrap;
}
.pill-open { background: #dbeafe; color: #1d4ed8; }
.pill-resolved { background: #dcfce7; color: #15803d; }
.pill-rejected { background: #fee2e2; color: #b91c1c; }
.pill-closed { background: #e5e5e5; color: #6b6b6b; }
.issues-item-meta {
  display: flex;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: var(--muted);
  flex-wrap: wrap;
}
.issues-entity {
  font-weight: 500;
}
</style>
