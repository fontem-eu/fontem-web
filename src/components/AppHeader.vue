<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import TickerSearch from './TickerSearch.vue'
import ThemeToggle from './ThemeToggle.vue'

const router = useRouter()
const route = useRoute()

const hasToken = computed(() => !!localStorage.getItem('gmr-token'))

const user = computed(() => {
  try { return JSON.parse(localStorage.getItem('gmr-user') || 'null') } catch { return null }
})

/* GitHub-style nav tabs — only for authenticated users */
const navTabs = [
  { key: 'reports', label: 'Reports', path: '/reports' },
  { key: 'issues', label: 'Issues', path: '/issues' },
  { key: 'activity', label: 'Activity', path: '/activity' },
]

function isActive(path) {
  return route.path.startsWith(path)
}

/* Search is hidden on landing page (has its own inline search) and login page */
const showSearch = computed(() => {
  if (route.path === '/' && !route.params.ticker) return false
  if (route.path === '/login') return false
  return true
})

function onTickerSelect(symbol) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(symbol)
  /* Preserve the current view if we're already on a ticker page */
  const currentView = route.params.view
  const view = isUuid ? 'profile' : (currentView || 'summary')
  router.push('/c/' + symbol + '/' + view)
}

function signOut() {
  localStorage.removeItem('gmr-token')
  localStorage.removeItem('gmr-user')
  window.location.href = '/'
}
</script>

<template>
  <header class="app-header">
    <div class="header-top">
      <!-- Logo -->
      <h1 class="header-logo" @click="router.push('/')">
        <span class="logo-accent">GMR</span>
        <span class="logo-sub hidden sm:inline"> Knowledge Graph</span>
      </h1>

      <!-- Search bar — shown on sub-pages -->
      <div v-if="showSearch" class="header-search">
        <TickerSearch :compact="true" @select="onTickerSelect" />
      </div>

      <!-- Right side: auth + theme -->
      <div class="header-right">
        <template v-if="hasToken">
          <img
            v-if="user?.avatar_url"
            :src="user.avatar_url"
            :alt="user.name || 'User'"
            class="user-avatar"
            referrerpolicy="no-referrer"
          />
          <span v-if="user?.name" class="user-name hidden sm:inline">{{ user.name }}</span>
          <button
            class="sign-out-btn"
            data-testid="sign-out-btn"
            @click="signOut"
          >
            Sign out
          </button>
        </template>
        <template v-else>
          <router-link
            to="/login"
            class="sign-in-btn"
            data-testid="sign-in-btn"
          >
            Sign in
          </router-link>
        </template>
        <ThemeToggle />
      </div>
    </div>

    <!-- GitHub-style nav tabs (authenticated only) -->
    <nav v-if="hasToken" class="header-nav" data-testid="app-nav">
      <router-link
        v-for="tab in navTabs"
        :key="tab.key"
        :to="tab.path"
        class="nav-tab"
        :class="{ active: isActive(tab.path) }"
        :data-testid="'nav-' + tab.key"
      >
        {{ tab.label }}
      </router-link>
    </nav>
  </header>
</template>

<style scoped>
.app-header {
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.header-top {
  max-width: 72rem;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
}

@media (min-width: 640px) {
  .header-top {
    gap: 1.5rem;
    padding: 1rem 1.5rem;
  }
}

.header-logo {
  flex-shrink: 0;
  cursor: pointer;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.01em;
}

.logo-accent { color: var(--accent); }
.logo-sub { color: var(--text); }

.header-search {
  flex: 1;
  min-width: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.sign-in-btn {
  padding: 0.35rem 0.85rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
  text-decoration: none;
  transition: border-color 0.15s;
}

.sign-in-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.user-name {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sign-out-btn {
  padding: 0.35rem 0.85rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
  background: none;
  cursor: pointer;
  transition: border-color 0.15s;
}

.sign-out-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}

/* GitHub-style underline tabs */
.header-nav {
  max-width: 72rem;
  margin: 0 auto;
  display: flex;
  gap: 0;
  padding: 0 1rem;
  overflow-x: auto;
}

@media (min-width: 640px) {
  .header-nav {
    padding: 0 1.5rem;
  }
}

.nav-tab {
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--muted);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;
}

.nav-tab:hover {
  color: var(--text);
}

.nav-tab.active {
  color: var(--text);
  font-weight: 600;
  border-bottom-color: var(--accent);
}
</style>
