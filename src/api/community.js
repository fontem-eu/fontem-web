/**
 * Community API client — calls /capi/ endpoints for collaborative data stories,
 * issues, moderation, and user management.
 *
 * Session model (2026-06-13, see ./session.js):
 *
 * The access JWT is held in memory by the session store; the refresh
 * token rides in an httpOnly cookie. A 401 on a token-bearing request
 * triggers a silent /auth/refresh; if that succeeds we replay the
 * original request with the fresh access token. If refresh fails the
 * user is signed out and the caller sees the original 401 propagate.
 */

import { withLang } from './_lang.js'
import { getAccessToken, refresh, whenSessionReady } from './session.js'

function authHeaders() {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function request(method, path, body, { retries = 0, refreshed = false } = {}) {
  // Wait for the cold-boot session restore to settle before sending —
  // otherwise the first call on a freshly-loaded page can race ahead
  // of the cookie→token refresh and go out anonymous, which 404s any
  // private resource. No-op once settled (and on SSR).
  await whenSessionReady()
  const headers = { ...authHeaders(), 'Content-Type': 'application/json' }
  const sentAuth = 'Authorization' in headers
  const opts = { method, headers, credentials: 'include' }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`/capi${withLang(path)}`, opts)

  // 401 on a token-bearing request: try a silent refresh exactly once.
  // The session store dedupes concurrent refreshes so N parallel API
  // calls that all 401 produce a single /auth/refresh round trip.
  if (res.status === 401 && sentAuth && !refreshed) {
    const ok = await refresh()
    if (ok) {
      return request(method, path, body, { retries, refreshed: true })
    }
    // Refresh failed — the session store has already cleared local
    // state. Bounce to /login so the user can re-authenticate.
    if (typeof globalThis !== 'undefined' && globalThis.location) {
      globalThis.location.href = '/login'
    }
    throw new Error('Session expired')
  }

  // Retry on transient server errors (GET only)
  if (res.status >= 500 && method === 'GET' && retries < 2) {
    await new Promise((r) => setTimeout(r, 1000 * (retries + 1)))
    return request(method, path, body, { retries: retries + 1, refreshed })
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ── Reports ─────────────────────────────────────────────────────
export function createReport(title, abstract) {
  return request('POST', '/data-stories', { title, abstract })
}

export function getReport(id) {
  return request('GET', `/data-stories/${encodeURIComponent(id)}`)
}

export function listReports({ scope, limit, offset, tag } = {}) {
  const params = new URLSearchParams()
  if (scope) params.set('scope', scope)
  if (limit !== undefined) params.set('limit', String(limit))
  if (offset !== undefined) params.set('offset', String(offset))
  if (tag) params.set('tag', tag)
  const qs = params.toString()
  return request('GET', qs ? `/data-stories?${qs}` : '/data-stories')
}

export function updateReport(id, fields) {
  return request('PUT', `/data-stories/${encodeURIComponent(id)}`, fields)
}

export function deleteReport(id) {
  return request('DELETE', `/data-stories/${encodeURIComponent(id)}`)
}

// ── Tags ────────────────────────────────────────────────────────
//
// Story tags (PUT) is owner-only. The server normalises whatever
// free-text the client sends into slug form, dedupes, and rejects
// >3. The returned `tags` are the canonical slugs the server stored.

export function setStoryTags(id, tags) {
  return request('PUT', `/data-stories/${encodeURIComponent(id)}/tags`, { tags })
}

export function listAllTags() {
  return request('GET', '/tags')
}

export function listFollowedTags() {
  return request('GET', '/me/followed-tags')
}

export function followTag(tag) {
  return request('POST', '/me/followed-tags', { tag })
}

export function unfollowTag(tag) {
  return request('DELETE', `/me/followed-tags/${encodeURIComponent(tag)}`)
}

// ── Flowers (Medium-style clap) ─────────────────────────────────
// Two routes — GET returns the current {total, mine, max_per_user},
// POST adds one flower to the caller's count. Cap of 50 per user
// per story is enforced server-side; the UI also disables clicks
// past 50 so the cap reads as immediate.

export function getFlowers(id) {
  return request('GET', `/data-stories/${encodeURIComponent(id)}/flowers`)
}

export function giveFlower(id) {
  return request('POST', `/data-stories/${encodeURIComponent(id)}/flowers`)
}

// ── Sections ────────────────────────────────────────────────────
export function addSection(reportId, content) {
  return request('POST', `/data-stories/${encodeURIComponent(reportId)}/sections`, { content })
}

export function editSection(reportId, sectionId, content) {
  return request(
    'PUT',
    `/data-stories/${encodeURIComponent(reportId)}/sections/${encodeURIComponent(sectionId)}`,
    { content },
  )
}

export function deleteSection(reportId, sectionId) {
  return request(
    'DELETE',
    `/data-stories/${encodeURIComponent(reportId)}/sections/${encodeURIComponent(sectionId)}`,
  )
}

export function lockSection(reportId, sectionId) {
  return request(
    'POST',
    `/data-stories/${encodeURIComponent(reportId)}/sections/${encodeURIComponent(sectionId)}/lock`,
  )
}

export function unlockSection(reportId, sectionId) {
  return request(
    'DELETE',
    `/data-stories/${encodeURIComponent(reportId)}/sections/${encodeURIComponent(sectionId)}/lock`,
  )
}

export function getVersions(reportId, sectionId) {
  return request(
    'GET',
    `/data-stories/${encodeURIComponent(reportId)}/sections/${encodeURIComponent(sectionId)}/versions`,
  )
}

// ── Sharing ─────────────────────────────────────────────────────
export function getAccess(reportId) {
  return request('GET', `/data-stories/${encodeURIComponent(reportId)}/access`)
}

export function grantAccess(reportId, data) {
  return request('POST', `/data-stories/${encodeURIComponent(reportId)}/access`, data)
}

export function revokeAccess(reportId, accessId) {
  return request(
    'DELETE',
    `/data-stories/${encodeURIComponent(reportId)}/access/${encodeURIComponent(accessId)}`,
  )
}

// ── Issues ──────────────────────────────────────────────────────
export function createIssue(data) {
  return request('POST', '/issues', data)
}

export function listIssues(params) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return request('GET', `/issues${qs}`)
}

export function listActivity(params) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return request('GET', `/activity${qs}`)
}

