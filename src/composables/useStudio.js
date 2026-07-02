/**
 * Data Studio store — server-backed (per-user, /capi/studio). Projects, queries
 * and plots persist to the user's account; only the DuckDB *runtime* stays in
 * the browser. A reactive cache mirrors the server so views read synchronously;
 * mutations call the API then patch the cache. No query results are stored.
 */
import { ref } from 'vue'
import * as api from '../api/studio.js'

const projects = ref([])
const loaded = ref(false)
const loading = ref(false)
const error = ref(null)
let _loadPromise = null

async function ensureLoaded(force = false) {
  if (loaded.value && !force) return projects.value
  if (_loadPromise) return _loadPromise
  loading.value = true
  error.value = null
  _loadPromise = api.listProjects()
    .then((list) => { projects.value = list || []; loaded.value = true; return projects.value })
    .catch((e) => { error.value = e.message; return [] })
    .finally(() => { loading.value = false; _loadPromise = null })
  return _loadPromise
}

const _find = (id) => projects.value.find((p) => p.id === id) || null
const getProject = (id) => _find(id)
function getQuery(pid, qid) { const p = _find(pid); return p ? (p.queries.find((q) => q.id === qid) || null) : null }
function getPlot(pid, plid) { const p = _find(pid); return p ? (p.plots.find((pl) => pl.id === plid) || null) : null }

// ── projects ────────────────────────────────────────────────────
async function createProject(name) {
  const p = await api.createProject(name)
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
    projects, loaded, loading, error, ensureLoaded,
    getProject, getQuery, getPlot,
    createProject, renameProject, deleteProject,
    createQuery, updateQuery, renameQuery, deleteQuery, duplicateQuery,
    createPlot, updatePlot, deletePlot,
    reset: () => { projects.value = []; loaded.value = false },
  }
}
