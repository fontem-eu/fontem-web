<script setup>
/**
 * Data Studio — project overview. Server-backed. Inline-editable project name
 * (autosaves), the project's queries (open the editor) and its saved plots
 * (open the plot builder). No browser prompts.
 */
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStudio } from '../composables/useStudio.js'
import { engine } from '../composables/studioEngines.js'
import StudioShareModal from '../components/StudioShareModal.vue'

const route = useRoute()
const router = useRouter()
const studio = useStudio()

const project = ref(null)
const nameEl = ref(null)
const showShare = ref(false)
const access = computed(() => project.value?.my_access
  || { level: 'owner', can_edit: true, can_delete: true, can_share: true })

async function hydrate() {
  await studio.ensureLoaded()
  project.value = await studio.ensureProject(route.params.projectId)
  if (!project.value) { router.replace('/studio'); return }
  if (route.query.new) nextTick(() => { nameEl.value?.focus(); nameEl.value?.select() })
}
onMounted(hydrate)
watch(() => route.params.projectId, hydrate)

let renameTimer = null
function onName(e) {
  if (!project.value || !access.value.can_edit) return
  project.value.name = e.target.value
  clearTimeout(renameTimer)
  renameTimer = setTimeout(() => studio.renameProject(route.params.projectId, project.value.name.trim() || 'Untitled project'), 400)
}

const queries = computed(() => project.value?.queries || [])
const plots = computed(() => project.value?.plots || [])

async function newQuery() {
  const q = await studio.createQuery(route.params.projectId, {})
  router.push(`/studio/p/${route.params.projectId}/q/${q.id}`)
}
function firstLine(text) { return (text || '').split('\n')[0].slice(0, 80) || '(empty)' }
</script>

<template>
  <div v-if="project" class="pview" data-testid="studio-project-view">
    <nav class="crumbs"><router-link to="/studio">{{ $t('studio_project.studio') }}</router-link></nav>
    <div class="phead">
      <input ref="nameEl" :value="project.name" class="pname" data-testid="project-name" spellcheck="false" :aria-label="$t('studio_project.project_name')" :readonly="!access.can_edit" @input="onName" />
      <div class="pmeta">
        <span class="acc-badge" :class="`acc-badge--${access.level}`" data-testid="project-access">{{ access.level }}</span>
        <button v-if="access.can_share" type="button" class="sbtn" data-testid="project-share" @click="showShare = true">{{ $t('studio_project.share') }}</button>
      </div>
    </div>
    <p v-if="!access.can_edit" class="ro-note" data-testid="project-readonly">{{ $t('studio_project.view_only_access') }}</p>

    <section class="grp">
      <div class="grp-head">
        <h2 class="grp-title">{{ $t('studio_project.queries') }}</h2>
        <button v-if="access.can_edit" type="button" class="sbtn sbtn--primary" data-testid="project-new-query" @click="newQuery">{{ $t('studio_project.new_query') }}</button>
      </div>
      <p v-if="!queries.length" class="empty">{{ $t('studio_project.no_queries_yet') }}</p>
      <ul v-else class="qlist">
        <li v-for="q in queries" :key="q.id">
          <router-link :to="`/studio/p/${project.id}/q/${q.id}`" class="qrow" data-testid="project-query">
            <span class="qbadge">{{ engine(q.lang).label }}</span>
            <span class="qrow-name">{{ q.name }}</span>
            <code class="qrow-snip">{{ firstLine(q.query) }}</code>
          </router-link>
        </li>
      </ul>
    </section>

    <section class="grp">
      <div class="grp-head">
        <h2 class="grp-title">{{ $t('studio_project.plots') }}</h2>
        <router-link v-if="access.can_edit" :to="`/studio/p/${project.id}/plot`" class="sbtn sbtn--primary" data-testid="project-new-plot">{{ $t('studio_project.new_plot') }}</router-link>
      </div>
      <p v-if="!plots.length" class="empty">{{ $t('studio_project.no_plots_yet') }}</p>
      <ul v-else class="qlist">
        <li v-for="pl in plots" :key="pl.id">
          <router-link :to="`/studio/p/${project.id}/plot/${pl.id}`" class="qrow" data-testid="project-plot">
            <span class="qbadge">{{ (pl.spec && pl.spec.chart) || 'chart' }}</span>
            <span class="qrow-name">{{ pl.name }}</span>
          </router-link>
        </li>
      </ul>
    </section>

    <StudioShareModal v-if="showShare" :project="project" @close="showShare = false" />
  </div>
</template>

<style scoped>
.pview { max-width: 60rem; margin: 0 auto; padding: 0.5rem 1rem 4rem; }
.crumbs { font-size: 0.8rem; color: var(--muted); padding: 0.6rem 0; }
.crumbs a { color: var(--muted); text-decoration: none; }
.crumbs a:hover { color: var(--text); text-decoration: underline; }
.pname { font-size: 1.4rem; font-weight: 800; border: 1px solid transparent; border-radius: 8px; padding: 0.3rem 0.5rem; background: transparent; color: var(--text); width: 100%; box-sizing: border-box; margin-bottom: 1rem; }
.pname:hover { border-color: var(--border); }
.pname:focus { border-color: var(--accent); outline: none; background: var(--bg); }
.phead { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.4rem; }
.phead .pname { margin-bottom: 0; }
.pmeta { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.acc-badge { font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; border-radius: 5px; padding: 0.12rem 0.4rem; border: 1px solid var(--border); color: var(--muted); }
.acc-badge--owner { color: var(--accent); border-color: var(--accent); }
.acc-badge--editor { color: #b45309; border-color: #b4530955; }
.ro-note { color: var(--muted); font-size: 0.8rem; margin: 0 0 1rem; font-style: italic; }
.grp { margin: 1.5rem 0; }
.grp-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; margin-bottom: 0.7rem; }
.grp-title { font-size: 1rem; font-weight: 700; margin: 0; }
.empty { color: var(--muted); font-size: 0.88rem; }
.qlist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.qrow { display: flex; align-items: center; gap: 0.7rem; padding: 0.6rem 0.7rem; border: 1px solid var(--border); border-radius: 8px; text-decoration: none; color: var(--text); background: var(--surface); }
.qrow:hover { border-color: var(--accent); }
.qbadge { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; color: var(--accent); border: 1px solid var(--border); border-radius: 5px; padding: 0.1rem 0.35rem; flex-shrink: 0; }
.qrow-name { font-weight: 600; font-size: 0.9rem; flex-shrink: 0; }
.qrow-snip { color: var(--muted); font-size: 0.76rem; font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sbtn { display: inline-block; border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 8px; padding: 0.4rem 0.85rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; text-decoration: none; }
.sbtn--primary { background: var(--accent); color: #fff; border-color: var(--accent); }
</style>
