<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listReports, listIssues, getCurrentUser } from '../api/community.js'

const router = useRouter()

const user = ref(null)
const activities = ref([])
const loading = ref(true)
const error = ref(null)

const hasToken = computed(() => !!localStorage.getItem('gmr-token'))

onMounted(async () => {
  if (!hasToken.value) {
    loading.value = false
    return
  }
  try {
    const [userData, reportsData, issuesData] = await Promise.allSettled([
      getCurrentUser(),
      listReports(),
      listIssues(),
    ])

    if (userData.status === 'fulfilled') user.value = userData.value

    const items = []

    /* Reports the user authored */
    if (reportsData.status === 'fulfilled') {
      const reports = reportsData.value.reports || reportsData.value || []
      for (const r of reports) {
        items.push({
          type: 'report',
          action: 'created',
          title: r.title,
          date: r.created_at || r.updated_at,
          link: `/reports/${r.id}`,
          id: `report-${r.id}`,
        })
      }
    }

    /* Issues */
    if (issuesData.status === 'fulfilled') {
      const issues = issuesData.value.issues || issuesData.value || []
      for (const i of issues) {
        items.push({
          type: 'issue',
          action: i.status === 'open' ? 'opened' : i.status,
          title: i.title,
          date: i.created_at,
          link: `/issues/${i.id}`,
          id: `issue-${i.id}`,
        })
      }
    }

    /* Sort by date descending */
    items.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0
      const db = b.date ? new Date(b.date).getTime() : 0
      return db - da
    })

    activities.value = items
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
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return dateStr }
}

function typeLabel(type) {
  const map = { report: 'Report', issue: 'Issue' }
  return map[type] || type
}
</script>

<template>
  <div class="activity-page" data-testid="activity-view">
    <header class="activity-header">
      <h1>Activity</h1>
      <p v-if="user" class="activity-user">{{ user.name || user.email }}</p>
    </header>

    <!-- Not signed in -->
    <div v-if="!hasToken" class="activity-empty" data-testid="activity-no-auth">
      <p>Sign in to see your activity.</p>
      <router-link to="/login" class="activity-sign-in">Sign in</router-link>
    </div>

    <p v-if="error" class="activity-error">{{ error }}</p>
    <p v-if="loading" class="activity-loading">Loading activity...</p>

    <!-- Empty -->
    <div
      v-if="!loading && hasToken && !activities.length && !error"
      class="activity-empty"
      data-testid="activity-empty"
    >
      No activity yet. Start by exploring the graph or creating a report.
    </div>

    <!-- Activity feed -->
    <ul v-if="!loading && activities.length" class="activity-list" data-testid="activity-list">
      <li
        v-for="item in activities"
        :key="item.id"
        class="activity-item"
        @click="router.push(item.link)"
      >
        <span class="activity-type-badge" :class="'badge-' + item.type">
          {{ typeLabel(item.type) }}
        </span>
        <div class="activity-body">
          <span class="activity-action">{{ item.action }}</span>
          <span class="activity-title">{{ item.title }}</span>
        </div>
        <span class="activity-date">{{ formatDate(item.date) }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.activity-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 1rem 4rem;
}

.activity-header {
  padding: 1.5rem 0 1rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1rem;
}

.activity-header h1 {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.activity-user {
  font-size: 0.85rem;
  color: var(--muted);
  margin: 0.25rem 0 0;
}

.activity-error {
  color: #dc2626;
  font-size: 0.85rem;
}

.activity-loading {
  color: var(--muted);
  font-size: 0.85rem;
}

.activity-empty {
  text-align: center;
  padding: 3rem 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.activity-sign-in {
  display: inline-block;
  margin-top: 0.75rem;
  padding: 0.5rem 1.2rem;
  background: var(--accent);
  color: #fff;
  text-decoration: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.activity-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.1s;
}

.activity-item:hover {
  background: var(--surface);
}

.activity-type-badge {
  flex-shrink: 0;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  white-space: nowrap;
}

.badge-report { background: #dbeafe; color: #1d4ed8; }
.badge-issue { background: #fef3c7; color: #92400e; }

.activity-body {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 0.35rem;
  align-items: baseline;
}

.activity-action {
  font-size: 0.8rem;
  color: var(--muted);
  flex-shrink: 0;
}

.activity-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-date {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: var(--muted);
  white-space: nowrap;
}
</style>
