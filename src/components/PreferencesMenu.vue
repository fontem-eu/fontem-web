<script setup>
import { isAuthed, currentUser, logout, signOutEverywhere } from '../api/session.js'
/**
 * Preferences popover — single gear icon in the header that hosts
 * everything that used to be three separate chips: theme toggle,
 * language picker, and the sign-in / profile menu. Adds the new
 * Atlas palette selector.
 *
 * Same surface for signed-in and signed-out users — auth state
 * decides which rows appear at the bottom (sign-in link vs full
 * account menu).
 *
 * Closes on outside click, Escape, or after an action that
 * navigates / logs out.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '../composables/useTheme.js'
import { useLang } from '../composables/useLang.js'
import { useAtlasPalette } from '../composables/useAtlasPalette.js'
import { EU_LANGUAGES } from '../composables/eu-languages.js'
import { deleteAssistConversations, deleteCurrentUser } from '../api/community.js'
import UserAvatar from './UserAvatar.vue'

const router = useRouter()
const { isDark, toggle: toggleTheme } = useTheme()
const { lang, setLang } = useLang()
const { palette, setPalette, catalog: paletteCatalog } = useAtlasPalette()

const open = ref(false)
const rootRef = ref(null)

const hasToken = computed(() => isAuthed.value)

const user = computed(() => currentUser.value)

// Group the palette catalog for the select. Sequential first (most
// common), diverging next, the auto-default at the very top.
const paletteOptions = computed(() => {
  const all = Object.entries(paletteCatalog)
  const auto = all.filter(([, p]) => p.family === 'auto')
  const seq  = all.filter(([, p]) => p.family === 'sequential')
  const div  = all.filter(([, p]) => p.family === 'diverging')
  return { auto, seq, div }
})

function toggleOpen() { open.value = !open.value }
function closeMenu() { open.value = false }

function onThemeClick() {
  toggleTheme()
  // Stay open so the user sees the toggle update — single click can
  // be undone in the same gesture.
}

function onLangChange(e) { setLang(e.target.value) }

function onPaletteChange(e) { setPalette(e.target.value) }

function nav(path) {
  closeMenu()
  router.push(path)
}

function onSignInClick() {
  closeMenu()
  router.push('/login')
}

async function onSignOutClick() {
  await logout()
  globalThis.location.href = '/'
}

const signingOutEverywhere = ref(false)

async function onSignOutEverywhereClick() {
  if (!globalThis.confirm(
    'Sign out of every device that has access to your account?\n\n' +
    'Anyone currently signed in as you on any browser or device will ' +
    'be signed out within seconds.',
  )) return
  signingOutEverywhere.value = true
  try {
    await signOutEverywhere()
  } finally {
    signingOutEverywhere.value = false
    globalThis.location.href = '/'
  }
}

const clearingAiData = ref(false)
const clearAiStatus = ref(null)

async function onClearAiDataClick() {
  if (!globalThis.confirm('Delete all AI conversation history?')) return
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

const deletingAccount = ref(false)
const deleteAccountStatus = ref(null)

async function onDeleteAccountClick() {
  if (!globalThis.confirm(
    'Permanently delete your account and ALL associated data?\n\n' +
    'This includes your data stories, comments, AI conversations, and profile. ' +
    'This action cannot be undone.',
  )) return
  deletingAccount.value = true
  deleteAccountStatus.value = null
  try {
    await deleteCurrentUser()
    await logout()
    try { localStorage.removeItem('gmr-cookie-consent') } catch { /* ignore */ }
    globalThis.location.href = '/'
  } catch {
    deleteAccountStatus.value = 'error'
    setTimeout(() => { deleteAccountStatus.value = null }, 3000)
  } finally {
    deletingAccount.value = false
  }
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
  <div ref="rootRef" class="prefs">
    <!-- Signed-in indicator. Sits to the LEFT of the gear so the
         "I'm logged in as X" affordance is the leading thing the eye
         lands on. Clicking it opens the same menu — the gear stays
         too so the affordance is doubled (icon-led OR identity-led). -->
    <button
      v-if="hasToken"
      type="button"
      class="prefs-trigger prefs-avatar-trigger"
      :aria-expanded="open"
      aria-haspopup="menu"
      data-testid="prefs-avatar-trigger"
      @click.stop="toggleOpen"
    >
      <UserAvatar :user="user" :size="28" />
    </button>
    <button
      type="button"
      class="prefs-trigger"
      :aria-expanded="open"
      aria-haspopup="menu"
      :aria-label="$t('preferences_menu.preferences')"
      data-testid="prefs-menu-trigger"
      @click.stop="toggleOpen"
    >
      <!-- Gear icon -->
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>

    <div
      v-if="open"
      class="prefs-menu"
      role="menu"
      data-testid="prefs-menu"
    >
      <div v-if="hasToken && user" class="prefs-section prefs-header">
        <div v-if="user.name" class="prefs-name">{{ user.name }}</div>
        <div v-if="user.email" class="prefs-email">{{ user.email }}</div>
      </div>

      <!-- ── Display preferences (everyone) ─────────────────────── -->
      <div class="prefs-section">
        <div class="prefs-section-title">{{ $t('preferences_menu.display') }}</div>

        <button
          type="button"
          class="prefs-row prefs-row-button"
          role="menuitem"
          data-testid="prefs-theme-toggle"
          @click="onThemeClick"
        >
          <span>{{ $t('app.theme') }}</span>
          <span class="prefs-row-value">{{ isDark ? $t('theme.dark') : $t('theme.light') }}</span>
        </button>

        <label class="prefs-row" :class="{ 'prefs-row-button': false }">
          <span>{{ $t('app.language') }}</span>
          <select
            class="prefs-select"
            :value="lang"
            data-testid="prefs-lang-picker"
            @change="onLangChange"
          >
            <option v-for="l in EU_LANGUAGES" :key="l.code" :value="l.code">
              {{ l.label }}
            </option>
          </select>
        </label>

        <label class="prefs-row">
          <span>{{ $t('preferences_menu.atlas_palette') }}</span>
          <select
            class="prefs-select"
            :value="palette"
            data-testid="prefs-palette-picker"
            @change="onPaletteChange"
          >
            <optgroup v-for="(group, key) in paletteOptions" :key="key" :label="key === 'auto' ? '' : (key === 'seq' ? $t('preferences_menu.sequential') : $t('preferences_menu.diverging'))">
              <option
                v-for="[id, p] in group"
                :key="id"
                :value="id"
              >
                {{ p.label }}{{ p.cvd ? ' ✓ CVD' : '' }}
              </option>
            </optgroup>
          </select>
        </label>
      </div>

      <!-- ── Auth (signed in: account links; signed out: CTA) ────── -->
      <div class="prefs-section">
        <template v-if="hasToken">
          <div class="prefs-section-title">{{ $t('preferences_menu.account') }}</div>
          <button class="prefs-row prefs-row-button" role="menuitem" data-testid="prefs-investigations" @click="nav('/investigations')">
            <span>{{ $t('investigations.title') }}</span><span class="prefs-row-chevron">›</span>
          </button>
          <button class="prefs-row prefs-row-button" role="menuitem" data-testid="prefs-issues" @click="nav('/issues')">
            <span>{{ $t('app.issues') }}</span><span class="prefs-row-chevron">›</span>
          </button>
          <button class="prefs-row prefs-row-button" role="menuitem" data-testid="prefs-activity" @click="nav('/activity')">
            <span>{{ $t('app.activity') }}</span><span class="prefs-row-chevron">›</span>
          </button>
          <button class="prefs-row prefs-row-button" role="menuitem" data-testid="prefs-ai-usage" @click="nav('/ai-usage')">
            <span>{{ $t('preferences_menu.ai_usage') }}</span><span class="prefs-row-chevron">›</span>
          </button>
          <button class="prefs-row prefs-row-button" role="menuitem" data-testid="prefs-privacy" @click="nav('/privacy')">
            <span>{{ $t('app.privacy') }}</span><span class="prefs-row-chevron">›</span>
          </button>

          <button
            class="prefs-row prefs-row-button prefs-row-danger"
            role="menuitem"
            :disabled="clearingAiData"
            data-testid="prefs-clear-ai-data"
            @click="onClearAiDataClick"
          >
            <span>{{ clearingAiData ? $t('app.clearing') : $t('preferences_menu.clear_ai_history') }}</span>
            <span v-if="clearAiStatus === 'success'" class="prefs-row-status">✓</span>
            <span v-else-if="clearAiStatus === 'error'" class="prefs-row-status err">!</span>
          </button>

          <button
            class="prefs-row prefs-row-button prefs-row-danger"
            role="menuitem"
            :disabled="deletingAccount"
            data-testid="prefs-delete-account"
            @click="onDeleteAccountClick"
          >
            <span>{{ deletingAccount ? $t('app.deleting') : $t('preferences_menu.delete_account') }}</span>
            <span v-if="deleteAccountStatus === 'error'" class="prefs-row-status err">!</span>
          </button>

          <button
            class="prefs-row prefs-row-button"
            role="menuitem"
            :disabled="signingOutEverywhere"
            data-testid="prefs-sign-out-everywhere"
            @click="onSignOutEverywhereClick"
          >
            <span>{{ signingOutEverywhere ? $t('preferences_menu.signing_out') : $t('preferences_menu.sign_out_all_devices') }}</span>
          </button>

          <button
            class="prefs-row prefs-row-button"
            role="menuitem"
            data-testid="prefs-sign-out"
            @click="onSignOutClick"
          >
            <span>{{ $t('app.sign_out') }}</span>
          </button>
        </template>
        <template v-else>
          <button
            class="prefs-row prefs-row-button prefs-row-cta"
            role="menuitem"
            data-testid="prefs-sign-in"
            @click="onSignInClick"
          >
            <span>{{ $t('preferences_menu.sign_in') }}</span>
            <span class="prefs-row-chevron">›</span>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prefs {
  position: relative;
  /* Cluster the avatar + gear triggers without a gap inside; the
     header itself supplies the gap from neighbouring controls. */
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.prefs-trigger {
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
.prefs-trigger:hover { border-color: var(--accent); color: var(--accent); }
/* Avatar trigger — strip the rectangular border so the circular
   avatar reads cleanly. The hover state keeps the parity by tinting
   the avatar's ring via box-shadow on the inner element instead. */
.prefs-avatar-trigger {
  border-color: transparent;
  padding: 0;
}
.prefs-avatar-trigger:hover { border-color: transparent; }

.prefs-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 260px;
  max-width: 320px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.16);
  z-index: 50;
  overflow: hidden;
}

.prefs-section {
  padding: 0.55rem 0.5rem;
  border-bottom: 1px solid var(--border);
}
.prefs-section:last-child { border-bottom: none; }

.prefs-header { padding: 0.6rem 0.75rem; }
.prefs-name { font-weight: 600; font-size: 0.85rem; color: var(--text); }
.prefs-email { font-size: 0.72rem; color: var(--muted); }

.prefs-section-title {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-weight: 600;
  padding: 0.1rem 0.5rem 0.35rem;
}

.prefs-row {
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
.prefs-row-button {
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
}
.prefs-row-button:hover {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
.prefs-row-button:disabled { opacity: 0.6; cursor: not-allowed; }
.prefs-row-button.prefs-row-danger { color: #b91c1c; }
.prefs-row-button.prefs-row-cta {
  color: var(--accent);
  font-weight: 600;
}
.prefs-row-value {
  color: var(--muted);
  font-size: 0.78rem;
}
.prefs-row-chevron { color: var(--muted); }
.prefs-row-status { font-weight: 700; color: #16a34a; }
.prefs-row-status.err { color: #b91c1c; }

.prefs-select {
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
