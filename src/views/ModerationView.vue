<script setup>
import { ref, onMounted } from 'vue'
import { getModerationLog } from '../api/community.js'

const activeTab = ref('flagged')
const flaggedItems = ref([])
const moderationLog = ref([])
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  document.title = 'Moderation — Fontem'
  await fetchData()
})

async function fetchData() {
  loading.value = true
  error.value = null
  try {
    const data = await getModerationLog()
    flaggedItems.value = data.flagged || []
    moderationLog.value = data.log || data.actions || []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function reviewFlag(flagId, action) {
  error.value = null
  try {
    const token = localStorage.getItem('gmr-token')
    const res = await fetch(`/capi/flags/${encodeURIComponent(flagId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${text}`)
    }
    await fetchData()
  } catch (err) {
    error.value = err.message
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}
</script>

<template>
  <div class="mod-page" data-testid="moderation-view">
    <header class="mod-header">
      <div>
        <router-link to="/admin" class="mod-back">&larr; Admin</router-link>
        <h1>{{ $t('moderation.moderation') }}</h1>
        <p class="mod-sub">{{ $t('moderation.review_flagged_content_and_moderation_hi') }}</p>
      </div>
    </header>

    <nav class="mod-tabs" data-testid="moderation-tabs">
      <button
        class="mod-tab"
        :class="{ active: activeTab === 'flagged' }"
        data-testid="moderation-tab-flagged"
        @click="activeTab = 'flagged'"
      >{{ $t('moderation.flagged_content') }}</button>
      <button
        class="mod-tab"
        :class="{ active: activeTab === 'log' }"
        data-testid="moderation-tab-log"
        @click="activeTab = 'log'"
      >{{ $t('moderation.moderation_log') }}</button>
    </nav>

    <p v-if="error" class="mod-error" data-testid="moderation-error">{{ error }}</p>
    <p v-if="loading" class="mod-loading">{{ $t('app.loading_2') }}</p>

    <!-- Flagged Content -->
    <div v-if="activeTab === 'flagged' && !loading" data-testid="moderation-flagged">
      <div v-if="!flaggedItems.length" class="mod-empty">{{ $t('moderation.no_flagged_content') }}</div>
      <div
        v-for="item in flaggedItems"
        :key="item.id"
        class="mod-flag-item"
        data-testid="moderation-flag-item"
      >
        <div class="mod-flag-top">
          <span class="mod-flag-reason">{{ item.reason || 'No reason given' }}</span>
          <span class="mod-flag-count">{{ item.flag_count ?? 1 }} flag(s)</span>
        </div>
        <div v-if="item.content_preview" class="mod-flag-preview">{{ item.content_preview }}</div>
        <div class="mod-flag-actions">
          <button
            class="mod-action-btn mod-dismiss"
            data-testid="moderation-dismiss"
            @click="reviewFlag(item.id, 'dismiss')"
          >{{ $t('app.dismiss') }}</button>
          <button
            class="mod-action-btn mod-remove"
            data-testid="moderation-remove"
            @click="reviewFlag(item.id, 'remove')"
          >{{ $t('app.remove') }}</button>
        </div>
      </div>
    </div>

    <!-- Moderation Log -->
    <div v-if="activeTab === 'log' && !loading" data-testid="moderation-log">
      <div v-if="!moderationLog.length" class="mod-empty">{{ $t('moderation.no_moderation_actions_yet') }}</div>
      <div
        v-for="entry in moderationLog"
        :key="entry.id"
        class="mod-log-item"
        data-testid="moderation-log-item"
      >
        <div class="mod-log-top">
          <span class="mod-log-action">{{ entry.action }}</span>
          <span class="mod-log-date">{{ formatDate(entry.created_at) }}</span>
        </div>
        <div class="mod-log-detail">
          <span v-if="entry.moderator" class="mod-log-by">by {{ entry.moderator }}</span>
          <span v-if="entry.target" class="mod-log-target">{{ entry.target }}</span>
          <span v-if="entry.reason" class="mod-log-reason">— {{ entry.reason }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mod-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 1rem 4rem;
}
.mod-header {
  padding: 1.5rem 0 1rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1rem;
}
.mod-header h1 {
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0.3rem 0 0;
}
.mod-back {
  font-size: 0.85rem;
  color: var(--accent);
  text-decoration: none;
}
.mod-sub {
  font-size: 0.85rem;
  color: var(--muted);
  margin-top: 0.2rem;
}
.mod-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1rem;
}
.mod-tab {
  padding: 0.4rem 0.85rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.85rem;
  color: var(--muted);
  cursor: pointer;
}
.mod-tab.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.mod-error {
  color: #dc2626;
  font-size: 0.85rem;
}
.mod-loading {
  color: var(--muted);
  font-size: 0.85rem;
}
.mod-empty {
  color: var(--muted);
  font-size: 0.9rem;
  text-align: center;
  padding: 2rem 0;
}
.mod-flag-item {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border);
}
.mod-flag-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.3rem;
}
.mod-flag-reason {
  font-weight: 600;
  font-size: 0.9rem;
}
.mod-flag-count {
  font-size: 0.8rem;
  color: var(--muted);
}
.mod-flag-preview {
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 0.5rem;
}
.mod-flag-actions {
  display: flex;
  gap: 0.5rem;
}
.mod-action-btn {
  padding: 0.35rem 0.7rem;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  color: #fff;
}
.mod-dismiss {
  background: #6b7280;
}
.mod-remove {
  background: #dc2626;
}
.mod-action-btn:hover {
  opacity: 0.9;
}
.mod-log-item {
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--border);
}
.mod-log-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.mod-log-action {
  font-weight: 600;
  font-size: 0.9rem;
}
.mod-log-date {
  font-size: 0.8rem;
  color: var(--muted);
}
.mod-log-detail {
  font-size: 0.8rem;
  color: var(--muted);
  margin-top: 0.2rem;
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
</style>
