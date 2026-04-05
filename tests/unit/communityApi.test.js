import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
    localStorage.clear()
  })

  function mockOk(data, status = 200) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    })
  }

  function mockError(status, detail = 'error') {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status,
      json: () => Promise.resolve({ detail }),
      text: () => Promise.resolve(detail),
    })
  }

  it('listReports calls GET /capi/reports', async () => {
    mockOk({ reports: [] })
    await communityApi.listReports()
    expect(fetchMock).toHaveBeenCalledWith('/capi/reports', expect.objectContaining({ method: 'GET' }))
  })

  it('createReport calls POST /capi/reports with body', async () => {
    mockOk({ id: '123', title: 'Test' })
    await communityApi.createReport('Test', 'Abstract')
    expect(fetchMock).toHaveBeenCalledWith('/capi/reports', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ title: 'Test', abstract: 'Abstract' }),
    }))
  })

  it('getReport calls GET /capi/reports/:id', async () => {
    mockOk({ id: '123', title: 'Test' })
    await communityApi.getReport('123')
    expect(fetchMock).toHaveBeenCalledWith('/capi/reports/123', expect.objectContaining({ method: 'GET' }))
  })

  it('deleteReport calls DELETE /capi/reports/:id', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.resolve(null) })
    await communityApi.deleteReport('123')
    expect(fetchMock).toHaveBeenCalledWith('/capi/reports/123', expect.objectContaining({ method: 'DELETE' }))
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
    localStorage.setItem('gmr-token', 'test-jwt')
    mockOk({})
    await communityApi.listReports()
    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers.Authorization).toBe('Bearer test-jwt')
  })

  it('throws on HTTP error', async () => {
    mockError(500, 'Internal error')
    await expect(communityApi.listReports()).rejects.toThrow('HTTP 500')
  })

  it('encodes URI components for IDs with special chars', async () => {
    mockOk({ id: '123' })
    await communityApi.getReport('a/b')
    expect(fetchMock).toHaveBeenCalledWith('/capi/reports/a%2Fb', expect.any(Object))
  })
})
