<script setup>
/**
 * Top-right profile surface (bezel). Signed-out: a single Log in / Sign up
 * link. Signed-in: an avatar button opening a lean menu — account settings,
 * AI usage, activity, sign out, and the GDPR actions. Display preferences
 * (theme/lang/palette) live on the /account screen, not here.
 *
 * Moderators and admins also get a row into the admin area. The footer has
 * carried that link for a while, but nobody looks in the footer for a tool
 * they use daily — and it was reading a localStorage key the session stopped
 * writing at the rename, so in practice it showed to nobody. Both surfaces
 * now share one predicate (utils/privilege.js) and one source of truth (the
 * session store), so they cannot disagree again.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { isAuthed, currentUser, logout, signOutEverywhere } from '../api/session.js'
import { isPrivileged } from '../utils/privilege.js'
import { deleteAssistConversations, deleteCurrentUser } from '../api/community.js'
import UserAvatar from './UserAvatar.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const rootRef = ref(null)
const open = ref(false)
const busy = ref('')

const authed = computed(() => typeof localStorage !== 'undefined' && isAuthed.value)
const user = computed(() => currentUser.value)
const privileged = computed(() => isPrivileged(user.value))

function toggle() { open.value = !open.value }
function close() { open.value = false }
function go(path) { close(); router.push(path) }
function goProfile() { if (user.value?.id) go(`/users/${user.value.id}`) }

async function onSignOut() { close(); await logout() }
async function onSignOutAll() {
  if (!confirm(t('profile.confirm_sign_out_all'))) return
  busy.value = 'all'; try { await signOutEverywhere() } finally { busy.value = ''; close() }
}
async function onDeleteAi() {
  if (!confirm(t('profile.confirm_delete_ai'))) return
  busy.value = 'ai'; try { await deleteAssistConversations() } finally { busy.value = '' }
}
async function onDeleteAccount() {
  if (!confirm(t('profile.confirm_delete_account'))) return
  busy.value = 'del'; try { await deleteCurrentUser(); await logout() } finally { busy.value = ''; close() }
}

function onDocClick(e) { if (rootRef.value && !rootRef.value.contains(e.target)) close() }
function onKey(e) { if (e.key === 'Escape') close() }
onMounted(() => { document.addEventListener('click', onDocClick); document.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { document.removeEventListener('click', onDocClick); document.removeEventListener('keydown', onKey) })
</script>

<template>
  <div ref="rootRef" class="profile">
    <router-link v-if="!authed" to="/login" class="profile-login" data-testid="header-login">
      {{ $t('profile.log_in') }}
    </router-link>

    <template v-else>
      <button
        type="button" class="profile-trigger" data-testid="profile-trigger"
        :aria-expanded="open" aria-haspopup="menu" :aria-label="$t('profile.menu')"
        @click.stop="toggle"
      >
        <UserAvatar :user="user" :size="28" />
      </button>

      <div v-if="open" class="profile-menu" role="menu" data-testid="profile-menu">
        <button
          v-if="user"
          type="button"
          class="pm-head"
          role="menuitem"
          data-testid="profile-header"
          @click="goProfile"
        >
          <div v-if="user.name" class="pm-name">{{ user.name }}</div>
          <div v-if="user.email" class="pm-email">{{ user.email }}</div>
        </button>
        <button class="pm-row" role="menuitem" data-testid="profile-my-profile" @click="goProfile">{{ $t('profile.my_profile') }}</button>
        <button class="pm-row" role="menuitem" data-testid="profile-account" @click="go('/account')">{{ $t('profile.account_settings') }}</button>
        <button class="pm-row" role="menuitem" data-testid="profile-ai-usage" @click="go('/ai-usage')">{{ $t('profile.ai_usage') }}</button>
        <button class="pm-row" role="menuitem" @click="go('/activity')">{{ $t('profile.activity') }}</button>
        <template v-if="privileged">
          <div class="pm-sep" />
          <button
            class="pm-row" role="menuitem" data-testid="profile-admin"
            @click="go('/admin')"
          >{{ $t('app.admin') }}</button>
        </template>
        <div class="pm-sep" />
        <button class="pm-row" role="menuitem" data-testid="profile-logout" @click="onSignOut">{{ $t('profile.sign_out') }}</button>
        <button class="pm-row" role="menuitem" :disabled="busy==='all'" @click="onSignOutAll">{{ $t('profile.sign_out_all') }}</button>
        <div class="pm-sep" />
        <button class="pm-row" role="menuitem" :disabled="busy==='ai'" @click="onDeleteAi">{{ $t('profile.delete_ai_data') }}</button>
        <button class="pm-row pm-danger" role="menuitem" :disabled="busy==='del'" @click="onDeleteAccount">{{ $t('profile.delete_account') }}</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.profile { position: relative; display: flex; align-items: center; }
.profile-login {
  padding: 0.35rem 0.85rem; border: 1px solid var(--border); border-radius: 7px;
  font-size: 0.82rem; font-weight: 600; color: var(--text); text-decoration: none; white-space: nowrap;
}
.profile-login:hover { border-color: var(--accent); color: var(--accent); }
.profile-trigger { border: 0; background: transparent; padding: 0; cursor: pointer; border-radius: 999px; display: inline-flex; }
.profile-menu {
  position: absolute; right: 0; top: calc(100% + 6px); min-width: 15rem;
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.18); padding: 0.4rem; z-index: 80;
}
.pm-head { display: block; width: 100%; text-align: left; padding: 0.5rem 0.6rem 0.6rem;
  border: 0; border-bottom: 1px solid var(--border); margin-bottom: 0.3rem;
  background: transparent; cursor: pointer; border-radius: 7px 7px 0 0; }
.pm-head:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.pm-name { font-weight: 600; font-size: 0.9rem; }
.pm-email { color: var(--muted); font-size: 0.78rem; }
.pm-row { display: block; width: 100%; text-align: left; padding: 0.5rem 0.6rem; border: 0; background: transparent; color: var(--text); font-size: 0.86rem; border-radius: 7px; cursor: pointer; }
.pm-row:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.pm-row:disabled { opacity: 0.5; cursor: default; }
.pm-danger { color: #dc2626; }
.pm-sep { height: 1px; background: var(--border); margin: 0.3rem 0; }
</style>
