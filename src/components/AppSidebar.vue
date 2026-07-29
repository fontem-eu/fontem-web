<script setup>
/**
 * Collapsible left navigation rail. Desktop: icon rail that expands to
 * icon+label (state persisted). Mobile: off-canvas drawer over a scrim,
 * opened by the header hamburger. Account/settings sits at the bottom.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { isAuthed, currentUser } from '../api/session.js'
import UserAvatar from './UserAvatar.vue'
import MosaicMark from './MosaicMark.vue'
import Wordmark from './Wordmark.vue'
import RailIcon from './RailIcon.vue'
import StudioNav from './StudioNav.vue'
import SettingsMenu from './SettingsMenu.vue'
import { useSidebar } from '../composables/useSidebar.js'

const route = useRoute()
const { t } = useI18n()
const { collapsed, mobileOpen, toggleCollapsed, closeMobile } = useSidebar()

const authed = computed(() => typeof localStorage !== 'undefined' && isAuthed.value)
const user = computed(() => currentUser.value)
const onStudio = computed(() => route.path.startsWith('/studio'))

// Three sections: view-only (Stories, Petitions), data-exploration
// (Data Stats, Atlas), and a contribution section (Studio, My Stories)
// that only appears when signed in. Spending was dropped — the always-
// visible header search covers it.
const navGroups = computed(() => {
  const groups = [
    { key: 'view', items: [
      { key: 'stories', label: t('nav.stories'), path: '/', icon: 'stories' },
      { key: 'petitions', label: t('nav.petitions'), path: '/petitions', icon: 'petitions' },
    ] },
    { key: 'data', items: [
      { key: 'data-stats', label: t('nav.data_stats'), path: '/explore', icon: 'explore' },
      { key: 'atlas', label: t('nav.atlas'), path: '/map', icon: 'map' },
    ] },
  ]
  if (authed.value) {
    groups.push({ key: 'contribute', items: [
      { key: 'studio', label: t('nav.studio'), path: '/studio', icon: 'studio' },
      { key: 'my-reports', label: t('nav.my_stories'), path: '/my-stories', icon: 'mystories' },
    ] })
  }
  return groups
})

function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>

<template>
  <div v-if="mobileOpen" class="rail-scrim" data-testid="rail-scrim" @click="closeMobile" />
  <aside
    class="rail"
    :class="{ 'rail--collapsed': collapsed, 'rail--mobile-open': mobileOpen }"
    data-testid="app-sidebar"
  >
    <router-link to="/" class="rail-head" data-testid="rail-home" @click="closeMobile">
      <MosaicMark :size="30" class="rail-head-mark" />
      <Wordmark v-if="!collapsed" size="sm" class="rail-head-wm" />
    </router-link>
    <p v-if="!collapsed" class="rail-tagline" data-testid="rail-tagline">
      {{ $t('wordmark.tagline') }}
    </p>

    <nav class="rail-nav" data-testid="app-nav" :aria-label="$t('nav.menu')">
      <template v-for="(group, gi) in navGroups" :key="group.key">
        <hr v-if="gi > 0" class="rail-sep" aria-hidden="true" >
        <template v-for="item in group.items" :key="item.key">
          <router-link
            :to="item.path"
            class="rail-item"
            :class="{ active: isActive(item.path) }"
            :data-testid="'nav-' + item.key"
            :title="collapsed ? item.label : null"
            @click="closeMobile"
          >
            <RailIcon :name="item.icon" />
            <span class="rail-label">{{ item.label }}</span>
          </router-link>
          <div v-if="item.key === 'studio' && onStudio" class="rail-studio">
            <StudioNav @navigate="closeMobile" />
          </div>
        </template>
      </template>
    </nav>

    <div class="rail-bottom">
      <!-- Above the account row on purpose: signed out, that row reads
           "Log in", and display preferences must not look like they
           live behind it. -->
      <SettingsMenu placement="rail" :collapsed="collapsed" />

      <router-link
        to="/account"
        class="rail-item rail-account"
        data-testid="rail-account"
        :title="collapsed ? (authed ? (user?.name || user?.email) : $t('nav.log_in')) : null"
        @click="closeMobile"
      >
        <UserAvatar v-if="authed" :user="user" :size="24" class="rail-avatar" />
        <RailIcon v-else name="account" />
        <span class="rail-label">{{ authed ? (user?.name || $t('nav.account')) : $t('nav.log_in') }}</span>
      </router-link>

      <button
        type="button"
        class="rail-item rail-collapse-btn"
        data-testid="rail-collapse"
        :aria-label="$t('nav.collapse')"
        @click="toggleCollapsed"
      >
        <RailIcon name="chevron" class="rail-chevron" :class="{ flip: collapsed }" />
        <span class="rail-label">{{ $t('nav.collapse') }}</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
/* Brand line under the wordmark. Muted on purpose: it orients a
   first-time visitor without competing with the nav. */
