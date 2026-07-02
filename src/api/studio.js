/**
 * Data Studio API — server-side data projects, queries and plots (owner-private,
 * under /capi/studio). Only recipes are stored; query execution + the DuckDB
 * combine happen client-side. Reuses community.js's authed request() (JWT +
 * silent refresh).
 */
import { request } from './community.js'

// ── projects ────────────────────────────────────────────────────
export const listProjects = () => request('GET', '/studio/projects')
export const createProject = (name) => request('POST', '/studio/projects', { name })
export const getProject = (id) => request('GET', `/studio/projects/${id}`)
export const renameProject = (id, name) => request('PUT', `/studio/projects/${id}`, { name })
export const deleteProject = (id) => request('DELETE', `/studio/projects/${id}`)

// ── queries ─────────────────────────────────────────────────────
export const createQuery = (pid, body) => request('POST', `/studio/projects/${pid}/queries`, body)
export const updateQuery = (pid, qid, body) => request('PUT', `/studio/projects/${pid}/queries/${qid}`, body)
export const deleteQuery = (pid, qid) => request('DELETE', `/studio/projects/${pid}/queries/${qid}`)
export const duplicateQuery = (pid, qid) => request('POST', `/studio/projects/${pid}/queries/${qid}/duplicate`)

// ── plots ───────────────────────────────────────────────────────
export const createPlot = (pid, body) => request('POST', `/studio/projects/${pid}/plots`, body)
export const updatePlot = (pid, plid, body) => request('PUT', `/studio/projects/${pid}/plots/${plid}`, body)
export const deletePlot = (pid, plid) => request('DELETE', `/studio/projects/${pid}/plots/${plid}`)
