import { describe, it, expect } from 'vitest'
import { tedNoticeUrl } from '../../src/utils/tedUrl.js'

// `tedNoticeUrl` now points at fontem-api's `/contracts/<id>/ted-link`
// redirect endpoint rather than building a TED URL directly. The
// redirect translates the eForms UUID we store in `ted_notice_id` into
// the publication-number TED's portal actually accepts. See
// src/utils/tedUrl.js for the full rationale.

describe('tedNoticeUrl', () => {
  it('returns the explicit ted_url when present (bypasses the redirect)', () => {
    expect(tedNoticeUrl({
      ted_url: 'https://ted.europa.eu/en/notice/-/detail/12345-2025',
      ted_notice_id: 'should-not-be-used',
    })).toBe('https://ted.europa.eu/en/notice/-/detail/12345-2025')
  })

  it('points at /api/contracts/<id>/ted-link when ted_url is missing', () => {
    expect(tedNoticeUrl({ ted_notice_id: '912f1717-1ace-413d-aa61-cd21cd6b95e7' }))
      .toBe('/api/contracts/912f1717-1ace-413d-aa61-cd21cd6b95e7/ted-link')
  })

  it('uses the redirect when ted_url is the empty string', () => {
    expect(tedNoticeUrl({ ted_url: '', ted_notice_id: 'abc-def' }))
      .toBe('/api/contracts/abc-def/ted-link')
  })

  it('treats whitespace-only ted_url as missing', () => {
    expect(tedNoticeUrl({ ted_url: '   ', ted_notice_id: 'abc' }))
      .toBe('/api/contracts/abc/ted-link')
  })

  it('url-encodes notice ids with awkward characters', () => {
    // Defensive — UUIDs shouldn't contain reserved chars, but the
    // ETL could in theory persist a publication-number string.
    expect(tedNoticeUrl({ ted_notice_id: '2025/OJS 123' }))
      .toBe('/api/contracts/2025%2FOJS%20123/ted-link')
  })

  it('returns null when both ted_url and ted_notice_id are missing', () => {
    expect(tedNoticeUrl({})).toBeNull()
    expect(tedNoticeUrl({ ted_url: '', ted_notice_id: '' })).toBeNull()
    expect(tedNoticeUrl({ ted_url: null, ted_notice_id: null })).toBeNull()
  })

  it('returns null when the input is null/undefined', () => {
    expect(tedNoticeUrl(null)).toBeNull()
    expect(tedNoticeUrl(undefined)).toBeNull()
  })
})
