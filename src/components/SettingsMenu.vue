<script setup>
/**
 * Display-settings popover — the gear.
 *
 * Everything here is a client-side display preference persisted to
 * localStorage (theme, UI language, atlas palette). None of it needs an
 * account, so this surface is identical signed-in and signed-out and
 * carries NO account rows: identity lives in ProfileMenu (header) and
 * the account item at the bottom of the rail.
 *
 * Why it exists: 5dd542d ("lean profile menu") replaced the old
 * PreferencesMenu with ProfileMenu and moved display preferences to
 * /account. /account itself stayed public, but the only affordance
 * pointing at it reads "Log in" when signed out — so a visitor who
 * wanted a different language had no discoverable way to pick one.
 *
 * Mounted twice — header bezel and rail bottom — because both are
 * places people look for settings. Each instance owns its own `open`
 * state, so at most one menu is ever in the DOM.
 */
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import { useLang } from '../composables/useLang.js'
import { useAtlasPalette } from '../composables/useAtlasPalette.js'
import { EU_LANGUAGES } from '../composables/eu-languages.js'
import RailIcon from './RailIcon.vue'

const props = defineProps({
  // 'header' drops the menu below the gear, right-aligned to the bezel.
  // 'rail' anchors it beside the rail and opens upward.
  placement: { type: String, default: 'header' },
  // Rail only: hide the text label when the rail is icon-width.
  collapsed: { type: Boolean, default: false },
})

const { isDark, toggle: toggleTheme } = useTheme()
const { lang, setLang } = useLang()
const { palette, setPalette, catalog: paletteCatalog } = useAtlasPalette()

const open = ref(false)
const rootRef = ref(null)
const triggerRef = ref(null)
const menuRef = ref(null)
const menuStyle = ref({})
// Teleport only once we're on the client: during SSR <body> isn't a
// mountable target and the menu is closed anyway.
const mounted = ref(false)

const isRail = computed(() => props.placement === 'rail')

// Sequential first (the common case), diverging next, auto pinned top.
const paletteOptions = computed(() => {
  const all = Object.entries(paletteCatalog)
  return {
    auto: all.filter(([, p]) => p.family === 'auto'),
    seq: all.filter(([, p]) => p.family === 'sequential'),
    div: all.filter(([, p]) => p.family === 'diverging'),
  }
})

/**
 * The menu is teleported to <body> and positioned in viewport
 * coordinates. Two separate ancestors would otherwise hide it:
 *
 *  - `.rail` sets `overflow-y: auto`, which per CSS forces overflow-x to
 *    `auto` as well, so an absolutely-positioned popover is clipped by
 *    the rail rather than overlapping the page;
 *  - below 900px `.rail` also sets `transform: translateX(...)` for the
 *    drawer slide, and a transformed ancestor becomes the containing
 *    block for `position: fixed` descendants — so even fixed positioning
 *    was still being clipped by the rail on mobile.
 *
 * Teleporting sidesteps both: nothing between the menu and <body> can
 * clip it, whatever the rail does with transforms or overflow later.
 */
// Fallback only — the menu is min-width 260 / max-width 320 and its
// real width depends on the longest translated label, so clamping
// against this constant alone let it overhang the viewport (measured
// 279px at 412px wide, running to x=423). Once it has rendered we
// re-clamp against the measured width.
const MENU_W = 260
function updatePosition() {
  if (!triggerRef.value) return
  const r = triggerRef.value.getBoundingClientRect()
  const vw = globalThis.innerWidth || 0
  const vh = globalThis.innerHeight || 0
  const mw = menuRef.value?.offsetWidth || MENU_W
  const style = { position: 'fixed' }
  if (isRail.value) {
    // Beside the rail, opening upward from the trigger.
    style.left = Math.max(8, Math.min(r.right + 8, vw - mw - 8)) + 'px'
    style.bottom = Math.max(8, vh - r.bottom) + 'px'
  } else {
    // Under the gear, right-aligned to it.
    style.left = Math.max(8, Math.min(r.right - mw, vw - mw - 8)) + 'px'
    style.top = Math.min(r.bottom + 6, Math.max(8, vh - 8)) + 'px'
  }
  menuStyle.value = style
}

async function toggleOpen() {
  open.value = !open.value
  if (!open.value) return
  updatePosition()      // place it before paint, using the fallback width
  await nextTick()
  updatePosition()      // re-clamp now that its real width is known
}
function closeMenu() { open.value = false }

function onThemeClick() {
  // Stay open: a theme flip is the one setting you want to see land and
  // possibly undo in the same gesture.
  toggleTheme()
}
function onLangChange(e) { setLang(e.target.value) }
function onPaletteChange(e) { setPalette(e.target.value) }

function onDocumentClick(event) {
  // The menu is teleported out of this component's subtree, so testing
  // rootRef alone would treat a click on the language picker as an
  // outside click and shut the menu mid-interaction.
  if (rootRef.value && rootRef.value.contains(event.target)) return
  if (menuRef.value && menuRef.value.contains(event.target)) return
  closeMenu()
}
function onKeydown(event) { if (event.key === 'Escape') closeMenu() }

