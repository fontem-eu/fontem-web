/**
 * Community API client — calls /capi/ endpoints for collaborative data stories,
 * issues, moderation, and user management.
 */

import { withLang } from './_lang.js'

function authHeaders() {
  // localStorage + window don't exist during SSR; no auth from the
  // server — anonymous requests happen via the same code path.
  if (typeof localStorage === 'undefined') return {}
  const token = localStorage.getItem('gmr-token')
  if (!token) return {}

  // Check JWT expiry client-side to avoid sending stale tokens
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('gmr-token')
      localStorage.removeItem('gmr-user')
      globalThis.location.href = '/login'
      return {}
    }
  } catch { /* malformed token — let the server reject it */ }

  return { Authorization: `Bearer ${token}` }
}

async function request(method, path, body, { retries = 0 } = {}) {
  const headers = { ...authHeaders(), 'Content-Type': 'application/json' }
  // Did we actually send a token on this request?  Needed below to tell
  // "session expired" apart from "anonymous call to a token-optional
  // endpoint that happened to 401" — we should only punt the user to
  // /login in the first case.
  const sentAuth = 'Authorization' in headers
  const opts = { method, headers }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`/capi${withLang(path)}`, opts)

  // Auto-redirect only when a stale token triggered the 401. Anonymous
  // callers (no token) should surface the error so the calling view can
  // render the right state (e.g. a 404 page for private data stories they
  // tried to open via direct link).
  if (res.status === 401 && sentAuth) {
    localStorage.removeItem('gmr-token')
    localStorage.removeItem('gmr-user')
    globalThis.location.href = '/login'
    throw new Error('Session expired')
  }

  // Retry on transient server errors (GET only)
  if (res.status >= 500 && method === 'GET' && retries < 2) {
    await new Promise((r) => setTimeout(r, 1000 * (retries + 1)))
    return request(method, path, body, { retries: retries + 1 })
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
