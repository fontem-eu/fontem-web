/**
 * Community API client — calls /capi/ endpoints for collaborative reports,
 * issues, moderation, and user management.
 */

function authHeaders() {
  const token = localStorage.getItem('gmr-token')
  if (!token) return {}

  // Check JWT expiry client-side to avoid sending stale tokens
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('gmr-token')
      localStorage.removeItem('gmr-user')
      window.location.href = '/login'
      return {}
    }
  } catch { /* malformed token — let the server reject it */ }

  return { Authorization: `Bearer ${token}` }
}

async function request(method, path, body, { retries = 0 } = {}) {
  const opts = {
    method,
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`/capi${path}`, opts)

  // Auto-redirect on auth failure
  if (res.status === 401) {
    localStorage.removeItem('gmr-token')
    localStorage.removeItem('gmr-user')
    window.location.href = '/login'
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
  return request('POST', '/reports', { title, abstract })
}

export function getReport(id) {
  return request('GET', `/reports/${encodeURIComponent(id)}`)
}

export function listReports({ scope, limit, offset } = {}) {
  const params = new URLSearchParams()
  if (scope) params.set('scope', scope)
  if (limit !== undefined) params.set('limit', String(limit))
  if (offset !== undefined) params.set('offset', String(offset))
  const qs = params.toString()
  return request('GET', qs ? `/reports?${qs}` : '/reports')
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
  return request('PUT', `/reports/${encodeURIComponent(reportId)}/content`, {
    tiptap: tiptapJson,
    version: 2,
  })
}

export async function uploadImage(reportId, file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/capi/reports/${encodeURIComponent(reportId)}/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  return res.json()
}
