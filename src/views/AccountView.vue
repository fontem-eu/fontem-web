<script setup>
/** Account & settings screen — reached from the rail's bottom item and the
 * top-right profile menu. Consolidates profile, preferences, activity/usage
 * links, and the account/data (GDPR) actions. */
import { computed, ref } from 'vue'
import { isAuthed, currentUser, logout, signOutEverywhere } from '../api/session.js'
import { deleteAssistConversations, deleteCurrentUser } from '../api/community.js'
import { useTheme } from '../composables/useTheme.js'
import { useLang } from '../composables/useLang.js'
import { useAtlasPalette } from '../composables/useAtlasPalette.js'
import { EU_LANGUAGES } from '../composables/eu-languages.js'
import UserAvatar from '../components/UserAvatar.vue'

const authed = computed(() => isAuthed.value)
const user = computed(() => currentUser.value)
const { isDark, toggle: toggleTheme } = useTheme()
const { lang, setLang } = useLang()
const { palette, setPalette, catalog: paletteCatalog } = useAtlasPalette()
const paletteKeys = computed(() => Object.keys(paletteCatalog || {}))

const busy = ref('')
async function doLogout() { await logout() }
async function doSignOutAll() {
  if (!confirm('Sign out of every device that has access to your account?')) return
  busy.value = 'all'; try { await signOutEverywhere() } finally { busy.value = '' }
}
async function doClearAi() {
  if (!confirm('Delete all of your AI assistant conversations?')) return
  busy.value = 'ai'; try { await deleteAssistConversations() } finally { busy.value = '' }
}
async function doDeleteAccount() {
  if (!confirm('Permanently delete your account and ALL associated data (stories, comments, AI conversations, profile)? This cannot be undone.')) return
  busy.value = 'del'; try { await deleteCurrentUser(); await logout() } finally { busy.value = '' }
}
</script>

<template>
  <div class="account-view" data-testid="account-view">
    <h1 class="av-title">{{ $t('account.title') }}</h1>

    <section v-if="authed" class="av-card av-profile">
      <UserAvatar :user="user" :size="48" />
      <div class="av-who">
        <div class="av-name">{{ user?.name || 'Account' }}</div>
        <div v-if="user?.email" class="av-email">{{ user.email }}</div>
      </div>
    </section>
    <section v-else class="av-card">
      <p>{{ $t('account.not_signed_in') }} <router-link to="/login" class="av-link">{{ $t('profile.log_in') }}</router-link></p>
    </section>

    <section class="av-card">
      <h2 class="av-h2">{{ $t('account.preferences') }}</h2>
      <div class="av-row"><span>{{ $t('account.theme') }}</span>
        <button class="av-btn" data-testid="account-theme" @click="toggleTheme">{{ isDark ? $t('account.dark') : $t('account.light') }}</button>
      </div>
      <div class="av-row"><span>{{ $t('account.language') }}</span>
        <select class="av-select" :value="lang" @change="setLang($event.target.value)">
          <option v-for="l in EU_LANGUAGES" :key="l.code" :value="l.code">{{ l.label || l.code }}</option>
        </select>
      </div>
      <div class="av-row"><span>{{ $t('account.map_palette') }}</span>
        <select class="av-select" :value="palette" @change="setPalette($event.target.value)">
          <option v-for="k in paletteKeys" :key="k" :value="k">{{ k }}</option>
        </select>
      </div>
    </section>

    <section class="av-card">
      <h2 class="av-h2">{{ $t('account.activity_usage') }}</h2>
      <router-link to="/ai-usage" class="av-linkrow">{{ $t('account.ai_usage_metrics') }}</router-link>
      <router-link to="/activity" class="av-linkrow">{{ $t('account.your_activity') }}</router-link>
      <router-link to="/privacy" class="av-linkrow">{{ $t('account.privacy') }}</router-link>
    </section>

    <section v-if="authed" class="av-card">
      <h2 class="av-h2">{{ $t('account.account_data') }}</h2>
      <button class="av-linkrow" data-testid="account-logout" @click="doLogout">{{ $t('profile.sign_out') }}</button>
      <button class="av-linkrow" :disabled="busy === 'all'" @click="doSignOutAll">{{ $t('profile.sign_out_all') }}</button>
      <button class="av-linkrow" :disabled="busy === 'ai'" @click="doClearAi">{{ $t('profile.delete_ai_data') }}</button>
      <button class="av-linkrow av-danger" :disabled="busy === 'del'" @click="doDeleteAccount">{{ $t('profile.delete_account') }}</button>
    </section>
  </div>
</template>

<style scoped>
.account-view { max-width: 42rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
.av-title { font-size: 1.4rem; font-weight: 700; margin: 0 0 1.25rem; }
.av-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1rem 1.1rem; margin-bottom: 1rem; }
.av-profile { display: flex; align-items: center; gap: 0.9rem; }
.av-name { font-weight: 600; font-size: 1rem; }
.av-email { color: var(--muted); font-size: 0.85rem; }
.av-h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 0 0 0.75rem; }
.av-row { display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0; font-size: 0.9rem; }
.av-btn, .av-select { border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 7px; padding: 0.35rem 0.7rem; font-size: 0.85rem; cursor: pointer; }
.av-linkrow { display: block; width: 100%; text-align: left; padding: 0.55rem 0.2rem; font-size: 0.9rem; color: var(--text); text-decoration: none; background: transparent; border: 0; border-top: 1px solid var(--border); cursor: pointer; }
.av-linkrow:first-of-type { border-top: 0; }
.av-linkrow:hover { color: var(--accent); }
.av-danger { color: #dc2626; }
.av-link { color: var(--accent); }
</style>
