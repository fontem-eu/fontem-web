<script setup>
/**
 * Data Studio navigator for the left drawer. A tree of data projects; each
 * expands to its Queries (open the single-query editor) and a Plots entry.
 * Row context actions (rename / duplicate / delete / new) appear inline beneath
 * the row — no absolute popovers to clip inside the scrolling rail or fumble on
 * mobile. Naming uses native prompt()/confirm() for now (MVP; refine later).
 */
import { reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStudio } from '../composables/useStudio.js'

const emit = defineEmits(['navigate'])
const route = useRoute()
const router = useRouter()
const studio = useStudio()

const expanded = reactive({})
const menu = reactive({ kind: null, pid: null, qid: null })

function isExpanded(pid) { return !!expanded[pid] }
function toggleExpand(pid) { expanded[pid] = !expanded[pid] }
function openMenu(kind, pid, qid = null) {
  if (menu.kind === kind && menu.pid === pid && menu.qid === qid) { menu.kind = null; return }
  Object.assign(menu, { kind, pid, qid })
}
function closeMenu() { menu.kind = null }
function go(path) { closeMenu(); emit('navigate'); router.push(path) }

// Auto-expand the project in the current route.
watch(() => route.params.projectId, (pid) => { if (pid) expanded[pid] = true }, { immediate: true })

const activeProject = (pid) => route.params.projectId === pid
const activeQuery = (qid) => route.params.queryId === qid

function newProject() {
  const name = typeof prompt === 'function' ? prompt('Name your data project', 'Untitled project') : null
  if (name === null) return
  const p = studio.createProject(name)
  expanded[p.id] = true
  go(`/studio/p/${p.id}`)
}
function newQuery(pid) {
  const q = studio.createQuery(pid, {})
  expanded[pid] = true
  if (q) go(`/studio/p/${pid}/q/${q.id}`)
}
function renameProject(pid, cur) {
  const name = typeof prompt === 'function' ? prompt('Rename project', cur) : null
  if (name) studio.renameProject(pid, name)
  closeMenu()
}
function deleteProject(pid) {
  if (typeof confirm === 'function' && !confirm('Delete this project and all its queries?')) return
  studio.deleteProject(pid)
  closeMenu()
  if (activeProject(pid)) go('/studio')
}
function renameQuery(pid, qid, cur) {
  const name = typeof prompt === 'function' ? prompt('Rename query', cur) : null
  if (name) studio.renameQuery(pid, qid, name)
  closeMenu()
}
function duplicateQuery(pid, qid) {
  const c = studio.duplicateQuery(pid, qid)
  closeMenu()
  if (c) go(`/studio/p/${pid}/q/${c.id}`)
}
function deleteQuery(pid, qid) {
  if (typeof confirm === 'function' && !confirm('Delete this query?')) return
  studio.deleteQuery(pid, qid)
  closeMenu()
  if (activeQuery(qid)) go(`/studio/p/${pid}`)
}
</script>

