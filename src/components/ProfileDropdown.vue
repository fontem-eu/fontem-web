<script setup>
/**
 * User profile menu — replaces the bare "Sign out" button in AppHeader.
 *
 * Opens on click to reveal: theme toggle, AI usage metrics, sign out.
 * Closes on outside click or when a menu item is chosen.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '../composables/useTheme.js'
import { deleteAssistConversations } from '../api/community.js'

const router = useRouter()
const { isDark, toggle: toggleTheme } = useTheme()

const open = ref(false)
const rootRef = ref(null)

const user = computed(() => {
  try { return JSON.parse(localStorage.getItem('gmr-user') || 'null') } catch { return null }
})

function toggleOpen() {
  open.value = !open.value
}

function closeMenu() {
  open.value = false
}

function onThemeClick() {
  toggleTheme()
  // keep the menu open so users can see the toggle flipped
}

function onUsageClick() {
  closeMenu()
  router.push('/ai-usage')
}

function onPrivacyClick() {
  closeMenu()
  router.push('/privacy')
}

const clearingAiData = ref(false)
const clearAiStatus = ref(null)

async function onClearAiDataClick() {
  if (!window.confirm('Delete all AI conversation history?')) return
  clearingAiData.value = true
  clearAiStatus.value = null
  try {
    await deleteAssistConversations()
    clearAiStatus.value = 'success'
    setTimeout(() => { clearAiStatus.value = null }, 3000)
  } catch {
    clearAiStatus.value = 'error'
    setTimeout(() => { clearAiStatus.value = null }, 3000)
  } finally {
    clearingAiData.value = false
  }
}

function onSignOutClick() {
  localStorage.removeItem('gmr-token')
  localStorage.removeItem('gmr-user')
  window.location.href = '/'
}

function onDocumentClick(event) {
  if (!rootRef.value) return
  if (!rootRef.value.contains(event.target)) closeMenu()
}

function onKeydown(event) {
  if (event.key === 'Escape') closeMenu()
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="rootRef" class="profile-dd">
    <button
      type="button"
      class="profile-trigger"
      :aria-expanded="open"
      aria-haspopup="menu"
      aria-label="Account menu"
      data-testid="profile-menu-trigger"
      @click.stop="toggleOpen"
    >
      <img
        v-if="user?.avatar_url"
        :src="user.avatar_url"
        :alt="user.name || 'User'"
        class="profile-avatar"
        referrerpolicy="no-referrer"
      />
      <svg
        v-else
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </button>

    <div
      v-if="open"
      class="profile-menu"
      role="menu"
      data-testid="profile-menu"
    >
      <div v-if="user?.name" class="profile-menu-header">
        <div class="profile-menu-name">{{ user.name }}</div>
        <div v-if="user?.email" class="profile-menu-email">{{ user.email }}</div>
      </div>

      <button
        type="button"
        class="profile-menu-item"
        role="menuitem"
        data-testid="menu-theme-toggle"
        @click="onThemeClick"
      >
        <span class="profile-menu-icon">
          <svg
            v-if="!isDark"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
          <svg
            v-else
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        </span>
        <span>{{ isDark ? 'Light mode' : 'Dark mode' }}</span>
      </button>

      <button
        type="button"
        class="profile-menu-item"
        role="menuitem"
        data-testid="menu-ai-usage"
        @click="onUsageClick"
      >
        <span class="profile-menu-icon">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </span>
        <span>AI usage metrics</span>
      </button>

      <button
        type="button"
        class="profile-menu-item"
        role="menuitem"
        data-testid="menu-clear-ai"
        :disabled="clearingAiData"
        @click="onClearAiDataClick"
      >
        <span class="profile-menu-icon">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </span>
        <span>{{ clearingAiData ? 'Clearing...' : 'Clear AI data' }}</span>
        <span v-if="clearAiStatus === 'success'" class="profile-menu-feedback profile-menu-feedback--ok">Done</span>
        <span v-if="clearAiStatus === 'error'" class="profile-menu-feedback profile-menu-feedback--err">Failed</span>
      </button>

      <button
        type="button"
        class="profile-menu-item"
        role="menuitem"
        data-testid="menu-privacy"
        @click="onPrivacyClick"
      >
        <span class="profile-menu-icon">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </span>
        <span>Privacy policy</span>
      </button>

      <div class="profile-menu-sep" />

      <button
        type="button"
        class="profile-menu-item profile-menu-signout"
        role="menuitem"
        data-testid="sign-out-btn"
        @click="onSignOutClick"
      >
        <span class="profile-menu-icon">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </span>
        <span>Sign out</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.profile-dd {
  position: relative;
}
.profile-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--bg);
  color: var(--muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.profile-trigger:hover {
  border-color: var(--accent);
  color: var(--text);
}
.profile-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.profile-menu {
  position: absolute;
  top: calc(100% + 0.4rem);
  right: 0;
  min-width: 200px;
  padding: 0.35rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  z-index: 100;
}
.profile-menu-header {
  padding: 0.5rem 0.75rem 0.6rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 0.3rem;
}
.profile-menu-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.profile-menu-email {
  font-size: 0.72rem;
  color: var(--muted);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.profile-menu-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text);
  font-size: 0.82rem;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s;
}
.profile-menu-item:hover {
  background: var(--surface);
}
.profile-menu-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
}
.profile-menu-sep {
  height: 1px;
  background: var(--border);
  margin: 0.3rem 0;
}
.profile-menu-feedback {
  margin-left: auto;
  font-size: 0.7rem;
  font-weight: 600;
}
.profile-menu-feedback--ok {
  color: #15803d;
}
.profile-menu-feedback--err {
  color: #dc2626;
}
.profile-menu-signout {
  color: var(--muted);
}
.profile-menu-signout:hover {
  color: var(--text);
}
</style>
