/**
 * Data Studio API — server-side data projects, queries and plots (owner-private,
 * under /capi/studio). Only recipes are stored; query execution + the DuckDB
 * combine happen client-side. Reuses community.js's authed request() (JWT +
 * silent refresh).
 */
import { request } from './community.js'
import { PAGE_SIZE, MAX_PAGE_SIZE, pageQuery, fetchAll } from '../utils/paging.js'

// ── projects ────────────────────────────────────────────────────
// A page at a time, newest first — see src/utils/paging.js.
export const listProjects = ({ limit = PAGE_SIZE.projects, before = '' } = {}) =>
  request('GET', `/studio/projects${pageQuery({ limit, before })}`)
export const createProject = (name, investigationId = null) =>
  request('POST', '/studio/projects', { name, investigation_id: investigationId })
export const getProject = (id) => request('GET', `/studio/projects/${id}`)
export const renameProject = (id, name) => request('PUT', `/studio/projects/${id}`, { name })
export const deleteProject = (id) => request('DELETE', `/studio/projects/${id}`)

// ── investigation attach + per-user sharing ──
export const listProjectsForInvestigation = (iid, { limit = PAGE_SIZE.projects, before = '' } = {}) =>
  request('GET', `/studio/projects${pageQuery({ limit, before }, { investigation_id: iid })}`)
// Every project attached to an investigation. The detail view lists them all,
// as it always has; it walks the pages at the largest size the API allows.
export const listAllProjectsForInvestigation = (iid) =>
  fetchAll((page) => listProjectsForInvestigation(iid, page), MAX_PAGE_SIZE.projects)
export const attachProject = (id, investigationId) =>
  request('POST', `/studio/projects/${id}/attach`, { investigation_id: investigationId })
export const detachProject = (id) => request('POST', `/studio/projects/${id}/detach`)
export const listProjectAccess = (id) => request('GET', `/studio/projects/${id}/access`)
export const shareProject = (id, data) => request('POST', `/studio/projects/${id}/access`, data)
export const revokeProjectAccess = (id, uid) =>
  request('DELETE', `/studio/projects/${id}/access/${uid}`)
export const projectEffectiveAccess = (id) =>
  request('GET', `/studio/projects/${id}/effective-access`)

// ── queries ─────────────────────────────────────────────────────
export const createQuery = (pid, body) => request('POST', `/studio/projects/${pid}/queries`, body)
export const updateQuery = (pid, qid, body) => request('PUT', `/studio/projects/${pid}/queries/${qid}`, body)
export const deleteQuery = (pid, qid) => request('DELETE', `/studio/projects/${pid}/queries/${qid}`)
export const duplicateQuery = (pid, qid) => request('POST', `/studio/projects/${pid}/queries/${qid}/duplicate`)

// ── plots ───────────────────────────────────────────────────────
export const createPlot = (pid, body) => request('POST', `/studio/projects/${pid}/plots`, body)
export const updatePlot = (pid, plid, body) => request('PUT', `/studio/projects/${pid}/plots/${plid}`, body)
export const deletePlot = (pid, plid) => request('DELETE', `/studio/projects/${pid}/plots/${plid}`)