onMounted(() => {
  mounted.value = true
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
  globalThis.addEventListener('resize', updatePosition)
  // Capture phase: the rail scrolls independently of the page, so a
  // bubbling listener on window would miss it and leave the menu behind.
  globalThis.addEventListener('scroll', updatePosition, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
  globalThis.removeEventListener('resize', updatePosition)
  globalThis.removeEventListener('scroll', updatePosition, true)
})
</script>

<template>
  <div ref="rootRef" class="settings" :class="isRail ? 'settings--rail' : 'settings--header'">
    <button
      ref="triggerRef"
      type="button"
      :class="isRail ? 'settings-rail-trigger' : 'settings-trigger'"
      :aria-expanded="open"
      aria-haspopup="menu"
      :aria-label="$t('preferences_menu.preferences')"
      :title="isRail && collapsed ? $t('preferences_menu.preferences') : null"
      :data-testid="isRail ? 'rail-settings' : 'settings-trigger'"
      @click.stop="toggleOpen"
    >
      <RailIcon v-if="isRail" name="settings" />
      <svg
        v-else
        width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
      <span v-if="isRail" class="rail-label">{{ $t('preferences_menu.preferences') }}</span>
    </button>

    <Teleport v-if="mounted" to="body">
      <div
        v-if="open"
        ref="menuRef"
        class="settings-menu"
        :class="isRail ? 'settings-menu--rail' : 'settings-menu--header'"
        :style="menuStyle"
        role="menu"
        data-testid="settings-menu"
      >
      <div class="settings-section">
        <div class="settings-section-title">{{ $t('preferences_menu.display') }}</div>

        <button
          type="button"
          class="settings-row settings-row-button"
          role="menuitem"
          data-testid="settings-theme"
          @click="onThemeClick"
        >
          <span>{{ $t('app.theme') }}</span>
          <span class="settings-row-value">{{ isDark ? $t('theme.dark') : $t('theme.light') }}</span>
        </button>

        <label class="settings-row">
          <span>{{ $t('app.language') }}</span>
          <select
            class="settings-select"
            :value="lang"
            data-testid="settings-lang"
            @change="onLangChange"
          >
            <option v-for="l in EU_LANGUAGES" :key="l.code" :value="l.code">{{ l.label }}</option>
          </select>
        </label>

        <label class="settings-row">
          <span>{{ $t('preferences_menu.atlas_palette') }}</span>
          <select
            class="settings-select"
            :value="palette"
            data-testid="settings-palette"
            @change="onPaletteChange"
          >
            <optgroup
              v-for="(group, key) in paletteOptions"
              :key="key"
              :label="key === 'auto' ? '' : (key === 'seq' ? $t('preferences_menu.sequential') : $t('preferences_menu.diverging'))"
            >
              <option v-for="[id, p] in group" :key="id" :value="id">
                {{ p.label }}{{ p.cvd ? ' ✓ CVD' : '' }}
              </option>
            </optgroup>
          </select>
          </label>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.settings { position: relative; display: inline-flex; align-items: center; }
.settings--rail { display: block; }

.settings-trigger {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 0.3rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.settings-trigger:hover { border-color: var(--accent); color: var(--accent); }
.settings-trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Mirrors .rail-item from AppSidebar — that rule is scoped to the
   parent component, so the shape is restated here rather than shared. */
.settings-rail-trigger {
  display: flex; align-items: center; gap: 0.7rem;
  padding: 0.55rem 0.6rem; border-radius: 8px;
  color: var(--muted); font-size: 0.9rem; font-weight: 500;
  white-space: nowrap; border: 0; background: transparent;
  cursor: pointer; width: 100%; text-align: left;
  transition: background 0.12s, color 0.12s;
}
.settings-rail-trigger:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--text);
}
.settings-rail-trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.settings-rail-trigger .rail-label { overflow: hidden; text-overflow: ellipsis; }

.settings-menu {
  min-width: 260px;
  max-width: 320px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.16);
  z-index: 90;
  overflow: hidden;
}
/* Both variants are positioned inline, in viewport coordinates, by
   updatePosition() — the menu is teleported to <body> so there is no
   positioned ancestor to lay it out against. */

.settings-section { padding: 0.55rem 0.5rem; }
.settings-section-title {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-weight: 600;
  padding: 0.1rem 0.5rem 0.35rem;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  font-size: 0.82rem;
  color: var(--text);
  border-radius: 4px;
  width: 100%;
}
.settings-row-button { background: transparent; border: none; text-align: left; cursor: pointer; }
.settings-row-button:hover { background: color-mix(in srgb, var(--accent) 8%, transparent); }
.settings-row-value { color: var(--muted); font-size: 0.78rem; }

.settings-select {
  appearance: none;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 4px;
  padding: 0.15rem 1.4rem 0.15rem 0.4rem;
  font-size: 0.78rem;
  cursor: pointer;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none' stroke='%23999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='1,1 5,5 9,1'/></svg>");
  background-repeat: no-repeat;
  background-position: right 6px center;
  max-width: 12rem;
}
</style>