<template>
  <div class="snav" data-testid="studio-nav">
    <div v-for="p in studio.projects.value" :key="p.id" class="proj" data-testid="studio-nav-project">
      <div class="srow" :class="{ active: activeProject(p.id) }">
        <button type="button" class="twist" :data-testid="'nav-project-toggle-' + p.id" :aria-expanded="isExpanded(p.id)" @click="toggleExpand(p.id)">
          <span class="chev" :class="{ open: isExpanded(p.id) }">▸</span>
        </button>
        <button type="button" class="srow-label" data-testid="nav-project-name" @click="go(`/studio/p/${p.id}`)">{{ p.name }}</button>
        <button type="button" class="dots" data-testid="nav-project-menu" aria-label="Project actions" @click="openMenu('project', p.id)">⋯</button>
      </div>
      <div v-if="menu.kind === 'project' && menu.pid === p.id" class="menu" data-testid="nav-menu">
        <button type="button" data-testid="menu-rename" @click="renameProject(p.id, p.name)">Rename</button>
        <button type="button" data-testid="menu-new-query" @click="newQuery(p.id)">New query</button>
        <button type="button" class="danger" data-testid="menu-delete" @click="deleteProject(p.id)">Delete</button>
      </div>

      <div v-if="isExpanded(p.id)" class="children">
        <div class="grouplabel">Queries</div>
        <div v-for="q in p.queries" :key="q.id" data-testid="studio-nav-query">
          <div class="srow srow--child" :class="{ active: activeQuery(q.id) }">
            <button type="button" class="srow-label" @click="go(`/studio/p/${p.id}/q/${q.id}`)">{{ q.name }}</button>
            <button type="button" class="dots" data-testid="nav-query-menu" aria-label="Query actions" @click="openMenu('query', p.id, q.id)">⋯</button>
          </div>
          <div v-if="menu.kind === 'query' && menu.qid === q.id" class="menu" data-testid="nav-menu">
            <button type="button" data-testid="menu-rename" @click="renameQuery(p.id, q.id, q.name)">Rename</button>
            <button type="button" data-testid="menu-duplicate" @click="duplicateQuery(p.id, q.id)">Duplicate</button>
            <button type="button" class="danger" data-testid="menu-delete" @click="deleteQuery(p.id, q.id)">Delete</button>
          </div>
        </div>
        <button type="button" class="add" data-testid="nav-new-query" @click="newQuery(p.id)">+ New query</button>

        <div class="grouplabel">Plots</div>
        <button type="button" class="srow-label srow--child plot" @click="go(`/studio/p/${p.id}/plot`)">Combine &amp; plot</button>
      </div>
    </div>

    <button type="button" class="add add--project" data-testid="nav-new-project" @click="newProject">+ New project</button>
  </div>
</template>

<style scoped>
.snav { display: flex; flex-direction: column; gap: 0.05rem; padding-left: 0.4rem; }
.srow { display: flex; align-items: center; gap: 0.1rem; border-radius: 6px; }
.srow.active { background: color-mix(in srgb, var(--accent) 16%, transparent); }
.srow:hover { background: color-mix(in srgb, var(--accent) 8%, transparent); }
.twist { border: 0; background: transparent; color: var(--muted); cursor: pointer; padding: 0.25rem 0.15rem; }
.chev { display: inline-block; transition: transform 0.14s; font-size: 0.7rem; }
.chev.open { transform: rotate(90deg); }
.srow-label { flex: 1; text-align: left; border: 0; background: transparent; color: var(--muted); cursor: pointer; font-size: 0.82rem; font-weight: 500; padding: 0.3rem 0.2rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.srow.active > .srow-label, .srow:hover > .srow-label { color: var(--text); }
.dots { border: 0; background: transparent; color: var(--muted); cursor: pointer; padding: 0.2rem 0.4rem; font-size: 1rem; line-height: 1; border-radius: 5px; }
.dots:hover { color: var(--text); background: color-mix(in srgb, var(--accent) 14%, transparent); }
.children { padding-left: 1.1rem; border-left: 1px solid var(--bezel-border); margin-left: 0.55rem; }
.srow--child { padding-left: 0.1rem; }
.grouplabel { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); opacity: 0.7; padding: 0.35rem 0.2rem 0.15rem; }
.plot { display: block; width: 100%; }
.add { text-align: left; border: 0; background: transparent; color: var(--accent); cursor: pointer; font-size: 0.78rem; font-weight: 600; padding: 0.3rem 0.2rem; }
.add--project { margin-top: 0.3rem; padding-left: 0.2rem; }
.menu { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin: 0.2rem 0 0.2rem 0.3rem; overflow: hidden; }
.menu button { text-align: left; border: 0; background: transparent; color: var(--text); cursor: pointer; font-size: 0.8rem; padding: 0.45rem 0.7rem; }
.menu button:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.menu button.danger { color: #dc2626; }
</style>
