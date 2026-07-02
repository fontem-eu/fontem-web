<script setup>
/**
 * Data Studio navigator for the left drawer (server-backed). A tree of data
 * projects; each expands to its Queries and its Plots. Row actions (rename /
 * duplicate / delete / new) are inline — rename edits the label in place,
 * delete is a two-click confirm — so there are no native browser popups.
 */
import { reactive, ref, nextTick, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStudio } from '../composables/useStudio.js'

const emit = defineEmits(['navigate'])
const route = useRoute()
const router = useRouter()
const studio = useStudio()

const expanded = reactive({})
const menu = reactive({ kind: null, pid: null, id: null })
const editing = reactive({ kind: null, pid: null, id: null, buffer: '' })
const confirmId = ref(null)

onMounted(() => studio.ensureLoaded())

const isExpanded = (pid) => !!expanded[pid]
const toggleExpand = (pid) => { expanded[pid] = !expanded[pid] }
function openMenu(kind, pid, id = null) {
  confirmId.value = null
  if (menu.kind === kind && menu.id === (id || pid)) { menu.kind = null; return }
  Object.assign(menu, { kind, pid, id: id || pid })
}
const closeMenu = () => { menu.kind = null; confirmId.value = null }
function go(path) { closeMenu(); emit('navigate'); router.push(path) }

watch(() => route.params.projectId, (pid) => { if (pid) expanded[pid] = true }, { immediate: true })
const activeProject = (pid) => route.params.projectId === pid
const activeQuery = (qid) => route.params.queryId === qid
const activePlot = (plid) => route.params.plotId === plid

// ── inline rename ───────────────────────────────────────────────
function startRename(kind, pid, id, name) {
  Object.assign(editing, { kind, pid, id, buffer: name })
  closeMenu()
  nextTick(() => { const el = document.querySelector('[data-testid="nav-rename"]'); el?.focus(); el?.select() })
}
async function commitRename() {
  const { kind, pid, id, buffer } = editing
  const name = buffer.trim()
  if (name) {
    if (kind === 'project') await studio.renameProject(pid, name)
    else if (kind === 'query') await studio.renameQuery(pid, id, name)
    else if (kind === 'plot') await studio.updatePlot(pid, id, { name })
  }
  editing.kind = null
}
const isEditing = (kind, id) => editing.kind === kind && editing.id === id

// ── create / duplicate / delete ─────────────────────────────────
async function newProject() {
  const p = await studio.createProject('Untitled project')
  expanded[p.id] = true
  go(`/studio/p/${p.id}?new=1`)
}
async function newQuery(pid) {
  const q = await studio.createQuery(pid, {})
  expanded[pid] = true
  go(`/studio/p/${pid}/q/${q.id}`)
}
const newPlot = (pid) => { expanded[pid] = true; go(`/studio/p/${pid}/plot`) }
async function duplicateQuery(pid, id) {
  const c = await studio.duplicateQuery(pid, id)
  if (c) go(`/studio/p/${pid}/q/${c.id}`)
}
function askDelete(id) { confirmId.value = confirmId.value === id ? null : id }
async function doDelete(kind, pid, id) {
  if (kind === 'project') { await studio.deleteProject(pid); if (activeProject(pid)) go('/studio') }
  else if (kind === 'query') { await studio.deleteQuery(pid, id); if (activeQuery(id)) go(`/studio/p/${pid}`) }
  else if (kind === 'plot') { await studio.deletePlot(pid, id); if (activePlot(id)) go(`/studio/p/${pid}`) }
  closeMenu()
}
</script>

<template>
  <div class="snav" data-testid="studio-nav">
    <div v-for="p in studio.projects.value" :key="p.id" class="proj" data-testid="studio-nav-project">
      <div class="srow" :class="{ active: activeProject(p.id) }">
        <button type="button" class="twist" :data-testid="'nav-project-toggle-' + p.id" :aria-expanded="isExpanded(p.id)" @click="toggleExpand(p.id)">
          <span class="chev" :class="{ open: isExpanded(p.id) }">▸</span>
        </button>
        <input
v-if="isEditing('project', p.id)" v-model="editing.buffer" class="rename" data-testid="nav-rename"
          @keyup.enter="commitRename" @keyup.esc="editing.kind = null" @blur="commitRename" />
        <button v-else type="button" class="srow-label" data-testid="nav-project-name" @click="go(`/studio/p/${p.id}`)">{{ p.name }}</button>
        <button type="button" class="dots" data-testid="nav-project-menu" aria-label="Project actions" @click="openMenu('project', p.id)">⋯</button>
      </div>
      <div v-if="menu.kind === 'project' && menu.id === p.id" class="menu" data-testid="nav-menu">
        <button type="button" data-testid="menu-rename" @click="startRename('project', p.id, p.id, p.name)">Rename</button>
        <button type="button" data-testid="menu-new-query" @click="newQuery(p.id)">New query</button>
        <button v-if="confirmId !== p.id" type="button" class="danger" data-testid="menu-delete" @click="askDelete(p.id)">Delete</button>
        <button v-else type="button" class="danger" data-testid="menu-delete-confirm" @click="doDelete('project', p.id, p.id)">Confirm delete</button>
      </div>

      <div v-if="isExpanded(p.id)" class="children">
        <div class="grouplabel">Queries</div>
        <div v-for="q in p.queries" :key="q.id" data-testid="studio-nav-query">
          <div class="srow srow--child" :class="{ active: activeQuery(q.id) }">
            <input