export function getIssue(id) {
  return request('GET', `/issues/${encodeURIComponent(id)}`)
}

export function addComment(issueId, body) {
  return request('POST', `/issues/${encodeURIComponent(issueId)}/comments`, { body })
}

export function voteIssue(issueId, direction) {
  return request('POST', `/issues/${encodeURIComponent(issueId)}/vote`, { direction })
}

// ── Moderation ──────────────────────────────────────────────────
export function flagContent(data) {
  return request('POST', '/flags', data)
}

export function getModerationLog() {
  return request('GET', '/moderation/log')
}

// ── Users ───────────────────────────────────────────────────────
export function getCurrentUser() {
  return request('GET', '/users/me')
}

export function deleteCurrentUser() {
  return request('DELETE', '/users/me')
}

// ── AI Assist ──────────────────────────────────────────────────
// The assistant owns its own history and token accounting server-side.
// Frontend callers only send the current message + a context blob.

export function getAssistConversation(conversationKey) {
  return request('GET', `/assist/conversations/${encodeURIComponent(conversationKey)}`)
}

export function deleteAssistConversations() {
  return request('DELETE', '/assist/conversations')
}

export function getAssistUsage() {
  return request('GET', '/assist/usage')
}

export function getAssistUsageHistory(days = 30) {
  return request('GET', `/assist/usage-history?days=${days}`)
}

// ── v2 Document API ────────────────────────────────────────

export function saveDocument(reportId, tiptapJson) {
  return request('PUT', `/data-stories/${encodeURIComponent(reportId)}/content`, {
    tiptap: tiptapJson,
    version: 2,
  })
}

export async function uploadImage(reportId, file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/capi/data-stories/${encodeURIComponent(reportId)}/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  return res.json()
}

