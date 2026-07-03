<script setup>
/**
 * Investigation detail — name/description + member management. An administer
 * or owner member can invite (by email), toggle capability flags, promote to
 * owner, and remove members. The owner invariants (can't touch another owner,
 * >=1 owner, only an owner grants owner) are enforced server-side; a 409 is
 * surfaced inline.
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getInvestigation,
  listInvestigationMembers, addInvestigationMember,
  updateInvestigationMember, removeInvestigationMember,
  listInvestigationStories, removeInvestigationStory,
  listVisualizations, deleteInvestigation,
} from '../api/community.js'
import { listProjectsForInvestigation, detachProject } from '../api/studio.js'
import PipelineEmbed from '../widgets/PipelineEmbed.vue'
import { roleLabel, roleAtLeast, ROLES } from '../utils/investigationRole.js'

const route = useRoute()
const router = useRouter()
const id = route.params.id

const inv = ref(null)
const members = ref([])
const stories = ref([])
const viz = ref([])
const dataProjects = ref([])
const showDelete = ref(false)
const loading = ref(true)
const error = ref(null)

const myMembership = computed(() => inv.value?.membership || null)
const canManage = computed(
  () => roleAtLeast(myMembership.value, 'admin'),
)
const canWrite = computed(
  () => roleAtLeast(myMembership.value, 'contributor'),
)
const canDelete = computed(
  () => roleAtLeast(myMembership.value, 'owner'),
)

const inviteEmail = ref('')
const inviteRole = ref('viewer')

async function load() {
  loading.value = true
  error.value = null
  try {
    inv.value = await getInvestigation(id)
    members.value = (await listInvestigationMembers(id)) || []
    stories.value = (await listInvestigationStories(id)) || []
    viz.value = (await listVisualizations(id)) || []
    dataProjects.value = (await listProjectsForInvestigation(id)) || []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

// A saved plot's recipe -> the PipelineEmbed config that re-runs it live.
function plotConfig(spec) {
  const sp = spec || {}
  return {
    data_params: { sources: sp.sources || [], transform: sp.transform || '' },
    ui_params: {
      chart: sp.chart || 'bar_h', x: sp.x, y: sp.y, y2: sp.y2, level: sp.level || 0,
      bivariate: sp.bivariate || 'none', series: sp.series || [], corrCols: sp.corrCols || [],
    },
  }
}

async function detachDataProject(pid) {
  error.value = null
  try { await detachProject(pid); dataProjects.value = (await listProjectsForInvestigation(id)) || [] }
  catch (e) { error.value = e.message }
}

async function removeStory(s) {
  error.value = null
  try {
    await removeInvestigationStory(id, s.id)
    stories.value = (await listInvestigationStories(id)) || []
    viz.value = (await listVisualizations(id)) || []
  } catch (e) {
    error.value = e.message
  }
}

async function invite() {
  if (!inviteEmail.value.trim()) return
  error.value = null
  try {
    await addInvestigationMember(id, { email: inviteEmail.value.trim(), role: inviteRole.value })
    inviteEmail.value = ''
    inviteRole.value = 'viewer'
    members.value = (await listInvestigationMembers(id)) || []
  } catch (e) {
    error.value = e.message
  }
}

async function setRole(m, role) {
  error.value = null
  try {
    await updateInvestigationMember(id, m.user_id, { role })
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

async function deleteInv(content) {
  error.value = null
  try {
    await deleteInvestigation(id, content)
    router.push('/investigations')
  } catch (e) {
    error.value = e.message
    showDelete.value = false
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
        <button
          v-if="canDelete"
          class="invd-delete-btn"
          data-testid="investigation-delete-btn"
          @click="showDelete = true"
        >{{ $t('investigations.delete') }}</button>
      </header>

      <div v-if="showDelete" class="invd-confirm" data-testid="investigation-delete-confirm">
        <span>{{ $t('investigations.delete_confirm') }}</span>
        <button class="invd-danger" data-testid="investigation-delete-cascade" @click="deleteInv('cascade')">
          {{ $t('investigations.delete_all') }}
        </button>
        <button class="inv-primary" data-testid="investigation-delete-orphan" @click="deleteInv('orphan')">
          {{ $t('investigations.delete_keep') }}
        </button>
        <button class="invd-cancel" data-testid="investigation-delete-cancel" @click="showDelete = false">
          {{ $t('app.cancel') }}
        </button>
      </div>
      <p class="invd-desc">{{ inv.description }}</p>

      <section class="invd-section">
        <h2>{{ $t('investigations.members') }}</h2>
        <ul class="invd-members" data-testid="investigation-members">
          <li v-for="m in members" :key="m.user_id" class="invd-member" :data-testid="'member-' + m.user_id">
            <span class="invd-member-id">{{ m.email || m.name || m.user_id }}</span>
            <span class="invd-member-role" :data-testid="'member-role-' + m.user_id">{{ roleLabel(m) }}</span>
            <template v-if="canManage">
              <select
                class="invd-role-select"
                :data-testid="'member-role-select-' + m.user_id"
                :value="m.role"
                @change="setRole(m, $event.target.value)"
              >
                <option v-for="r in ROLES" :key="r" :value="r">{{ $t('investigations.role_' + r) }}</option>
              </select>
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
          <select v-model="inviteRole" class="invd-role-select" data-testid="invite-role">
            <option v-for="r in ROLES" :key="r" :value="r">{{ $t('investigations.role_' + r) }}</option>
          </select>
          <button class="inv-primary" data-testid="invite-add-btn" @click="invite">{{ $t('investigations.invite') }}</button>
        </div>
      </section>

      <section class="invd-section" data-testid="investigation-stories">
        <h2>{{ $t('investigations.stories') }}</h2>
        <p v-if="!stories.length" class="invd-empty">{{ $t('investigations.no_stories') }}</p>
        <ul v-else class="invd-stories">
          <li v-for="s in stories" :key="s.id" class="invd-story" :data-testid="'inv-story-' + s.id">
            <router-link :to="`/stories/${s.id}`" class="invd-story-link">{{ s.title || 'Untitled' }}</router-link>
            <button
              v-if="canWrite"
              class="invd-remove"
              :data-testid="'inv-story-remove-' + s.id"
              @click="removeStory(s)"
            >&times;</button>
          </li>
        </ul>
      </section>

      <section class="invd-section" data-testid="investigation-viz">
        <h2>{{ $t('investigations.visualizations') }}</h2>
        <p v-if="!viz.length" class="invd-empty">{{ $t('investigations.no_viz') }}</p>
        <ul v-else class="invd-stories">
          <li v-for="v in viz" :key="v.id" class="invd-story" :data-testid="'inv-viz-' + v.id">
            <span class="invd-viz-type">{{ (v.widget_type || '').replace(/_/g, ' ') }}</span>
            <span class="invd-story-link">{{ v.name || 'Untitled' }}</span>
          </li>
        </ul>
      </section>

      <section class="invd-section" data-testid="investigation-data-projects">
        <h2>Data projects</h2>
        <p v-if="!dataProjects.length" class="invd-empty">No data projects shared with this investigation yet.</p>
        <div v-else class="invd-dps">
          <div v-for="p in dataProjects" :key="p.id" class="invd-dp" :data-testid="'inv-dp-' + p.id">
            <div class="invd-dp-head">
              <router-link :to="`/studio/p/${p.id}`" class="invd-dp-link" :data-testid="'inv-dp-open-' + p.id">{{ p.name }}</router-link>
              <span class="invd-dp-meta">{{ (p.queries || []).length }} queries · {{ (p.plots || []).length }} plots</span>
              <button v-if="canWrite" type="button" class="invd-dp-detach" :data-testid="'inv-dp-detach-' + p.id" @click="detachDataProject(p.id)">Detach</button>
            </div>
            <div v-if="(p.plots || []).length" class="invd-dp-plots">
              <figure v-for="pl in p.plots" :key="pl.id" class="invd-dp-plot" :data-testid="'inv-dp-plot-' + pl.id">
                <figcaption class="invd-dp-plot-title">{{ pl.name }}</figcaption>
                <PipelineEmbed :config="plotConfig(pl.spec)" />
              </figure>
            </div>
          </div>
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
.invd-empty { color: var(--muted); font-size: 0.85rem; }
.invd-stories { list-style: none; padding: 0; margin: 0; }
.invd-story { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; }
.invd-story-link { color: var(--accent); text-decoration: none; font-size: 0.9rem; }
.invd-role-select { font-size: 0.8rem; padding: 0.2rem 0.3rem; border: 1px solid var(--border); border-radius: 4px; background: var(--surface); color: var(--text); }
.invd-delete-btn { margin-left: auto; border: 1px solid var(--border); background: none; color: #dc2626; border-radius: 6px; padding: 0.3rem 0.7rem; cursor: pointer; font-size: 0.8rem; }
.invd-confirm { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #dc2626; border-radius: 6px; font-size: 0.85rem; }
.invd-danger { background: #dc2626; color: #fff; border: none; border-radius: 6px; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.82rem; }
.invd-cancel { border: none; background: none; color: var(--muted); cursor: pointer; font-size: 0.82rem; }
.invd-viz-type { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; margin-right: 0.4rem; }
.invd-dps { display: flex; flex-direction: column; gap: 1.1rem; }
.invd-dp { border: 1px solid var(--border); border-radius: 10px; padding: 0.8rem; background: var(--surface); }
.invd-dp-head { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 0.5rem; }
.invd-dp-link { font-weight: 700; color: var(--text); text-decoration: none; }
.invd-dp-link:hover { color: var(--accent); text-decoration: underline; }
.invd-dp-meta { font-size: 0.76rem; color: var(--muted); flex: 1; }
.invd-dp-detach { background: none; border: 1px solid var(--border); border-radius: 6px; color: var(--muted); font-size: 0.75rem; padding: 0.15rem 0.5rem; cursor: pointer; }
.invd-dp-detach:hover { color: #dc2626; border-color: #dc262655; }
.invd-dp-plots { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.8rem; }
.invd-dp-plot { margin: 0; border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem; background: var(--bg); }
.invd-dp-plot-title { font-size: 0.8rem; font-weight: 600; margin-bottom: 0.3rem; color: var(--text); }
</style>
