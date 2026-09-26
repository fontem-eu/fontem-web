/**
 * Data Studio store — server-backed (per-user, /capi/studio). Projects, queries
 * and plots persist to the user's account; only the DuckDB *runtime* stays in
 * the browser. A reactive cache mirrors the server so views read synchronously;
 * mutations call the API then patch the cache. No query results are stored.
 */
import { ref } from 'vue'
import * as api from '../api/studio.js'
import { PAGE_SIZE, appendPage, cursorOf, mayHaveMore } from '../utils/paging.js'

const projects = ref([])          // owned (list_mine), the pages loaded so far — home/drawer
const shared = ref({})            // id -> project, individually fetched (shared with me, or not yet paged in)
const loaded = ref(false)
const loading = ref(false)
const error = ref(null)
// The owned list is paged. The rail draws it on every page of the app, and
// fetching all of it was 3.26 MB on an account with 1,147 projects — each one
// carries every query and plot. A view that needs a project outside the pages
// loaded so far gets it from ensureProject(), which fetches it on its own.
const hasMore = ref(false)
const loadingMore = ref(false)
let _cursor = ''
let _loadPromise = null

async function ensureLoaded(force = false) {
  if (loaded.value && !force) return projects.value
  if (_loadPromise) return _loadPromise
  loading.value = true
  error.value = null
  _loadPromise = api.listProjects({ limit: PAGE_SIZE.projects })
    // Only a list is a list of projects. An error body or an HTML page
    // that slipped through as 200 would otherwise land here, and the
    // rail (which now draws this tree on every page) would crash on it.
    .then((list) => {
      const page = Array.isArray(list) ? list : []
      projects.value = page
      hasMore.value = mayHaveMore(page, PAGE_SIZE.projects)
      _cursor = cursorOf(page[page.length - 1])
      loaded.value = true
      return projects.value
    })
    .catch((e) => { error.value = e.message; return [] })
    .finally(() => { loading.value = false; _loadPromise = null })
  return _loadPromise
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return projects.value
  loadingMore.value = true
  try {
    const page = await api.listProjects({ limit: PAGE_SIZE.projects, before: _cursor })
    const before = projects.value.length
    projects.value = appendPage(projects.value, page)
    // Nothing new means nothing more, whatever the page size says.
    hasMore.value = mayHaveMore(page, PAGE_SIZE.projects) && projects.value.length > before
    if (Array.isArray(page) && page.length) _cursor = cursorOf(page[page.length - 1])
  } catch (e) {
    error.value = e.message
  } finally {
    loadingMore.value = false
  }
  return projects.value
}

const _find = (id) => projects.value.find((p) => p.id === id) || shared.value[id] || null
async function ensureProject(id) {
  const local = _find(id)
  if (local) return local
  try {
    const p = await api.getProject(id)
    shared.value = { ...shared.value, [id]: p }
    return p
  } catch { return null }
}
const getProject = (id) => _find(id)
function getQuery(pid, qid) { const p = _find(pid); return p ? (p.queries.find((q) => q.id === qid) || null) : null }
function getPlot(pid, plid) { const p = _find(pid); return p ? (p.plots.find((pl) => pl.id === plid) || null) : null }

// ── projects ────────────────────────────────────────────────────
async function createProject(name, investigationId = null) {
  const p = await api.createProject(name, investigationId)
  projects.value.unshift(p)
  return p
}
async function renameProject(id, name) {
  const p = await api.renameProject(id, name)
  const cur = _find(id)
  if (cur) cur.name = p.name
  return p
}
async function deleteProject(id) {
  await api.deleteProject(id)
  projects.value = projects.value.filter((p) => p.id !== id)
  const rest = { ...shared.value }; delete rest[id]; shared.value = rest
}
async function attachProject(id, investigationId) {
  await api.attachProject(id, investigationId)
  const cur = _find(id); if (cur) cur.investigation_id = investigationId
}
async function detachProject(id) {
  await api.detachProject(id)
  const cur = _find(id); if (cur) cur.investigation_id = null
}

// ── queries ─────────────────────────────────────────────────────
async function createQuery(pid, body = {}) {
  const q = await api.createQuery(pid, body)
  const p = _find(pid)
  if (p) p.queries.push(q)
  return q
}
async function updateQuery(pid, qid, patch) {
  const q = await api.updateQuery(pid, qid, patch)
  const cur = getQuery(pid, qid)
  if (cur) Object.assign(cur, q)
  return q
}
const renameQuery = (pid, qid, name) => updateQuery(pid, qid, { name })
async function deleteQuery(pid, qid) {
  await api.deleteQuery(pid, qid)
  const p = _find(pid)
  if (p) p.queries = p.queries.filter((q) => q.id !== qid)
}
async function duplicateQuery(pid, qid) {
  const q = await api.duplicateQuery(pid, qid)
  const p = _find(pid)
  if (p) p.queries.push(q)
  return q
}

// ── plots ───────────────────────────────────────────────────────
async function createPlot(pid, body) {
  const pl = await api.createPlot(pid, body)
  const p = _find(pid)
  if (p) p.plots.push(pl)
  return pl
}
async function updatePlot(pid, plid, patch) {
  const pl = await api.updatePlot(pid, plid, patch)
  const cur = getPlot(pid, plid)
  if (cur) Object.assign(cur, pl)
  return pl
}
async function deletePlot(pid, plid) {
  await api.deletePlot(pid, plid)
  const p = _find(pid)
  if (p) p.plots = p.plots.filter((pl) => pl.id !== plid)
}

export function useStudio() {
  return {
    projects, loaded, loading, error, ensureLoaded, hasMore, loadingMore, loadMore,
    getProject, getQuery, getPlot, ensureProject,
    createProject, renameProject, deleteProject, attachProject, detachProject,
    createQuery, updateQuery, renameQuery, deleteQuery, duplicateQuery,
    createPlot, updatePlot, deletePlot,
    reset: () => {
      projects.value = []; shared.value = {}; loaded.value = false
      hasMore.value = false; _cursor = ''
    },
  }
}
