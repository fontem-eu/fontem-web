/**
 * Community API client — calls /capi/ endpoints for collaborative reports,
 * issues, moderation, and user management.
 */

function authHeaders() {
  const token = localStorage.getItem('gmr-token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(method, path, body) {
  const opts = {
    method,
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`/capi${path}`, opts)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ── Reports ─────────────────────────────────────────────────────
export function createReport(title, abstract) {
  return request('POST', '/reports', { title, abstract })
}

export function getReport(id) {
  return request('GET', `/reports/${encodeURIComponent(id)}`)
}

export function listReports() {
  return request('GET', '/reports')
}

export function updateReport(id, fields) {
  return request('PUT', `/reports/${encodeURIComponent(id)}`, fields)
}

export function deleteReport(id) {
  return request('DELETE', `/reports/${encodeURIComponent(id)}`)
}

// ── Sections ────────────────────────────────────────────────────
export function addSection(reportId, content) {
  return request('POST', `/reports/${encodeURIComponent(reportId)}/sections`, { content })
}

export function editSection(reportId, sectionId, content) {
  return request(
    'PUT',
    `/reports/${encodeURIComponent(reportId)}/sections/${encodeURIComponent(sectionId)}`,
    { content },
  )
}

export function deleteSection(reportId, sectionId) {
  return request(
    'DELETE',
    `/reports/${encodeURIComponent(reportId)}/sections/${encodeURIComponent(sectionId)}`,
  )
}

export function lockSection(reportId, sectionId) {
  return request(
    'POST',
    `/reports/${encodeURIComponent(reportId)}/sections/${encodeURIComponent(sectionId)}/lock`,
  )
}

export function unlockSection(reportId, sectionId) {
  return request(
    'DELETE',
    `/reports/${encodeURIComponent(reportId)}/sections/${encodeURIComponent(sectionId)}/lock`,
  )
}

export function getVersions(reportId, sectionId) {
  return request(
    'GET',
    `/reports/${encodeURIComponent(reportId)}/sections/${encodeURIComponent(sectionId)}/versions`,
  )
}

// ── Sharing ─────────────────────────────────────────────────────
export function getAccess(reportId) {
  return request('GET', `/reports/${encodeURIComponent(reportId)}/access`)
}

export function grantAccess(reportId, data) {
  return request('POST', `/reports/${encodeURIComponent(reportId)}/access`, data)
}

export function revokeAccess(reportId, accessId) {
  return request(
    'DELETE',
    `/reports/${encodeURIComponent(reportId)}/access/${encodeURIComponent(accessId)}`,
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

// ── AI Assist ──────────────────────────────────────────────────
// The assistant owns its own history and token accounting server-side.
// Frontend callers only send the current message + a context blob.

export function getAssistConversation(conversationKey) {
  return request('GET', `/assist/conversations/${encodeURIComponent(conversationKey)}`)
}

export function getAssistUsage() {
  return request('GET', '/assist/usage')
}
