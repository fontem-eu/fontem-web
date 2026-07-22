<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import TickerSearch from './TickerSearch.vue'
import ProfileMenu from './ProfileMenu.vue'
import MosaicMark from './MosaicMark.vue'
import { useSidebar } from '../composables/useSidebar.js'

const router = useRouter()
const route = useRoute()
const { toggleMobile, toggleCollapsed, mobileOpen } = useSidebar()

/* Login has no search; the Spending tab has its own centered search
 * card so the header search is redundant there. */
const showSearch = computed(() => route.path !== '/login' && route.path !== '/spending')
const hasNav = computed(() => route.path !== '/login')

// The mark IS the menu control. Below the desktop breakpoint (the rail
// is persistent from 900px up) a click opens the mobile drawer; above
// it, a click collapses/expands the persistent rail. On /login there's
// no nav, so the mark just goes home.
function onBrandClick() {
  if (!hasNav.value) { router.push('/'); return }
  const mm = typeof globalThis !== 'undefined' && globalThis.matchMedia
  const wide = typeof mm === 'function' && mm('(min-width: 900px)').matches
  if (wide) toggleCollapsed()
  else toggleMobile()
}

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
      type="button"
      class="header-brand"
      data-testid="nav-toggle"
      :aria-label="hasNav ? $t('nav.menu') : $t('wordmark.arguit')"
      :aria-expanded="hasNav ? String(mobileOpen) : undefined"
      @click="onBrandClick"
    >
      <MosaicMark :size="30" />
    </button>
    <h1 class="header-title">{{ $t('wordmark.arguit') }}</h1>

    <div v-if="showSearch" class="header-search">
      <TickerSearch :compact="true" @select="onTickerSelect" />
    </div>

    <div class="header-right">
      <ProfileMenu />
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

/* The mark is the menu control. It reads as a button — a soft hover
   plate + a clear keyboard focus ring — because a logo that also opens
   the menu isn't a convention users assume; the affordance has to be
   explicit. Present on every breakpoint (mobile: opens the drawer;
   desktop: collapses the persistent rail). */
.header-brand {
  display: inline-flex; align-items: center; justify-content: center;
  width: 2.4rem; height: 2.4rem; flex-shrink: 0; padding: 0;
  border: 0; background: transparent; cursor: pointer; border-radius: 9px;
  transition: background 120ms ease;
}
.header-brand:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.header-brand:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.header-brand :deep(.mosaic-mark) { transition: transform 140ms ease; }
.header-brand:hover :deep(.mosaic-mark) { transform: rotate(8deg); }
@media (prefers-reduced-motion: reduce) {
  .header-brand :deep(.mosaic-mark) { transition: none; }
  .header-brand:hover :deep(.mosaic-mark) { transform: none; }
}
/* The wordmark still exists for SEO + screen readers, but the name now
   lives inside the menu (rail head), not the top bar. */
.header-title {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.header-search { flex: 1; min-width: 0; max-width: 36rem; }
/* Desktop (persistent rail from 900px): centre the search in the bar,
   independent of the brand/profile widths on either side. */
@media (min-width: 900px) {
  .app-header { position: relative; }
  .header-search {
    position: absolute; left: 50%; transform: translateX(-50%);
    flex: none; width: min(36rem, 46vw);
  }
}
.header-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; margin-left: auto; }
</style>
