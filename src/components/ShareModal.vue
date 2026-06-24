<script setup>
import { ref, watch } from 'vue'
import { getAccess, grantAccess, revokeAccess, updateReport, reportEffectiveAccess } from '../api/community.js'

const props = defineProps({
  reportId: { type: String, required: true },
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const collaborators = ref([])
const effectiveAccess = ref([])
const loading = ref(false)
const error = ref(null)

const newEmail = ref('')
const newEmailLevel = ref('viewer')
const newGroup = ref('')
const newGroupLevel = ref('viewer')
const visibility = ref('private')

const levelOptions = ['viewer', 'commenter', 'editor']
const visibilityOptions = ['private', 'group', 'public_auth', 'public_open']

watch(() => props.visible, async (v) => {
  if (v) await fetchAccess()
})

async function fetchAccess() {
  loading.value = true
  error.value = null
  try {
    const data = await getAccess(props.reportId)
    collaborators.value = data.access || data || []
    if (data.visibility) visibility.value = data.visibility
    try { effectiveAccess.value = (await reportEffectiveAccess(props.reportId)) || [] } catch { /* non-fatal */ }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function sourceLabel(src) {
  if (src === 'owner') return 'Owner'
  if (src === 'direct') return 'Shared directly'
  if (src && src.startsWith('inherited:')) return `Investigation ${src.split(':')[1]}`
  return src
}

async function addPerson() {
  if (!newEmail.value.trim()) return
  error.value = null
  try {
    await grantAccess(props.reportId, { email: newEmail.value.trim(), level: newEmailLevel.value })
    newEmail.value = ''
    newEmailLevel.value = 'viewer'
    await fetchAccess()
  } catch (err) {
    error.value = err.message
  }
}

async function addGroup() {
  if (!newGroup.value.trim()) return
  error.value = null
  try {
    await grantAccess(props.reportId, { group: newGroup.value.trim(), level: newGroupLevel.value })
    newGroup.value = ''
    newGroupLevel.value = 'viewer'
    await fetchAccess()
  } catch (err) {
    error.value = err.message
  }
}

async function removeCollaborator(accessId) {
  error.value = null
  try {
    await revokeAccess(props.reportId, accessId)
    await fetchAccess()
  } catch (err) {
    error.value = err.message
  }
}

async function changeVisibility() {
  error.value = null
  try {
    await updateReport(props.reportId, { visibility: visibility.value })
  } catch (err) {
    error.value = err.message
  }
}

function close() {
  emit('close')
}

function onBackdrop(e) {
  if (e.target === e.currentTarget) close()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="share-backdrop" data-testid="share-modal-backdrop" @click="onBackdrop">
      <div class="share-modal" data-testid="share-modal">
        <div class="share-header">
          <h2>{{ $t('share.share_story') }}</h2>
          <button class="share-close" data-testid="share-close" @click="close">&times;</button>
        </div>

        <p v-if="error" class="share-error" data-testid="share-error">{{ error }}</p>

        <div v-if="effectiveAccess.length" class="share-section" data-testid="report-effective-access">
          <label class="share-label">{{ $t('share.who_has_access') }}</label>
          <div
            v-for="a in effectiveAccess"
            :key="a.user_id || a.group_id"
            class="share-eff-row"
            :data-testid="'report-access-' + (a.user_id || a.group_id)"
          >
            <span class="share-eff-id">{{ a.email || a.name || a.user_id || a.group_id }}</span>
            <span class="share-eff-level">{{ a.level }}</span>
            <span class="share-eff-source">{{ sourceLabel(a.source) }}</span>
          </div>
        </div>
        <p v-if="loading" class="share-loading">{{ $t('app.loading_2') }}</p>

        <!-- Visibility -->
        <div class="share-section">
          <label class="share-label">{{ $t('share.visibility') }}</label>
          <select
            v-model="visibility"
            class="share-select"
            data-testid="share-visibility"
            @change="changeVisibility"
          >
            <option v-for="v in visibilityOptions" :key="v" :value="v">{{ v }}</option>
          </select>
        </div>

        <!-- Add person -->
        <div class="share-section">
          <label class="share-label">{{ $t('share.add_person') }}</label>
          <div class="share-add-row">
            <input
              v-model="newEmail"
              type="email"
              :placeholder="$t('share.email_address')"
              class="share-input"
              data-testid="share-email-input"
            />
            <select v-model="newEmailLevel" class="share-select" data-testid="share-email-level">
              <option v-for="l in levelOptions" :key="l" :value="l">{{ l }}</option>
            </select>
            <button class="share-btn" data-testid="share-add-person" @click="addPerson">{{ $t('share.add') }}</button>
          </div>
        </div>

        <!-- Add group -->
        <div class="share-section">
          <label class="share-label">{{ $t('share.add_group') }}</label>
          <div class="share-add-row">
            <input
              v-model="newGroup"
              type="text"
              :placeholder="$t('share.group_name')"
              class="share-input"
              data-testid="share-group-input"
            />
            <select v-model="newGroupLevel" class="share-select" data-testid="share-group-level">
              <option v-for="l in levelOptions" :key="l" :value="l">{{ l }}</option>
            </select>
            <button class="share-btn" data-testid="share-add-group" @click="addGroup">{{ $t('share.add') }}</button>
          </div>
        </div>

        <!-- Collaborators list -->
        <div class="share-section">
          <label class="share-label">{{ $t('share.collaborators') }}</label>
          <div v-if="!collaborators.length && !loading" class="share-empty">{{ $t('share.no_collaborators_yet') }}</div>
          <div
            v-for="c in collaborators"
            :key="c.id"
            class="share-collab-row"
            data-testid="share-collaborator"
          >
            <span class="share-collab-name">{{ c.name || c.email || c.group || 'Unknown' }}</span>
            <span class="share-level-badge">{{ c.level }}</span>
            <button
              class="share-remove-btn"
              data-testid="share-remove"
              @click="removeCollaborator(c.id)"
            >{{ $t('app.remove') }}</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.share-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.share-modal {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  width: 100%;
  max-width: 520px;
  max-height: 80vh;
  overflow-y: auto;
  color: var(--text);
}
.share-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.share-header h2 {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0;
}
.share-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--muted);
  line-height: 1;
}
.share-error {
  color: #dc2626;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}
.share-loading {
  color: var(--muted);
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}
.share-section {
  margin-bottom: 1rem;
}
.share-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 0.35rem;
}
.share-add-row {
  display: flex;
  gap: 0.5rem;
}
.share-input {
  flex: 1;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
}
.share-select {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
}
.share-btn {
  padding: 0.4rem 0.75rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
}
.share-btn:hover {
  opacity: 0.9;
}
.share-empty {
  font-size: 0.85rem;
  color: var(--muted);
}
.share-collab-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--border);
}
.share-collab-name {
  flex: 1;
  font-size: 0.9rem;
}
.share-level-badge {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  background: var(--surface);
  color: var(--accent);
  font-weight: 600;
}
.share-remove-btn {
  background: none;
  border: none;
  color: #dc2626;
  font-size: 0.8rem;
  cursor: pointer;
}
.share-remove-btn:hover {
  text-decoration: underline;
}
.share-eff-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.2rem 0; font-size: 0.82rem; }
.share-eff-id { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.share-eff-level { font-weight: 600; }
.share-eff-source { color: var(--muted); font-size: 0.72rem; }
</style>