v-if="isEditing('query', q.id)" v-model="editing.buffer" class="rename" data-testid="nav-rename"
              @keyup.enter="commitRename" @keyup.esc="editing.kind = null" @blur="commitRename" />
            <button v-else type="button" class="srow-label" @click="go(`/studio/p/${p.id}/q/${q.id}`)">{{ q.name }}</button>
            <button type="button" class="dots" data-testid="nav-query-menu" aria-label="Query actions" @click="openMenu('query', p.id, q.id)">⋯</button>
          </div>
          <div v-if="menu.kind === 'query' && menu.id === q.id" class="menu" data-testid="nav-menu">
            <button type="button" data-testid="menu-rename" @click="startRename('query', p.id, q.id, q.name)">Rename</button>
            <button type="button" data-testid="menu-duplicate" @click="duplicateQuery(p.id, q.id)">Duplicate</button>
            <button v-if="confirmId !== q.id" type="button" class="danger" data-testid="menu-delete" @click="askDelete(q.id)">Delete</button>
            <button v-else type="button" class="danger" data-testid="menu-delete-confirm" @click="doDelete('query', p.id, q.id)">Confirm delete</button>
          </div>
        </div>
        <button type="button" class="add" data-testid="nav-new-query" @click="newQuery(p.id)">+ New query</button>

        <div class="grouplabel">Plots</div>
        <div v-for="pl in p.plots" :key="pl.id" data-testid="studio-nav-plot">
          <div class="srow srow--child" :class="{ active: activePlot(pl.id) }">
            <input
v-if="isEditing('plot', pl.id)" v-model="editing.buffer" class="rename" data-testid="nav-rename"
              @keyup.enter="commitRename" @keyup.esc="editing.kind = null" @blur="commitRename" />
            <button v-else type="button" class="srow-label" @click="go(`/studio/p/${p.id}/plot/${pl.id}`)">{{ pl.name }}</button>
            <button type="button" class="dots" data-testid="nav-plot-menu" aria-label="Plot actions" @click="openMenu('plot', p.id, pl.id)">⋯</button>
          </div>
          <div v-if="menu.kind === 'plot' && menu.id === pl.id" class="menu" data-testid="nav-menu">
            <button type="button" data-testid="menu-rename" @click="startRename('plot', p.id, pl.id, pl.name)">Rename</button>
            <button v-if="confirmId !== pl.id" type="button" class="danger" data-testid="menu-delete" @click="askDelete(pl.id)">Delete</button>
            <button v-else type="button" class="danger" data-testid="menu-delete-confirm" @click="doDelete('plot', p.id, pl.id)">Confirm delete</button>
          </div>
        </div>
        <button type="button" class="add" data-testid="nav-new-plot" @click="newPlot(p.id)">+ New plot</button>
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
.rename { flex: 1; font-size: 0.82rem; padding: 0.25rem 0.3rem; border: 1px solid var(--accent); border-radius: 5px; background: var(--bg); color: var(--text); min-width: 0; }
.dots { border: 0; background: transparent; color: var(--muted); cursor: pointer; padding: 0.2rem 0.4rem; font-size: 1rem; line-height: 1; border-radius: 5px; }
.dots:hover { color: var(--text); background: color-mix(in srgb, var(--accent) 14%, transparent); }
.children { padding-left: 1.1rem; border-left: 1px solid var(--bezel-border); margin-left: 0.55rem; }
.srow--child { padding-left: 0.1rem; }
.grouplabel { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); opacity: 0.7; padding: 0.35rem 0.2rem 0.15rem; }
.add { text-align: left; border: 0; background: transparent; color: var(--accent); cursor: pointer; font-size: 0.78rem; font-weight: 600; padding: 0.3rem 0.2rem; }
.add--project { margin-top: 0.3rem; padding-left: 0.2rem; }
.menu { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin: 0.2rem 0 0.2rem 0.3rem; overflow: hidden; }
.menu button { text-align: left; border: 0; background: transparent; color: var(--text); cursor: pointer; font-size: 0.8rem; padding: 0.45rem 0.7rem; }
.menu button:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.menu button.danger { color: #dc2626; }
</style>
