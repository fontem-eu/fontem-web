import { _internal } from '../../src/api/session.js'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// In single-fork vitest mode (poolOptions.forks.singleFork=true), the
// module graph is shared across files. If another test file ran first
// and called vi.mock('../../src/api/community.js', () => ({...})), our
// dynamic-import below gets that mocked partial module instead of the
// real one. Explicit unmock pins the real module for this file.
vi.unmock('../../src/api/community.js')

// We need to test the community API client. It uses fetch internally.
// Import after mocking fetch.
let communityApi

describe('Community API client', () => {
  let fetchMock

  beforeEach(async () => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    // Dynamic import to get fresh module
    communityApi = await import('../../src/api/community.js')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    _internal.clearForTests(); localStorage.clear()
  })

  function mockOk(data, status = 200) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    })
  }

  it('listReports calls GET /capi/data-stories', async () => {
    mockOk({ reports: [] })
    await communityApi.listReports()
    expect(fetchMock).toHaveBeenCalledWith('/capi/data-stories', expect.objectContaining({ method: 'GET' }))
  })

  it('createReport calls POST /capi/data-stories with body', async () => {
    mockOk({ id: '123', title: 'Test' })
    await communityApi.createReport('Test', 'Abstract')
    expect(fetchMock).toHaveBeenCalledWith('/capi/data-stories', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ title: 'Test', abstract: 'Abstract' }),
    }))
  })

  it('getReport calls GET /capi/data-stories/:id', async () => {
    mockOk({ id: '123', title: 'Test' })
    await communityApi.getReport('123')
    expect(fetchMock).toHaveBeenCalledWith('/capi/data-stories/123', expect.objectContaining({ method: 'GET' }))
  })

  it('deleteReport calls DELETE /capi/data-stories/:id', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.resolve(null) })
    await communityApi.deleteReport('123')
    expect(fetchMock).toHaveBeenCalledWith('/capi/data-stories/123', expect.objectContaining({ method: 'DELETE' }))
  })

  it('listIssues calls GET /capi/issues', async () => {
    mockOk({ issues: [] })
    await communityApi.listIssues()
    expect(fetchMock).toHaveBeenCalledWith('/capi/issues', expect.objectContaining({ method: 'GET' }))
  })

  it('createIssue calls POST /capi/issues', async () => {
    mockOk({ id: '1' })
    await communityApi.createIssue({ title: 'Bug', body: 'Details' })
    expect(fetchMock).toHaveBeenCalledWith('/capi/issues', expect.objectContaining({ method: 'POST' }))
  })

  it('addComment calls POST /capi/issues/:id/comments', async () => {
    mockOk({ id: 'c1' })
    await communityApi.addComment('issue-1', 'My comment')
    expect(fetchMock).toHaveBeenCalledWith('/capi/issues/issue-1/comments', expect.objectContaining({ method: 'POST' }))
  })

  it('getCurrentUser calls GET /capi/users/me', async () => {
    mockOk({ id: 'u1', name: 'Test' })
    await communityApi.getCurrentUser()
    expect(fetchMock).toHaveBeenCalledWith('/capi/users/me', expect.objectContaining({ method: 'GET' }))
  })

  it('sends auth header when token exists', async () => {
    _internal.setAccessToken('test-jwt')
    mockOk({})
    await communityApi.listReports()
    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers.Authorization).toBe('Bearer test-jwt')
  })

  it('throws on HTTP error after retries', async () => {
    vi.useFakeTimers()
    // Return 500 persistently so retries also fail
    fetchMock.mockResolvedValue({
      ok: false, status: 500,
      text: () => Promise.resolve('Internal error'),
    })
    const p = communityApi.listReports()
    // Attach the rejection handler synchronously, before the timer
    // advance lets the retry chain settle. Without this the promise
    // rejects in a microtask before `await expect(p).rejects` is
    // wired up, and vitest flags it as an unhandled rejection that
    // fails the suite — even though the assertion itself passes.
    const assertion = expect(p).rejects.toThrow('HTTP 500')
    // Advance past retry delays (1s + 2s)
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(3000)
    }
    await assertion
    vi.useRealTimers()
  })

  it('encodes URI components for IDs with special chars', async () => {
    mockOk({ id: '123' })
    await communityApi.getReport('a/b')
    expect(fetchMock).toHaveBeenCalledWith('/capi/data-stories/a%2Fb', expect.any(Object))
  })
})