// ── Investigations ──────────────────────────────────────────────
// Aggregating workspaces (M2). Membership = capability flags; the list
// endpoint returns each investigation with the caller's `membership` so
// the UI can show their role.
export function listInvestigations() {
  return request('GET', '/investigations')
}
export function createInvestigation(name, description = '') {
  return request('POST', '/investigations', { name, description })
}
export function getInvestigation(id) {
  return request('GET', `/investigations/${encodeURIComponent(id)}`)
}
export function updateInvestigation(id, fields) {
  return request('PUT', `/investigations/${encodeURIComponent(id)}`, fields)
}
export function deleteInvestigation(id, content = 'orphan') {
  return request('DELETE', `/investigations/${encodeURIComponent(id)}?content=${content}`)
}
export function listInvestigationMembers(id) {
  return request('GET', `/investigations/${encodeURIComponent(id)}/members`)
}
export function addInvestigationMember(id, member) {
  // member: { email | user_id, role }
  return request('POST', `/investigations/${encodeURIComponent(id)}/members`, member)
}
export function updateInvestigationMember(id, uid, caps) {
  return request('PUT', `/investigations/${encodeURIComponent(id)}/members/${encodeURIComponent(uid)}`, caps)
}
export function removeInvestigationMember(id, uid) {
  return request('DELETE', `/investigations/${encodeURIComponent(id)}/members/${encodeURIComponent(uid)}`)
}

// ── Investigation ↔ story association (M4) ──────────────────────
export function listInvestigationStories(id) {
  return request('GET', `/investigations/${encodeURIComponent(id)}/stories`)
}
export function addInvestigationStory(id, reportId) {
  return request('POST', `/investigations/${encodeURIComponent(id)}/stories`, { report_id: reportId })
}
export function removeInvestigationStory(id, reportId) {
  return request('DELETE', `/investigations/${encodeURIComponent(id)}/stories/${encodeURIComponent(reportId)}`)
}

// ── Dossiers ────────────────────────────────────────────────────
// Thin tree-of-articles (M3). getDossier returns the dossier + its flat
// `articles` list ({id, title, parent_id}); the client assembles the tree.
export function listDossiers() {
  return request('GET', '/dossiers')
}
export function createDossier(name, investigationId = null) {
  return request('POST', '/dossiers', { name, investigation_id: investigationId })
}
export function getDossier(id) {
  return request('GET', `/dossiers/${encodeURIComponent(id)}`)
}
export function updateDossier(id, name) {
  return request('PUT', `/dossiers/${encodeURIComponent(id)}`, { name })
}
export function deleteDossier(id, content = 'orphan') {
  return request('DELETE', `/dossiers/${encodeURIComponent(id)}?content=${content}`)
}
export function addDossierArticle(id, reportId, parentId = null) {
  return request('POST', `/dossiers/${encodeURIComponent(id)}/articles`, { report_id: reportId, parent_id: parentId })
}
export function removeDossierArticle(id, reportId) {
  return request('DELETE', `/dossiers/${encodeURIComponent(id)}/articles/${encodeURIComponent(reportId)}`)
}

// ── Visualizations (server-side; the pocket's successor) (M5) ────
export function listVisualizations(investigationId = null) {
  const qs = investigationId ? `?investigation_id=${encodeURIComponent(investigationId)}` : ''
  return request('GET', `/visualizations${qs}`)
}
export function createVisualization(payload) {
  // payload: { name, widget_type, config, investigation_id? }
  return request('POST', '/visualizations', payload)
}
export function deleteVisualization(id) {
  return request('DELETE', `/visualizations/${encodeURIComponent(id)}`)
}
export function attachVisualization(id, investigationId) {
  return request('POST', `/visualizations/${encodeURIComponent(id)}/attach`, { investigation_id: investigationId })
}
export function detachVisualization(id) {
  return request('POST', `/visualizations/${encodeURIComponent(id)}/detach`)
}

// ── Dossier sharing + effective access (Phase C/D) ──────────────
export function dossierEffectiveAccess(id) {
  return request('GET', `/dossiers/${encodeURIComponent(id)}/effective-access`)
}
export function listDossierAccess(id) {
  return request('GET', `/dossiers/${encodeURIComponent(id)}/access`)
}
export function shareDossier(id, payload) {
  // payload: { email | user_id, level }
  return request('POST', `/dossiers/${encodeURIComponent(id)}/access`, payload)
}
export function revokeDossierAccess(id, uid) {
  return request('DELETE', `/dossiers/${encodeURIComponent(id)}/access/${encodeURIComponent(uid)}`)
}

// ── Article 'who has access & why' (Phase D parity) ─────────────
export function reportEffectiveAccess(id) {
  return request('GET', `/data-stories/${encodeURIComponent(id)}/effective-access`)
}
