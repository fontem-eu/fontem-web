/**
 * Data Studio store — browser-local (localStorage) persistence for data
 * projects and their queries. A project groups queries (and, later, plots);
 * each query is a { lang, query } recipe against a read-only proxy.
 *
 * Client-side for now (mirrors usePocket); the API surface is deliberately
 * store-shaped so a future server-backed sync can slot in behind it without
 * touching the views. No query *results* are persisted — only the recipe.
 */
import { ref } from 'vue'

const KEY = 'fontem-studio'

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || '{}')
    return Array.isArray(d.projects) ? d.projects : []
  } catch { return [] }
}

// Module-scoped so every useStudio() caller shares one reactive store.
const projects = ref(load())

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ projects: projects.value })) } catch { /* quota */ }
}

const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

function getProject(id) { return projects.value.find((p) => p.id === id) || null }
function getQuery(pid, qid) {
  const p = getProject(pid)
  return p ? (p.queries.find((q) => q.id === qid) || null) : null
}

function createProject(name) {
  const p = { id: uid(), name: (name || '').trim() || 'Untitled project', createdAt: now(), queries: [], plots: [] }
  projects.value.unshift(p)
  persist()
  return p
}
function renameProject(id, name) {
  const p = getProject(id)
  if (p && name?.trim()) { p.name = name.trim(); persist() }
}
function deleteProject(id) {
  projects.value = projects.value.filter((p) => p.id !== id)
  persist()
}

function createQuery(pid, init = {}) {
  const p = getProject(pid)
  if (!p) return null
  const q = {
    id: uid(),
    name: (init.name || '').trim() || `Query ${p.queries.length + 1}`,
    lang: init.lang || 'cypher',
    query: init.query || '',
    updatedAt: now(),
  }
  p.queries.push(q)
  persist()
  return q
}
function updateQuery(pid, qid, patch) {
  const q = getQuery(pid, qid)
  if (q) { Object.assign(q, patch, { updatedAt: now() }); persist() }
}
function renameQuery(pid, qid, name) {
  if (name?.trim()) updateQuery(pid, qid, { name: name.trim() })
}
function deleteQuery(pid, qid) {
  const p = getProject(pid)
  if (p) { p.queries = p.queries.filter((q) => q.id !== qid); persist() }
}
function duplicateQuery(pid, qid) {
  const p = getProject(pid)
  const q = getQuery(pid, qid)
  if (!p || !q) return null
  const copy = { ...q, id: uid(), name: `${q.name} copy`, updatedAt: now() }
  const i = p.queries.findIndex((x) => x.id === qid)
  p.queries.splice(i + 1, 0, copy)
  persist()
  return copy
}

export function useStudio() {
  return {
    projects,
    refresh: () => { projects.value = load() },
    getProject, getQuery,
    createProject, renameProject, deleteProject,
    createQuery, updateQuery, renameQuery, deleteQuery, duplicateQuery,
  }
}
