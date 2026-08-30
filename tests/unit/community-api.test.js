import { _internal } from '../../src/api/session.js'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createReport, getReport, listReports, updateReport, deleteReport,
  getAccess, grantAccess, revokeAccess,
  createIssue, listIssues, getIssue, addComment, voteIssue,
  flagContent, getModerationLog, getCurrentUser,
} from '../../src/api/community.js'

function mockFetch(status, body) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  })
}

describe('community API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    _internal.clearForTests(); localStorage.clear()
  })

  // ── Auth header ──────────────────────────────────────────────

  it('sends Authorization header when gmr-token exists', async () => {
    _internal.setAccessToken('abc123')
    vi.stubGlobal('fetch', mockFetch(200, []))

    await listReports()

    const [, opts] = fetch.mock.calls[0]
    expect(opts.headers.Authorization).toBe('Bearer abc123')
  })

  it('omits Authorization header when no token is stored', async () => {
    vi.stubGlobal('fetch', mockFetch(200, []))

    await listReports()

    const [, opts] = fetch.mock.calls[0]
    expect(opts.headers.Authorization).toBeUndefined()
  })

  it('always sends Content-Type application/json', async () => {
    vi.stubGlobal('fetch', mockFetch(200, {}))

    await listReports()

    const [, opts] = fetch.mock.calls[0]
    expect(opts.headers['Content-Type']).toBe('application/json')
  })

  // ── Error handling ───────────────────────────────────────────

  it('throws on non-OK response with status and body', async () => {
    vi.stubGlobal('fetch', mockFetch(403, 'Forbidden'))

    await expect(listReports()).rejects.toThrow('HTTP 403')
  })

  it('returns null for 204 No Content responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      text: () => Promise.resolve(''),
    }))

    const result = await deleteReport('r1')
    expect(result).toBeNull()
  })

  // ── Reports ──────────────────────────────────────────────────

  it('createReport sends POST to /capi/data-stories', async () => {
    vi.stubGlobal('fetch', mockFetch(201, { id: 'r1' }))

    const result = await createReport('Title', 'Abstract')

    expect(fetch).toHaveBeenCalledWith('/capi/data-stories', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ title: 'Title', abstract: 'Abstract' }),
    }))
    expect(result).toEqual({ id: 'r1' })
  })

  it('getReport sends GET to /capi/data-stories/:id', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { id: 'r1', title: 'Test' }))

    await getReport('r1')

    expect(fetch).toHaveBeenCalledWith('/capi/data-stories/r1', expect.objectContaining({ method: 'GET' }))
  })

  it('listReports sends GET to /capi/data-stories', async () => {
    vi.stubGlobal('fetch', mockFetch(200, []))

    await listReports()

    expect(fetch).toHaveBeenCalledWith('/capi/data-stories', expect.objectContaining({ method: 'GET' }))
  })

  it('updateReport sends PUT with fields', async () => {
    vi.stubGlobal('fetch', mockFetch(200, {}))

    await updateReport('r1', { title: 'New Title' })

    expect(fetch).toHaveBeenCalledWith('/capi/data-stories/r1', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ title: 'New Title' }),
    }))
  })

  it('deleteReport sends DELETE to /capi/data-stories/:id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204, text: () => Promise.resolve('') }))

    await deleteReport('r1')

    expect(fetch).toHaveBeenCalledWith('/capi/data-stories/r1', expect.objectContaining({ method: 'DELETE' }))
  })

  // ── Sections ─────────────────────────────────────────────────






  // ── Issues ───────────────────────────────────────────────────

  it('listIssues appends query params when provided', async () => {
    vi.stubGlobal('fetch', mockFetch(200, []))

    await listIssues({ status: 'open', page: '2' })

    const [url] = fetch.mock.calls[0]
    expect(url).toContain('/capi/issues?')
    expect(url).toContain('status=open')
    expect(url).toContain('page=2')
  })

  it('listIssues sends no query string when params are omitted', async () => {
    vi.stubGlobal('fetch', mockFetch(200, []))

    await listIssues()

    expect(fetch).toHaveBeenCalledWith('/capi/issues', expect.anything())
  })

  it('voteIssue sends POST with direction', async () => {
    vi.stubGlobal('fetch', mockFetch(200, {}))

    await voteIssue('i1', 'up')

    expect(fetch).toHaveBeenCalledWith('/capi/issues/i1/vote', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ direction: 'up' }),
    }))
  })

  // ── Moderation & Users ───────────────────────────────────────

  it('getCurrentUser sends GET to /capi/users/me', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { id: 'u1', name: 'Test' }))

    const result = await getCurrentUser()

    expect(fetch).toHaveBeenCalledWith('/capi/users/me', expect.objectContaining({ method: 'GET' }))
    expect(result.name).toBe('Test')
  })


  // ── Sharing ──────────────────────────────────────────────────

  it('getAccess sends GET to /capi/data-stories/:id/access', async () => {
    vi.stubGlobal('fetch', mockFetch(200, []))

    await getAccess('r1')

    expect(fetch).toHaveBeenCalledWith('/capi/data-stories/r1/access', expect.objectContaining({ method: 'GET' }))
  })

  it('grantAccess sends POST with data', async () => {
    vi.stubGlobal('fetch', mockFetch(201, {}))

    await grantAccess('r1', { user_id: 'u1', role: 'editor' })

    expect(fetch).toHaveBeenCalledWith('/capi/data-stories/r1/access', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ user_id: 'u1', role: 'editor' }),
    }))
  })

  it('revokeAccess sends DELETE to /capi/data-stories/:id/access/:accessId', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204, text: () => Promise.resolve('') }))

    await revokeAccess('r1', 'a1')

    expect(fetch).toHaveBeenCalledWith('/capi/data-stories/r1/access/a1', expect.objectContaining({ method: 'DELETE' }))
  })

  // ── Issues (additional) ──────────────────────────────────────

  it('createIssue sends POST to /capi/issues', async () => {
    vi.stubGlobal('fetch', mockFetch(201, { id: 'i1' }))

    await createIssue({ title: 'Bug', body: 'Broken' })

    expect(fetch).toHaveBeenCalledWith('/capi/issues', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ title: 'Bug', body: 'Broken' }),
    }))
  })

  it('getIssue sends GET to /capi/issues/:id', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { id: 'i1' }))

    await getIssue('i1')

    expect(fetch).toHaveBeenCalledWith('/capi/issues/i1', expect.objectContaining({ method: 'GET' }))
  })

  it('addComment sends POST with body', async () => {
    vi.stubGlobal('fetch', mockFetch(201, {}))

    await addComment('i1', 'Nice work')

    expect(fetch).toHaveBeenCalledWith('/capi/issues/i1/comments', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ body: 'Nice work' }),
    }))
  })

  // ── Moderation ───────────────────────────────────────────────

  it('flagContent sends POST to /capi/flags', async () => {
    vi.stubGlobal('fetch', mockFetch(201, {}))

    await flagContent({ target_type: 'comment', target_id: 'c1', reason: 'spam' })

    expect(fetch).toHaveBeenCalledWith('/capi/flags', expect.objectContaining({
      method: 'POST',
    }))
  })

  it('getModerationLog sends GET to /capi/moderation/log', async () => {
    vi.stubGlobal('fetch', mockFetch(200, []))

    await getModerationLog()

    expect(fetch).toHaveBeenCalledWith('/capi/moderation/log', expect.objectContaining({ method: 'GET' }))
  })

  it('encodes special characters in path parameters', async () => {
    vi.stubGlobal('fetch', mockFetch(200, {}))

    await getReport('a/b')

    expect(fetch).toHaveBeenCalledWith('/capi/data-stories/a%2Fb', expect.anything())
  })
})
