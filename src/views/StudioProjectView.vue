<script setup>
/**
 * Data Studio — project overview. Lists the project's queries (each opens the
 * single-query editor) and the entry point to the project's plot builder.
 */
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStudio } from '../composables/useStudio.js'
import { engine } from '../composables/studioEngines.js'

const route = useRoute()
const router = useRouter()
const studio = useStudio()

const project = ref(null)
function hydrate() {
  project.value = studio.getProject(route.params.projectId)
  if (!project.value) router.replace('/studio')
}
hydrate()
watch(() => route.params.projectId, hydrate)

const name = computed({
  get: () => project.value?.name || '',
  set: (v) => studio.renameProject(route.params.projectId, v),
})
const queries = computed(() => project.value?.queries || [])

function newQuery() {
  const q = studio.createQuery(route.params.projectId, {})
  if (q) router.push(`/studio/p/${route.params.projectId}/q/${q.id}`)
}
function firstLine(text) { return (text || '').split('\n')[0].slice(0, 80) || '(empty)' }
</script>

<template>
  <div v-if="project" class="pview" data-testid="studio-project-view">
    <nav class="crumbs"><router-link to="/studio">Studio</router-link></nav>
    <input v-model="name" class="pname" data-testid="project-name" spellcheck="false" aria-label="Project name" />

    <section class="grp">
      <div class="grp-head">
        <h2 class="grp-title">Queries</h2>
        <button type="button" class="sbtn sbtn--primary" data-testid="project-new-query" @click="newQuery">+ New query</button>
      </div>
      <p v-if="!queries.length" class="empty">No queries yet. Create one to start pulling data.</p>
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
      <div class="grp-head"><h2 class="grp-title">Plots</h2></div>
      <router-link :to="`/studio/p/${project.id}/plot`" class="sbtn" data-testid="project-open-plot">Combine &amp; plot →</router-link>
      <p class="hint">Combine this project's queries in the browser (DuckDB) and chart the result.</p>
    </section>
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
.grp { margin: 1.5rem 0; }
.grp-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; margin-bottom: 0.7rem; }
.grp-title { font-size: 1rem; font-weight: 700; margin: 0; }
.empty { color: var(--muted); font-size: 0.88rem; }
.hint { color: var(--muted); font-size: 0.78rem; margin: 0.5rem 0 0; }
.qlist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.qrow { display: flex; align-items: center; gap: 0.7rem; padding: 0.6rem 0.7rem; border: 1px solid var(--border); border-radius: 8px; text-decoration: none; color: var(--text); background: var(--surface); }
.qrow:hover { border-color: var(--accent); }
.qbadge { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; color: var(--accent); border: 1px solid var(--border); border-radius: 5px; padding: 0.1rem 0.35rem; flex-shrink: 0; }
.qrow-name { font-weight: 600; font-size: 0.9rem; flex-shrink: 0; }
.qrow-snip { color: var(--muted); font-size: 0.76rem; font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sbtn { display: inline-block; border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 8px; padding: 0.4rem 0.85rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; text-decoration: none; }
.sbtn--primary { background: var(--accent); color: #fff; border-color: var(--accent); }
</style>
