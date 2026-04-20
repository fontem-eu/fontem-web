<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import TickerSearch from './TickerSearch.vue'
import ThemeToggle from './ThemeToggle.vue'
import ProfileDropdown from './ProfileDropdown.vue'

const router = useRouter()
const route = useRoute()

const hasToken = computed(() => !!localStorage.getItem('gmr-token'))

/* Top-level nav tabs — only for authenticated users.
 * Issues and Activity live in the profile dropdown now. */
const navTabs = [
  { key: 'home', label: 'Home', path: '/' },
  { key: 'feed', label: 'Feed', path: '/feed' },
  { key: 'my-reports', label: 'My Reports', path: '/my-reports' },
]

function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

/* The landing page has its own centered search card, and the login
 * page has no search.  Every other page shows the compact header
 * search so users can jump to any entity. */
const showSearch = computed(() => route.path !== '/login' && route.path !== '/')

function onTickerSelect(symbol) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(symbol)
  /* Preserve the current view if we're already on a ticker page */
  const currentView = route.params.view
  const view = isUuid ? 'profile' : (currentView || 'summary')
  router.push('/c/' + symbol + '/' + view)
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
          <ProfileDropdown />
        </template>
        <template v-else>
          <router-link
            to="/login"
            class="sign-in-btn"
            data-testid="sign-in-btn"
          >
            Sign in
          </router-link>
          <ThemeToggle />
        </template>
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
