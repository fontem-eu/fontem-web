import { describe, it, expect } from 'vitest'
import { tedNoticeUrl } from '../../src/utils/tedUrl.js'

describe('tedNoticeUrl', () => {
  it('returns the explicit ted_url when present', () => {
    expect(tedNoticeUrl({
      ted_url: 'https://ted.europa.eu/en/notice/-/detail/12345-2025',
      ted_notice_id: 'should-not-be-used',
    })).toBe('https://ted.europa.eu/en/notice/-/detail/12345-2025')
  })

  it('builds a TED detail URL from the notice id when ted_url is missing', () => {
    expect(tedNoticeUrl({ ted_notice_id: '2025-OJS123-456789' }))
      .toBe('https://ted.europa.eu/en/notice/-/detail/2025-OJS123-456789')
  })

  it('builds a TED detail URL when ted_url is the empty string', () => {
    expect(tedNoticeUrl({ ted_url: '', ted_notice_id: '456789-2025' }))
      .toBe('https://ted.europa.eu/en/notice/-/detail/456789-2025')
  })

  it('treats whitespace-only ted_url as missing', () => {
    expect(tedNoticeUrl({ ted_url: '   ', ted_notice_id: '12345-2026' }))
      .toBe('https://ted.europa.eu/en/notice/-/detail/12345-2026')
  })

  it('url-encodes notice ids with awkward characters', () => {
    expect(tedNoticeUrl({ ted_notice_id: '2025/OJS 123' }))
      .toBe('https://ted.europa.eu/en/notice/-/detail/2025%2FOJS%20123')
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
