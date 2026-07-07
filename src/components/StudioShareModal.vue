<script setup>
/**
 * Data Studio share dialog. Two ways to share a project:
 *  1. Attach it to an investigation — every member inherits access by their
 *     role (viewer→view, contributor→edit, admin/owner→own).
 *  2. Grant a specific person direct access (viewer / commenter / editor).
 * Both routes are enforced server-side; this dialog only opens when the caller
 * can share (project.my_access.can_share).
 */
import { ref, computed, onMounted } from 'vue'
import { useStudio } from '../composables/useStudio.js'
import {
  listProjectAccess, shareProject, revokeProjectAccess, projectEffectiveAccess,
} from '../api/studio.js'
import { listInvestigations } from '../api/community.js'
import { canContribute } from '../utils/investigationRole.js'

const props = defineProps({ project: { type: Object, required: true } })
const emit = defineEmits(['close'])
const studio = useStudio()

const grants = ref([])
const effective = ref([])
const investigations = ref([])
const error = ref(null)
const loading = ref(false)

const newEmail = ref('')
const newLevel = ref('viewer')
const attachTarget = ref('')
const levelOptions = ['viewer', 'commenter', 'editor']

const attachedTo = computed(() =>
  investigations.value.find((i) => i.id === props.project.investigation_id) || null)
// Only investigations the caller can add to (contributor+) are valid targets.
const attachOptions = computed(() =>
  investigations.value.filter((i) => canContribute(i.membership)))

onMounted(refresh)

async function refresh() {
  loading.value = true
  error.value = null
  try {
    investigations.value = (await listInvestigations()) || []
    grants.value = (await listProjectAccess(props.project.id)) || []
    try { effective.value = (await projectEffectiveAccess(props.project.id)) || [] } catch { /* non-fatal */ }
  } catch (e) { error.value = e.message } finally { loading.value = false }
}

function sourceLabel(src) {
  if (src === 'owner') return 'Owner'
  if (src === 'direct') return 'Shared directly'
  if (src && src.startsWith('inherited:')) return `Investigation ${src.split(':')[1]}`
  return src
}

async function attach() {
  if (!attachTarget.value) return
  error.value = null
  try { await studio.attachProject(props.project.id, attachTarget.value); attachTarget.value = ''; await refresh() }
  catch (e) { error.value = e.message }
}

async function detach() {
  error.value = null
  try { await studio.detachProject(props.project.id); await refresh() }
  catch (e) { error.value = e.message }
}

async function addPerson() {
  if (!newEmail.value.trim()) return
  error.value = null
  try {
    await shareProject(props.project.id, { email: newEmail.value.trim(), level: newLevel.value })
    newEmail.value = ''; newLevel.value = 'viewer'; await refresh()
  } catch (e) { error.value = e.message }
}

async function removeGrant(uid) {
  error.value = null
  try { await revokeProjectAccess(props.project.id, uid); await refresh() }
  catch (e) { error.value = e.message }
}

function onBackdrop(e) { if (e.target === e.currentTarget) emit('close') }
</script>

