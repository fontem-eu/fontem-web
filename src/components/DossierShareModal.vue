<script setup>
/**
 * Share a dossier — the additive-override UI. Shows "who has access & why"
 * (owner / inherited:<role> / direct) and lets an owner/admin add or remove
 * direct grants. The server enforces who may share; a 403 surfaces inline.
 */
import { ref, onMounted } from 'vue'
import {
  dossierEffectiveAccess, shareDossier, revokeDossierAccess,
} from '../api/community.js'

const props = defineProps({ dossierId: { type: String, required: true } })
const emit = defineEmits(['close'])

const access = ref([])
const inviteEmail = ref('')
const inviteLevel = ref('viewer')
const error = ref(null)
const loading = ref(true)

async function load() {
  loading.value = true
  error.value = null
  try {
    access.value = (await dossierEffectiveAccess(props.dossierId)) || []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function add() {
  if (!inviteEmail.value.trim()) return
  error.value = null
  try {
    await shareDossier(props.dossierId, { email: inviteEmail.value.trim(), level: inviteLevel.value })
    inviteEmail.value = ''
    inviteLevel.value = 'viewer'
    await load()
  } catch (e) {
    error.value = e.message
  }
}
async function remove(uid) {
  error.value = null
  try {
    await revokeDossierAccess(props.dossierId, uid)
    await load()
  } catch (e) {
    error.value = e.message
  }
}

function sourceLabel(src) {
  if (src === 'owner') return 'Owner'
  if (src === 'direct') return 'Shared directly'
  if (src && src.startsWith('inherited:')) return `Investigation ${src.split(':')[1]}`
  return src
}
</script>

<template>
  <div class="dsm-overlay" data-testid="dossier-share-modal" @click.self="emit('close')">
    <div class="dsm-card">
      <h3>{{ $t('investigations.share_dossier') }}</h3>
      <p v-if="error" class="dsm-error" data-testid="dossier-share-error">{{ error }}</p>

      <h4 class="dsm-sub">{{ $t('investigations.who_has_access') }}</h4>
      <p v-if="loading" class="dsm-muted">{{ $t('app.loading') }}</p>
      <ul v-else class="dsm-list" data-testid="dossier-access-list">
        <li v-for="a in access" :key="a.user_id" class="dsm-row" :data-testid="'share-access-' + a.user_id">
          <span class="dsm-id">{{ a.email || a.name || a.user_id }}</span>
          <span class="dsm-level">{{ a.level }}</span>
          <span class="dsm-source">{{ sourceLabel(a.source) }}</span>
          <button
            v-if="a.source === 'direct'"
            class="dsm-remove"
            :data-testid="'share-remove-' + a.user_id"
            @click="remove(a.user_id)"
          >&times;</button>
        </li>
      </ul>

      <h4 class="dsm-sub">{{ $t('investigations.add_people') }}</h4>
      <div class="dsm-add">
        <input
          v-model="inviteEmail"
          type="email"
          class="dsm-input"
          :placeholder="$t('investigations.invite_email')"
          data-testid="share-email-input"
          @keydown.enter="add"
        />
        <select v-model="inviteLevel" class="dsm-select" data-testid="share-level">
          <option value="viewer">{{ $t('investigations.level_viewer') }}</option>
          <option value="editor">{{ $t('investigations.level_editor') }}</option>
          <option value="owner">{{ $t('investigations.level_owner') }}</option>
        </select>
        <button class="dsm-add-btn" data-testid="share-add-btn" @click="add">{{ $t('investigations.invite') }}</button>
      </div>

      <div class="dsm-actions"><button @click="emit('close')">{{ $t('app.cancel') }}</button></div>
    </div>
  </div>
</template>

<style scoped>
.dsm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dsm-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; width: 92%; max-width: 460px; }
.dsm-card h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; }
.dsm-sub { font-size: 0.8rem; font-weight: 700; color: var(--muted); margin: 0.75rem 0 0.4rem; }
.dsm-error { color: #dc2626; font-size: 0.85rem; }
.dsm-muted { color: var(--muted); font-size: 0.85rem; }
.dsm-list { list-style: none; padding: 0; margin: 0; }
.dsm-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.3rem 0; font-size: 0.85rem; }
.dsm-id { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsm-level { font-weight: 600; }
.dsm-source { color: var(--muted); font-size: 0.75rem; }
.dsm-remove { border: none; background: none; color: var(--muted); cursor: pointer; font-size: 1rem; }
.dsm-remove:hover { color: #dc2626; }
.dsm-add { display: flex; gap: 0.4rem; align-items: center; }
.dsm-input { flex: 1; padding: 0.4rem 0.5rem; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text); font-size: 0.82rem; }
.dsm-select { padding: 0.4rem; border: 1px solid var(--border); border-radius: 4px; background: var(--surface); color: var(--text); font-size: 0.82rem; }
.dsm-add-btn { background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.82rem; }
.dsm-actions { display: flex; justify-content: flex-end; margin-top: 0.75rem; }
</style>
