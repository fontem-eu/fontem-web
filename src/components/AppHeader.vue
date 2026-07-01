<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import TickerSearch from './TickerSearch.vue'
import PreferencesMenu from './PreferencesMenu.vue'
import Wordmark from './Wordmark.vue'
import { useSidebar } from '../composables/useSidebar.js'

const router = useRouter()
const route = useRoute()
const { toggleMobile } = useSidebar()

/* Login has no search; the Spending tab has its own centered search
 * card so the header search is redundant there. */
const showSearch = computed(() => route.path !== '/login' && route.path !== '/spending')
const showNavToggle = computed(() => route.path !== '/login')

function onTickerSelect(symbol) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(symbol)
  const currentView = route.params.view
  const view = isUuid ? 'profile' : (currentView || 'summary')
  router.push('/c/' + symbol + '/' + view)
}
</script>

<template>
  <header class="app-header" data-testid="app-header">
    <button
      v-if="showNavToggle"
      type="button"
      class="header-burger"
      data-testid="nav-toggle"
      :aria-label="$t('nav.menu')"
      @click="toggleMobile"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
    </button>

    <h1 class="header-logo" @click="router.push('/')">
      <Wordmark size="sm" />
    </h1>

    <div v-if="showSearch" class="header-search">
      <TickerSearch :compact="true" @select="onTickerSelect" />
    </div>

    <div class="header-right">
      <PreferencesMenu />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 70;
  height: 3.25rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0 0.75rem;
  background: var(--bezel);
  border-bottom: 1px solid var(--bezel-border);
}
@media (min-width: 640px) { .app-header { padding: 0 1rem; gap: 0.9rem; } }

.header-burger {
  display: inline-flex; align-items: center; justify-content: center;
  width: 2.1rem; height: 2.1rem; flex-shrink: 0;
  border: 0; background: transparent; color: var(--text); cursor: pointer; border-radius: 8px;
}
.header-burger:hover { background: color-mix(in srgb, var(--accent) 14%, transparent); }
/* The rail is persistent on desktop, so the burger is a mobile affordance. */
@media (min-width: 900px) { .header-burger { display: none; } }

.header-logo { flex-shrink: 0; cursor: pointer; font-size: 1.2rem; font-weight: 700; line-height: 1; }
.header-search { flex: 1; min-width: 0; max-width: 36rem; }
.header-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; margin-left: auto; }
</style>
