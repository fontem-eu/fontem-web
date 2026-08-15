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
import { RETRYABLE, MAX_ATTEMPTS, backoffMs, retryAfterMs } from './retry.js'


function authHeaders() {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Build fetch() init for a request. FormData (file uploads) must not be
// JSON-stringified, and the browser has to set its own multipart
// Content-Type (with the boundary), so we only set JSON otherwise.
function buildRequestInit(method, body) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  const headers = { ...authHeaders() }
  if (!isForm) headers['Content-Type'] = 'application/json'
  const opts = { method, headers, credentials: 'include' }
  if (body !== undefined) opts.body = isForm ? body : JSON.stringify(body)
  return { opts, sentAuth: 'Authorization' in headers }
}

export async function request(method, path, body, { retries = 0, refreshed = false } = {}) {
  // Wait for the cold-boot session restore to settle before sending —
  // otherwise the first call on a freshly-loaded page can race ahead
  // of the cookie→token refresh and go out anonymous, which 404s any
  // private resource. No-op once settled (and on SSR).
  await whenSessionReady()
  const { opts, sentAuth } = buildRequestInit(method, body)
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

  // Retry the statuses that mean "not now" rather than "no".
  //
  // 429 was missing here, which is backwards: a 500 may be permanent, a
  // rate limit almost never is, and the server usually says when to come
  // back. One unretried 429 is what left TRANS-01 showing an English title
  // under a Portuguese picker — see src/api/retry.js.
  //
  // GET only. A retried POST can create a second story, and no rate limit
  // is worth that.
  if (RETRYABLE.has(res.status) && method === 'GET' && retries < MAX_ATTEMPTS - 1) {
    const wait = retryAfterMs(res.headers?.get?.('retry-after')) ?? backoffMs(retries)
    if (typeof console !== 'undefined') {
      // Deliberately visible. Every one of these failures was invisible
      // until someone read a test log: a silent retry that then fails is
      // indistinguishable from a request nobody made.
      console.warn(
        `[api] ${method} ${path} -> ${res.status}; retrying in ${wait}ms `
        + `(attempt ${retries + 2}/${MAX_ATTEMPTS})`)
    }
    await new Promise((r) => setTimeout(r, wait))
    return request(method, path, body, { retries: retries + 1, refreshed })
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`HTTP ${res.status}: ${text}`)
    // The status, reachable without parsing the message. Callers that want
    // to say "we were rate limited" rather than "something went wrong"
    // could not tell before.
    err.status = res.status
    err.method = method
    err.path = path
    throw err
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

// ── User profiles ───────────────────────────────────────────────
// A public author profile: identity + summary/links + the user's public
// articles + recent activity. Readable anonymously.
export function getUserProfile(userId) {
  return request('GET', `/users/${encodeURIComponent(userId)}/profile`)
}

// Update the signed-in user's own profile extras (summary + links, and
// optionally the avatar focal point avatar_x/avatar_y as percentages).
export function updateMyProfile({
  summary, links, avatar_x, avatar_y,
  name, show_email, use_custom_email, custom_email, home_nuts,
}) {
  const body = { summary, links }
  if (avatar_x !== undefined) body.avatar_x = avatar_x
  if (avatar_y !== undefined) body.avatar_y = avatar_y
  if (name !== undefined) body.name = name
  if (show_email !== undefined) body.show_email = show_email
  if (use_custom_email !== undefined) body.use_custom_email = use_custom_email
  if (custom_email !== undefined) body.custom_email = custom_email
  if (home_nuts !== undefined) body.home_nuts = home_nuts
  return request('PUT', '/users/me/profile', body)
}

// Upload the signed-in user's avatar image (multipart). Returns { avatar_url }.
export function uploadAvatar(file) {
  const form = new FormData()
  form.append('file', file)
  return request('POST', '/users/me/avatar', form)
}

// ── Translations ────────────────────────────────────────────────
//
// A story has one original (title/abstract/document in `language`)
// and per-language translations. Saving a translation pins it to the
// original's current content_version; edits to the original flip
// `outdated` on every translation until re-saved or resolved.

export function listTranslations(id) {
  return request('GET', `/data-stories/${encodeURIComponent(id)}/translations`)
}

export function getTranslation(id, lang) {
  return request('GET', `/data-stories/${encodeURIComponent(id)}/translations/${encodeURIComponent(lang)}`)
}

export function saveTranslation(id, lang, { title, abstract, tiptap }) {
  return request('PUT', `/data-stories/${encodeURIComponent(id)}/translations/${encodeURIComponent(lang)}`, {
    title, abstract, tiptap, version: 2,
  })
}

export function resolveTranslation(id, lang) {
  return request('POST', `/data-stories/${encodeURIComponent(id)}/translations/${encodeURIComponent(lang)}/resolve`)
}

export function deleteTranslation(id, lang) {
  return request('DELETE', `/data-stories/${encodeURIComponent(id)}/translations/${encodeURIComponent(lang)}`)
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

/**
 * What led the agent to take an action: the prompt, the tool calls it made,
 * and the answer it gave. Keyed by the tool call an activity entry names.
 *
 * 404 covers both "no such call" and "not yours" — the server does not
 * distinguish them, because saying which ids exist is what an enumeration
 * attack needs.
 */
export function getAgentContext(messageId) {
  return request('GET', `/assist/provenance/${encodeURIComponent(messageId)}`)
}

export function deleteAssistConversations() {
  return request('DELETE', '/assist/conversations')
}

export function getAssistUsage() {
  return request('GET', '/assist/usage')
}

// ── Provider credentials ──────────────────────────────────────
// Write-only by design: putProviderCredential sends a key and nothing
// ever reads one back. listProviderCredentials returns which providers
// are configured plus a fingerprint, never key material.

// Which built-in models are on offer, and which one this user picked.
// Ids are curated server-side; the browser never names a model file.
export function listAssistantModels() {
  return request('GET', '/assist/models')
}

export function chooseAssistantModel(modelId) {
  return request('PUT', '/assist/models', { model_id: modelId })
}

export function listProviderCredentials() {
  return request('GET', '/assist/credentials')
}

export function putProviderCredential({ provider, apiKey, model }) {
  return request('PUT', '/assist/credentials', {
    provider, api_key: apiKey, model: model || null,
  })
}

export function deleteProviderCredential(provider) {
  return request('DELETE', `/assist/credentials/${encodeURIComponent(provider)}`)
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

// ── MCP access tokens ─────────────────────────────────────────
// What a user pastes into their own LLM client. The plaintext comes back
// exactly once, from createMcpToken; nothing reads one afterwards.

export function listMcpTokens() {
  return request('GET', '/assist/mcp-tokens')
}

export function createMcpToken(label) {
  return request('POST', '/assist/mcp-tokens', { label: label || '' })
}

export function revokeMcpToken(id) {
  return request('DELETE', `/assist/mcp-tokens/${encodeURIComponent(id)}`)
}

// ── Feed-query catalogue (admin) ──────────────────────────────
// Named queries are editorially-curated queries against the platform's
// stores; query groups are ordered sets of them, and a query can belong to
// several. Everything here except listPublicQueryGroups is admin-only —
// the server gates it, these helpers just call the endpoints.

export function listNamedQueries(status) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  return request('GET', `/admin/named-queries${qs}`)
}

export function getNamedQuery(id) {
  return request('GET', `/admin/named-queries/${encodeURIComponent(id)}`)
}

export function createNamedQuery(fields) {
  return request('POST', '/admin/named-queries', fields)
}

export function updateNamedQuery(id, fields) {
  return request('PATCH', `/admin/named-queries/${encodeURIComponent(id)}`, fields)
}

export function deleteNamedQuery(id) {
  return request('DELETE', `/admin/named-queries/${encodeURIComponent(id)}`)
}

// Runs the saved query and STORES the verdict. Use previewNamedQuery for
// unsaved work — this one changes the catalogue.
export function validateNamedQuery(id) {
  return request('POST', `/admin/named-queries/${encodeURIComponent(id)}/validate`)
}

// Runs an unsaved draft: rows plus the same contract verdict, stored nowhere.
export function previewNamedQuery({ lang, query, params, waivers }) {
  return request('POST', '/admin/named-queries/preview', {
    lang, query, params: params || {}, waivers: waivers || {},
  })
}

export function listQueryGroups() {
  return request('GET', '/admin/query-groups')
}

export function createQueryGroup(fields) {
  return request('POST', '/admin/query-groups', fields)
}

export function updateQueryGroup(id, fields) {
  return request('PATCH', `/admin/query-groups/${encodeURIComponent(id)}`, fields)
}

export function deleteQueryGroup(id) {
  return request('DELETE', `/admin/query-groups/${encodeURIComponent(id)}`)
}

// Replaces the whole membership, in the order given — the UI edits an
// ordered list, and expressing a positional edit as a diff is where
// ordering bugs live.
export function setQueryGroupQueries(id, queryIds) {
  return request('PUT', `/admin/query-groups/${encodeURIComponent(id)}/queries`,
    { query_ids: queryIds })
}

// Anonymous: published queries in public groups. What the feed picker reads.
export function listPublicQueryGroups() {
  return request('GET', '/query-groups')
}
