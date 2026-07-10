<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { currentUser } from '../api/session.js'
import { getUserProfile, updateMyProfile, uploadAvatar } from '../api/community.js'
import UserAvatar from '../components/UserAvatar.vue'

const route = useRoute()
const profile = ref(null)
const loading = ref(true)
const error = ref(null)

const userId = computed(() => route.params.id)
const isSelf = computed(() =>
  !!profile.value && currentUser.value?.id === profile.value.id)

// Routes for the four activity entity types; a deleted entity has no target.
const ENTITY_ROUTE = {
  story: (id) => `/stories/${id}`,
  issue: (id) => `/issues/${id}`,
  investigation: (id) => `/investigations/${id}`,
  dossier: (id) => `/dossiers/${id}`,
}
function activityLink(e) {
  if (e.action === 'deleted') return null
  const make = ENTITY_ROUTE[e.entity_type]
  return make ? make(e.entity_id) : null
}

function formatDate(v) {
  if (!v) return ''
  try {
    return new Date(v).toLocaleDateString(undefined,
      { year: 'numeric', month: 'long', day: 'numeric' })
  } catch { return '' }
}

async function load() {
  loading.value = true
  error.value = null
  try {
    profile.value = await getUserProfile(userId.value)
  } catch (err) {
    error.value = err?.status === 404 ? 'not_found' : (err?.message || 'error')
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(userId, load)

// ── own-profile editing ─────────────────────────────────────
const editing = ref(false)
const draftSummary = ref('')
const draftLinks = ref([])
const saving = ref(false)

function openEdit() {
  draftSummary.value = profile.value.summary || ''
  draftLinks.value = (profile.value.links || []).map((l) => ({ ...l }))
  editing.value = true
}
function addLink() { draftLinks.value.push({ name: '', url: '' }) }
function removeLink(i) { draftLinks.value.splice(i, 1) }

async function saveEdit() {
  saving.value = true
  try {
    const links = draftLinks.value
      .map((l) => ({ name: (l.name || '').trim(), url: (l.url || '').trim() }))
      .filter((l) => l.name && l.url)
    const saved = await updateMyProfile({ summary: draftSummary.value.trim(), links })
    profile.value = { ...profile.value, summary: saved.summary, links: saved.links }
    editing.value = false
  } catch (err) {
    error.value = err?.message || 'error'
  } finally {
    saving.value = false
  }
}

// ── avatar: upload + reposition (own profile only) ──────────
const fileInput = ref(null)
const uploading = ref(false)
const repositioning = ref(false)
let dragOrigin = null
let posBackup = null
const clamp = (n) => Math.min(100, Math.max(0, n))

const avatarPosition = computed(
  () => `${profile.value?.avatar_x ?? 50}% ${profile.value?.avatar_y ?? 50}%`)

function pickPhoto() {
  if (!isSelf.value || repositioning.value) return
  fileInput.value?.click()
}
async function onFileChange(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file || !file.type.startsWith('image/')) return
  uploading.value = true
  try {
    const res = await uploadAvatar(file)
    profile.value = { ...profile.value, avatar_url: res.avatar_url }
  } catch (err) {
    error.value = err?.message || 'error'
  } finally {
    uploading.value = false
  }
}
function startReposition() {
  posBackup = { x: profile.value.avatar_x ?? 50, y: profile.value.avatar_y ?? 50 }
  repositioning.value = true
}
function cancelReposition() {
  if (posBackup) {
    profile.value = { ...profile.value, avatar_x: posBackup.x, avatar_y: posBackup.y }
  }
  repositioning.value = false
}
function onDragStart(e) {
  if (!repositioning.value) return
  dragOrigin = {
    px: e.clientX, py: e.clientY,
    x: profile.value.avatar_x ?? 50, y: profile.value.avatar_y ?? 50,
  }
  e.target.setPointerCapture?.(e.pointerId)
}
function onDragMove(e) {
  if (!dragOrigin) return
  const size = 96
  const nx = clamp(dragOrigin.x - ((e.clientX - dragOrigin.px) / size) * 100)
  const ny = clamp(dragOrigin.y - ((e.clientY - dragOrigin.py) / size) * 100)
  profile.value = { ...profile.value, avatar_x: nx, avatar_y: ny }
}
function onDragEnd() { dragOrigin = null }
async function saveReposition() {
  saving.value = true
  try {
    await updateMyProfile({
      summary: profile.value.summary,
      links: profile.value.links,
      avatar_x: profile.value.avatar_x,
      avatar_y: profile.value.avatar_y,
    })
    repositioning.value = false
  } catch (err) {
    error.value = err?.message || 'error'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="profile-view" data-testid="user-profile">
    <div v-if="loading" class="profile-loading" data-testid="profile-loading">…</div>
    <div v-else-if="error === 'not_found'" class="profile-error" data-testid="profile-not-found">
      {{ $t('user_profile.not_found') }}
    </div>
    <div v-else-if="error" class="profile-error">{{ error }}</div>

    <div v-else-if="profile" class="profile-layout">
      <!-- Left: identity block -->
      <aside class="profile-aside">
        <div class="profile-avatar-wrap" :class="{ 'is-self': isSelf, repositioning }">
          <div
            class="profile-avatar-inner"
            @click="pickPhoto"
            @pointerdown="onDragStart"
            @pointermove="onDragMove"
            @pointerup="onDragEnd"
            @pointercancel="onDragEnd"
          >
            <UserAvatar :user="profile" :size="96" :position="avatarPosition" class="profile-avatar" />
            <div v-if="isSelf && !repositioning" class="profile-avatar-overlay">
              <span>{{ uploading ? $t('user_profile.uploading') : $t('user_profile.change_photo') }}</span>
            </div>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="profile-avatar-file"
            data-testid="profile-avatar-input"
            @change="onFileChange"
          />
          <div v-if="isSelf && profile.avatar_url" class="profile-avatar-actions">
            <button
              v-if="!repositioning"
              type="button"
              class="profile-reposition-btn"
              data-testid="profile-reposition"
              @click="startReposition"
            >{{ $t('user_profile.reposition') }}</button>
            <template v-else>
              <span class="profile-reposition-hint">{{ $t('user_profile.drag_to_center') }}</span>
              <button type="button" class="btn-primary" :disabled="saving" data-testid="profile-reposition-save" @click="saveReposition">{{ $t('user_profile.save') }}</button>
              <button type="button" class="profile-edit-cancel" @click="cancelReposition">{{ $t('user_profile.cancel') }}</button>
            </template>
          </div>
        </div>
        <h1 class="profile-name" data-testid="profile-name">{{ profile.name }}</h1>
        <p v-if="profile.created_at" class="profile-joined">
          {{ $t('user_profile.joined', { date: formatDate(profile.created_at) }) }}
        </p>

        <template v-if="!editing">
          <p v-if="profile.summary" class="profile-summary" data-testid="profile-summary">
            {{ profile.summary }}
          </p>
          <ul v-if="profile.links && profile.links.length" class="profile-links" data-testid="profile-links">
            <li v-for="(l, i) in profile.links" :key="i">
              <a :href="l.url" target="_blank" rel="noopener noreferrer nofollow">{{ l.name }}</a>
            </li>
          </ul>
          <button
            v-if="isSelf"
            class="profile-edit-btn"
            data-testid="profile-edit-btn"
            @click="openEdit"
          >{{ $t('user_profile.edit') }}</button>
        </template>

        <!-- own-profile edit form -->
        <form v-else class="profile-edit" data-testid="profile-edit-form" @submit.prevent="saveEdit">
          <label class="profile-edit-label">{{ $t('user_profile.about') }}</label>
          <textarea
            v-model="draftSummary"
            class="profile-edit-summary"
            rows="4"
            maxlength="2000"
            :placeholder="$t('user_profile.summary_placeholder')"
            data-testid="profile-edit-summary"
          />
          <label class="profile-edit-label">{{ $t('user_profile.links') }}</label>
          <div v-for="(l, i) in draftLinks" :key="i" class="profile-edit-linkrow">
            <input
              v-model="l.name"
              class="profile-edit-input"
              maxlength="60"
              :placeholder="$t('user_profile.link_name')"
            />
            <input
              v-model="l.url"
              class="profile-edit-input"
              maxlength="500"
              :placeholder="$t('user_profile.link_url')"
            />
            <button type="button" class="profile-edit-remove" @click="removeLink(i)">✕</button>
          </div>
          <button type="button" class="profile-edit-addlink" @click="addLink">
            + {{ $t('user_profile.add_link') }}
          </button>
          <div class="profile-edit-actions">
            <button type="submit" class="btn-primary" :disabled="saving" data-testid="profile-save-btn">
              {{ $t('user_profile.save') }}
            </button>
            <button type="button" class="profile-edit-cancel" @click="editing = false">
              {{ $t('user_profile.cancel') }}
            </button>
          </div>
        </form>
      </aside>

      <!-- Right: articles + activity -->
      <main class="profile-main">
        <section class="profile-section">
          <h2 class="profile-h2">{{ $t('user_profile.articles') }}</h2>
          <ul v-if="profile.articles.length" class="profile-articles" data-testid="profile-articles">
            <li v-for="a in profile.articles" :key="a.id" class="profile-article">
              <RouterLink :to="`/stories/${a.id}`" class="profile-article-title">{{ a.title }}</RouterLink>
              <p v-if="a.abstract" class="profile-article-abstract">{{ a.abstract }}</p>
              <span v-if="a.created_at" class="profile-article-date">{{ formatDate(a.created_at) }}</span>
            </li>
          </ul>
          <p v-else class="profile-empty">{{ $t('user_profile.no_articles') }}</p>
        </section>

        <section class="profile-section">
          <h2 class="profile-h2">{{ $t('user_profile.recent_activity') }}</h2>
          <ul v-if="profile.recent_activity.length" class="profile-activity" data-testid="profile-activity">
            <li v-for="(e, i) in profile.recent_activity" :key="i" class="profile-activity-item">
              <span class="profile-activity-badge">{{ $t('user_profile.ent_' + e.entity_type) }}</span>
              <RouterLink v-if="activityLink(e)" :to="activityLink(e)" class="profile-activity-text">
                {{ $t('user_profile.activity_' + e.action, { entity: e.summary }) }}
              </RouterLink>
              <span v-else class="profile-activity-text">
                {{ $t('user_profile.activity_' + e.action, { entity: e.summary }) }}
              </span>
              <span v-if="e.created_at" class="profile-activity-date">{{ formatDate(e.created_at) }}</span>
            </li>
          </ul>
          <p v-else class="profile-empty">{{ $t('user_profile.no_activity') }}</p>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.profile-view { max-width: 960px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
.profile-loading, .profile-error { padding: 2rem 0; color: var(--muted); }
.profile-layout { display: grid; grid-template-columns: 1fr; gap: 2rem; }
@media (min-width: 768px) { .profile-layout { grid-template-columns: 260px 1fr; } }
.profile-aside { display: flex; flex-direction: column; gap: 0.5rem; }
.profile-avatar { margin-bottom: 0.25rem; }
.profile-name { font-size: 1.4rem; font-weight: 700; margin: 0; }
.profile-joined { font-size: 0.8rem; color: var(--muted); margin: 0; }
.profile-summary { font-size: 0.92rem; line-height: 1.5; margin: 0.5rem 0 0; }
.profile-links { list-style: none; padding: 0; margin: 0.5rem 0 0; display: flex; flex-direction: column; gap: 0.3rem; }
.profile-links a { color: var(--accent); text-decoration: none; font-size: 0.9rem; }
.profile-links a:hover { text-decoration: underline; }
.profile-edit-btn, .profile-edit-cancel, .profile-edit-addlink {
  align-self: flex-start; background: none; border: 1px solid var(--border);
  color: var(--fg); border-radius: 6px; padding: 0.35rem 0.7rem; font-size: 0.82rem; cursor: pointer;
}
.profile-edit { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem; }
.profile-edit-label { font-size: 0.78rem; font-weight: 600; color: var(--muted); text-transform: uppercase; }
.profile-edit-summary, .profile-edit-input {
  width: 100%; background: var(--bg-soft, transparent); border: 1px solid var(--border);
  border-radius: 6px; padding: 0.45rem; color: var(--fg); font: inherit; font-size: 0.88rem;
}
.profile-edit-linkrow { display: flex; gap: 0.35rem; align-items: center; }
.profile-edit-remove { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.9rem; }
.profile-edit-actions { display: flex; gap: 0.5rem; margin-top: 0.35rem; }
.profile-main { display: flex; flex-direction: column; gap: 2rem; min-width: 0; }
.profile-h2 { font-size: 1.05rem; font-weight: 700; margin: 0 0 0.75rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--border); }
.profile-articles, .profile-activity { list-style: none; padding: 0; margin: 0; }
.profile-article { padding: 0.6rem 0; border-bottom: 1px solid var(--border); }
.profile-article-title { font-weight: 600; color: var(--fg); text-decoration: none; }
.profile-article-title:hover { color: var(--accent); }
.profile-article-abstract { font-size: 0.86rem; color: var(--muted); margin: 0.25rem 0 0; }
.profile-article-date { font-size: 0.76rem; color: var(--muted); }
.profile-activity-item { display: flex; align-items: baseline; gap: 0.5rem; padding: 0.4rem 0; flex-wrap: wrap; }
.profile-activity-badge {
  font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.03em;
  background: var(--border); color: var(--muted); border-radius: 4px; padding: 0.1rem 0.4rem;
}
.profile-activity-text { color: var(--fg); text-decoration: none; font-size: 0.9rem; }
a.profile-activity-text:hover { color: var(--accent); }
.profile-activity-date { font-size: 0.76rem; color: var(--muted); margin-left: auto; }
.profile-empty { color: var(--muted); font-size: 0.9rem; }
.profile-avatar-wrap { position: relative; width: 96px; }
.profile-avatar-inner { position: relative; width: 96px; height: 96px; border-radius: 50%; }
.profile-avatar-wrap.is-self .profile-avatar-inner { cursor: pointer; }
.profile-avatar-wrap.repositioning .profile-avatar-inner { cursor: grab; touch-action: none; }
.profile-avatar-overlay {
  position: absolute; inset: 0; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; text-align: center;
  font-size: 0.62rem; color: #fff; background: rgba(0, 0, 0, 0.45);
  opacity: 0; transition: opacity 0.15s; padding: 0 0.3rem; pointer-events: none;
}
.profile-avatar-inner:hover .profile-avatar-overlay { opacity: 1; }
.profile-avatar-file { display: none; }
.profile-avatar-actions { margin-top: 0.4rem; display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap; }
.profile-reposition-btn { background: none; border: 1px solid var(--border); color: var(--fg); border-radius: 6px; padding: 0.25rem 0.55rem; font-size: 0.75rem; cursor: pointer; }
.profile-reposition-hint { font-size: 0.72rem; color: var(--muted); }
</style>