.rail-tagline {
  margin: 0.15rem 0 0.6rem;
  padding: 0 0.75rem;
  font-size: 0.7rem;
  line-height: 1.35;
  color: var(--muted);
  text-wrap: balance;
}
.rail-head {
  display: flex; align-items: center; gap: 0.55rem; text-decoration: none;
  padding: 0.55rem 0.7rem; margin-bottom: 0.35rem; border-radius: 8px;
  color: var(--text);
}
.rail-head:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.rail-head:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.rail-head-mark { flex: none; }
.rail--collapsed .rail-head { justify-content: center; padding-inline: 0; }

.rail {
  display: flex;
  flex-direction: column;
  width: 15rem;
  flex-shrink: 0;
  background: var(--bezel);
  border-right: 1px solid var(--bezel-border);
  padding: 0.75rem 0.5rem;
  /* Clear the cookie banner. It is `position: fixed; z-index: 1000` along
     the bottom edge, and the rail runs full height, so without this it
     sits on top of the rail's bottom rows — account, settings, collapse.
     On mobile that made the settings gear literally unclickable:
     elementFromPoint at its centre returned the banner, not the button.
     ToastStack and AssistPanel already consume this var; the rail was
     the one full-height surface that never adopted it. */
  padding-bottom: calc(0.75rem + var(--cookie-banner-h, 0px));
  gap: 0.25rem;
  position: sticky;
  top: var(--bezel-h, 3.25rem);
  height: calc(100vh - var(--bezel-h, 3.25rem));
  overflow-y: auto;
  transition: width 0.16s ease;
}
.rail--collapsed { width: 3.5rem; }

.rail-nav { display: flex; flex-direction: column; gap: 0.15rem; flex: 1; }
.rail-sep { height: 1px; border: 0; background: var(--bezel-border); margin: 0.45rem 0.35rem; flex: none; }
.rail-bottom { display: flex; flex-direction: column; gap: 0.15rem; border-top: 1px solid var(--bezel-border); padding-top: 0.4rem; margin-top: 0.4rem; }

.rail-item {
  display: flex; align-items: center; gap: 0.7rem;
  padding: 0.55rem 0.6rem; border-radius: 8px;
  color: var(--muted); text-decoration: none; font-size: 0.9rem; font-weight: 500;
  white-space: nowrap; border: 0; background: transparent; cursor: pointer; width: 100%;
  transition: background 0.12s, color 0.12s;
}
.rail-item:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--text); }
.rail-item.active { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--text); font-weight: 600; }
.rail-icon { width: 20px; height: 20px; flex-shrink: 0; }
.rail-avatar { flex-shrink: 0; }
.rail-label { overflow: hidden; text-overflow: ellipsis; }
.rail-chevron { transition: transform 0.16s; }
.rail-chevron.flip { transform: rotate(180deg); }

/* Collapsed (desktop): icons only, labels hidden, centred */
.rail--collapsed .rail-label { display: none; }
.rail--collapsed .rail-studio { display: none; }
.rail--collapsed .rail-item { justify-content: center; gap: 0; padding: 0.55rem; }

.rail-scrim { display: none; }

/* ── Mobile: off-canvas drawer ─────────────────────────────── */
@media (max-width: 899px) {
  .rail {
    position: fixed;
    top: var(--bezel-h, 3.25rem);
    left: 0;
    height: calc(100vh - var(--bezel-h, 3.25rem));
    width: 15rem;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    z-index: 60;
    box-shadow: 2px 0 12px rgba(0,0,0,0.18);
  }
  .rail--collapsed { width: 15rem; } /* on mobile the drawer always shows labels */
  .rail--collapsed .rail-label { display: inline; }
  .rail--collapsed .rail-studio { display: block; }
  .rail--collapsed .rail-item { justify-content: flex-start; gap: 0.7rem; padding: 0.55rem 0.6rem; }
  .rail--mobile-open { transform: translateX(0); }
  .rail-collapse-btn { display: none; } /* no icon-collapse on mobile */
  .rail-scrim {
    display: block; position: fixed; inset: 0; top: var(--bezel-h, 3.25rem);
    background: rgba(0,0,0,0.4); z-index: 55;
  }
}
</style>