<template>
  <Teleport to="body">
    <div class="sh-backdrop" data-testid="studio-share-backdrop" @click="onBackdrop">
      <div class="sh-modal" data-testid="studio-share-modal">
        <div class="sh-head">
          <h2>{{ $t('studio_share_modal.share') }} “{{ project.name }}”</h2>
          <button class="sh-close" data-testid="studio-share-close" @click="emit('close')">&times;</button>
        </div>
        <p v-if="error" class="sh-error" data-testid="studio-share-error">{{ error }}</p>

        <!-- Investigation -->
        <div class="sh-section">
          <div class="sh-label">{{ $t('studio_share_modal.investigation') }}</div>
          <div v-if="attachedTo || project.investigation_id" class="sh-attached" data-testid="studio-attached">
            <span>{{ $t('studio_share_modal.shared_with') }} <strong>{{ attachedTo ? attachedTo.name : $t('studio_share_modal.an_investigation') }}</strong> {{ $t('studio_share_modal.its_members_inherit_access_by_role') }}</span>
            <button class="sh-remove" data-testid="studio-detach" @click="detach">{{ $t('studio_share_modal.detach') }}</button>
          </div>
          <div v-else class="sh-add-row">
            <select v-model="attachTarget" class="sh-select" data-testid="studio-attach-select" :aria-label="$t('studio_share_modal.add_to_an_investigation')">
              <option value="">{{ $t('studio_share_modal.add_to_an_investigation_2') }}</option>
              <option v-for="i in attachOptions" :key="i.id" :value="i.id">{{ i.name }}</option>
            </select>
            <button class="sh-btn" data-testid="studio-attach" :disabled="!attachTarget" @click="attach">{{ $t('studio_share_modal.attach') }}</button>
          </div>
          <p v-if="!attachedTo && !project.investigation_id && !attachOptions.length" class="sh-hint">{{ $t('studio_share_modal.you_need_a_contributor_seat_on_an_investigation') }}</p>
        </div>

        <!-- Who has access -->
        <div v-if="effective.length" class="sh-section" data-testid="studio-effective-access">
          <div class="sh-label">{{ $t('studio_share_modal.who_has_access') }}</div>
          <div v-for="a in effective" :key="a.user_id" class="sh-eff-row" :data-testid="'studio-access-' + a.user_id">
            <span class="sh-eff-id">{{ a.email || a.name || a.user_id }}</span>
            <span class="sh-eff-level">{{ a.level }}</span>
            <span class="sh-eff-src">{{ sourceLabel(a.source) }}</span>
          </div>
        </div>

        <!-- Add person -->
        <div class="sh-section">
          <div class="sh-label">{{ $t('studio_share_modal.add_a_person') }}</div>
          <div class="sh-add-row">
            <input v-model="newEmail" type="email" :placeholder="$t('studio_share_modal.email_address')" :aria-label="$t('studio_share_modal.email_address_to_share_with')" class="sh-input" data-testid="studio-share-email" />
            <select v-model="newLevel" class="sh-select" data-testid="studio-share-level" :aria-label="$t('studio_share_modal.access_level')">
              <option v-for="l in levelOptions" :key="l" :value="l">{{ l }}</option>
            </select>
            <button class="sh-btn" data-testid="studio-share-add" @click="addPerson">{{ $t('studio_share_modal.add') }}</button>
          </div>
        </div>

        <!-- Direct grants -->
        <div class="sh-section">
          <div class="sh-label">{{ $t('studio_share_modal.people_with_direct_access') }}</div>
          <p v-if="!grants.length && !loading" class="sh-hint">{{ $t('studio_share_modal.no_direct_shares_yet') }}</p>
          <div v-for="g in grants" :key="g.user_id" class="sh-grant-row" data-testid="studio-grant">
            <span class="sh-grant-name">{{ g.name || g.email || g.user_id }}</span>
            <span class="sh-level-badge">{{ g.level }}</span>
            <button class="sh-remove" data-testid="studio-grant-remove" @click="removeGrant(g.user_id)">{{ $t('studio_share_modal.remove') }}</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sh-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.sh-modal { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; width: 100%; max-width: 520px; max-height: 82vh; overflow-y: auto; color: var(--text); }
.sh-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.sh-head h2 { font-size: 1.1rem; font-weight: 700; margin: 0; }
.sh-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--muted); line-height: 1; }
.sh-error { color: #dc2626; font-size: 0.85rem; margin-bottom: 0.75rem; }
.sh-section { margin-bottom: 1.1rem; }
.sh-label { display: block; font-size: 0.8rem; font-weight: 600; color: var(--muted); margin-bottom: 0.35rem; }
.sh-add-row { display: flex; gap: 0.5rem; }
.sh-input { flex: 1; padding: 0.4rem 0.6rem; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 0.85rem; }
.sh-select { padding: 0.4rem 0.5rem; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 0.85rem; }
.sh-btn { padding: 0.4rem 0.75rem; background: var(--accent); color: #fff; border: none; border-radius: 6px; font-size: 0.85rem; cursor: pointer; }
.sh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sh-attached { display: flex; align-items: center; gap: 0.6rem; font-size: 0.85rem; }
.sh-attached span { flex: 1; }
.sh-hint { font-size: 0.8rem; color: var(--muted); margin: 0.3rem 0 0; }
.sh-eff-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.2rem 0; font-size: 0.82rem; }
.sh-eff-id { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sh-eff-level { font-weight: 600; }
.sh-eff-src { color: var(--muted); font-size: 0.72rem; }
.sh-grant-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0; border-bottom: 1px solid var(--border); }
.sh-grant-name { flex: 1; font-size: 0.9rem; }
.sh-level-badge { font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 9999px; background: var(--surface); color: var(--accent); font-weight: 600; }
.sh-remove { background: none; border: none; color: #dc2626; font-size: 0.8rem; cursor: pointer; }
.sh-remove:hover { text-decoration: underline; }
</style>
