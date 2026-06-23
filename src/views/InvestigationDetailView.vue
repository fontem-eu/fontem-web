<script setup>
/**
 * Investigation detail — name/description + member management. An administer
 * or owner member can invite (by email), toggle capability flags, promote to
 * owner, and remove members. The owner invariants (can't touch another owner,
 * >=1 owner, only an owner grants owner) are enforced server-side; a 409 is
 * surfaced inline.
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  getInvestigation,
  listInvestigationMembers, addInvestigationMember,
  updateInvestigationMember, removeInvestigationMember,
} from '../api/community.js'
import { roleLabel } from '../utils/investigationRole.js'

const route = useRoute()
const id = route.params.id

const inv = ref(null)
const members = ref([])
const loading = ref(true)
const error = ref(null)

const myMembership = computed(() => inv.value?.membership || null)
const canManage = computed(
  () => !!myMembership.value && (myMembership.value.is_owner || myMembership.value.can_administer),
)

const inviteEmail = ref('')
const inviteCaps = ref({ can_write_stories: false, can_add_viz: false, can_administer: false, is_owner: false })

async function load() {
  loading.value = true
  error.value = null
  try {
    inv.value = await getInvestigation(id)
    members.value = (await listInvestigationMembers(id)) || []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

function capsOf(m) {
  return {
    can_write_stories: m.can_write_stories,
    can_add_viz: m.can_add_viz,
    can_administer: m.can_administer,
    is_owner: m.is_owner,
  }
}

async function invite() {
  if (!inviteEmail.value.trim()) return
  error.value = null
  try {
    await addInvestigationMember(id, { email: inviteEmail.value.trim(), ...inviteCaps.value })
    inviteEmail.value = ''
    inviteCaps.value = { can_write_stories: false, can_add_viz: false, can_administer: false, is_owner: false }
    members.value = (await listInvestigationMembers(id)) || []
  } catch (e) {
    error.value = e.message
  }
}

async function toggleCap(m, cap) {
  error.value = null
  const caps = capsOf(m)
  caps[cap] = !caps[cap]
  try {
    await updateInvestigationMember(id, m.user_id, caps)
    members.value = (await listInvestigationMembers(id)) || []
  } catch (e) {
    error.value = e.message
    members.value = (await listInvestigationMembers(id)) || []  // re-sync after a rejected change
  }
}

async function remove(m) {
  error.value = null
  try {
    await removeInvestigationMember(id, m.user_id)
    members.value = (await listInvestigationMembers(id)) || []
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <div class="invd" data-testid="investigation-detail">
    <router-link to="/investigations" class="invd-back">{{ $t('investigations.back') }}</router-link>
    <p v-if="error" class="invd-error" data-testid="investigation-detail-error">{{ error }}</p>
    <p v-if="loading" class="invd-msg">{{ $t('app.loading') }}</p>

    <template v-else-if="inv">
      <header class="invd-header">
        <h1 data-testid="investigation-title">{{ inv.name }}</h1>
        <span class="invd-role">{{ roleLabel(myMembership) }}</span>
      </header>
      <p class="invd-desc">{{ inv.description }}</p>

      <section class="invd-section">
        <h2>{{ $t('investigations.members') }}</h2>
        <ul class="invd-members" data-testid="investigation-members">
          <li v-for="m in members" :key="m.user_id" class="invd-member" :data-testid="'member-' + m.user_id">
            <span class="invd-member-id">{{ m.email || m.name || m.user_id }}</span>
            <span class="invd-member-role">{{ roleLabel(m) }}</span>
            <template v-if="canManage">
              <label v-for="cap in ['can_write_stories','can_add_viz','can_administer','is_owner']" :key="cap" class="invd-cap">
                <input type="checkbox" :checked="m[cap]" :data-testid="'cap-' + cap + '-' + m.user_id" @change="toggleCap(m, cap)" />
                <span>{{ $t('investigations.cap_' + cap) }}</span>
              </label>
              <button class="invd-remove" :data-testid="'remove-' + m.user_id" @click="remove(m)">×</button>
            </template>
          </li>
        </ul>

        <div v-if="canManage" class="invd-invite" data-testid="investigation-invite">
          <input
            v-model="inviteEmail"
            type="email"
            class="invd-input"
            :placeholder="$t('investigations.invite_email')"
            data-testid="invite-email-input"
            @keydown.enter="invite"
          />
          <label class="invd-cap"><input v-model="inviteCaps.can_write_stories" type="checkbox" data-testid="invite-write" /> {{ $t('investigations.cap_can_write_stories') }}</label>
          <label class="invd-cap"><input v-model="inviteCaps.can_add_viz" type="checkbox" data-testid="invite-viz" /> {{ $t('investigations.cap_can_add_viz') }}</label>
          <label class="invd-cap"><input v-model="inviteCaps.can_administer" type="checkbox" data-testid="invite-admin" /> {{ $t('investigations.cap_can_administer') }}</label>
          <label class="invd-cap"><input v-model="inviteCaps.is_owner" type="checkbox" data-testid="invite-owner" /> {{ $t('investigations.cap_is_owner') }}</label>
          <button class="inv-primary" data-testid="invite-add-btn" @click="invite">{{ $t('investigations.invite') }}</button>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.invd { max-width: 56rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
.invd-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.invd-header { display: flex; align-items: center; gap: 1rem; margin: 0.5rem 0 0.25rem; }
.invd-header h1 { font-size: 1.3rem; font-weight: 700; }
.invd-role { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; color: var(--accent); border: 1px solid var(--border); border-radius: 999px; padding: 0.15rem 0.6rem; }
.invd-desc { color: var(--muted); margin-bottom: 1.5rem; }
.invd-error { color: #dc2626; padding: 0.5rem 0; }
.invd-msg { color: var(--muted); padding: 1rem 0; }
.invd-section h2 { font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem; }
.invd-members { list-style: none; padding: 0; margin: 0 0 1rem; display: flex; flex-direction: column; gap: 0.4rem; }
.invd-member { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: 6px; }
.invd-member-id { font-weight: 600; color: var(--text); }
.invd-member-role { font-size: 0.7rem; color: var(--accent); }
.invd-cap { font-size: 0.72rem; color: var(--muted); display: inline-flex; align-items: center; gap: 0.25rem; }
.invd-remove { margin-left: auto; border: none; background: none; color: #dc2626; font-size: 1.1rem; cursor: pointer; }
.invd-invite { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; padding-top: 0.5rem; border-top: 1px solid var(--border); }
.invd-input { padding: 0.45rem 0.6rem; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text); font-size: 0.85rem; }
.inv-primary { background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.82rem; }
</style>
