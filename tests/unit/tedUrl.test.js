import { describe, it, expect } from 'vitest'
import { tedNoticeUrl } from '../../src/utils/tedUrl.js'

// `tedNoticeUrl` has three paths in priority order:
//   1. explicit `ted_url`           (rare; ETL almost never fills it)
//   2. `ted_publication_number`     (TED-assigned, persisted by ETL;
//                                    direct link, no backend hop)
//   3. `ted_notice_id` (UUID)       → fontem-api's `/api/contracts/<id>/ted-link`
//                                    redirector, which calls TED's v3 search
//                                    to translate UUID → pub-num at request time.
// See src/utils/tedUrl.js for the full rationale.

describe('tedNoticeUrl', () => {
  it('returns the explicit ted_url when present (bypasses everything else)', () => {
    expect(tedNoticeUrl({
      ted_url: 'https://ted.europa.eu/en/notice/-/detail/12345-2025',
      ted_publication_number: 'should-not-be-used',
      ted_notice_id: 'should-not-be-used-either',
    })).toBe('https://ted.europa.eu/en/notice/-/detail/12345-2025')
  })

  it('uses ted_publication_number when present — direct TED link, no backend hop', () => {
    expect(tedNoticeUrl({
      ted_publication_number: '295342-2026',
      ted_notice_id: '912f1717-1ace-413d-aa61-cd21cd6b95e7',
    })).toBe('https://ted.europa.eu/en/notice/-/detail/295342-2026')
  })

  it('prefers ted_publication_number over ted_notice_id when both are present', () => {
    // Critical correctness: the redirector path is for contracts that
    // don't have the pub-num stored yet. Once the ETL captures it (or
    // the backfill lands), every click should skip the round-trip.
    expect(tedNoticeUrl({
      ted_publication_number: '295342-2026',
      ted_notice_id: '912f1717-1ace-413d-aa61-cd21cd6b95e7',
    })).toContain('/notice/-/detail/295342-2026')
  })

  it('falls back to the /api/contracts/<id>/ted-link redirector when no pub-num', () => {
    expect(tedNoticeUrl({ ted_notice_id: '912f1717-1ace-413d-aa61-cd21cd6b95e7' }))
      .toBe('/api/contracts/912f1717-1ace-413d-aa61-cd21cd6b95e7/ted-link')
  })

  it('treats whitespace-only ted_publication_number as missing', () => {
    // Defensive — backfill or ETL bug could write '   ' instead of
    // leaving the property unset. Same trim guard as for ted_url.
    expect(tedNoticeUrl({
      ted_publication_number: '   ',
      ted_notice_id: 'abc',
    })).toBe('/api/contracts/abc/ted-link')
  })

  it('treats null ted_publication_number as missing', () => {
    expect(tedNoticeUrl({
      ted_publication_number: null,
      ted_notice_id: 'abc',
    })).toBe('/api/contracts/abc/ted-link')
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
    // Defensive — UUIDs shouldn't contain reserved chars, but a
    // stored publication-number might have slashes/spaces.
    expect(tedNoticeUrl({ ted_notice_id: '2025/OJS 123' }))
      .toBe('/api/contracts/2025%2FOJS%20123/ted-link')
  })

  it('url-encodes pub-num strings with reserved characters', () => {
    expect(tedNoticeUrl({ ted_publication_number: '295342 2026/X' }))
      .toBe('https://ted.europa.eu/en/notice/-/detail/295342%202026%2FX')
  })

  it('returns null when all three identifiers are missing', () => {
    expect(tedNoticeUrl({})).toBeNull()
    expect(tedNoticeUrl({ ted_url: '', ted_publication_number: '', ted_notice_id: '' })).toBeNull()
    expect(tedNoticeUrl({ ted_url: null, ted_publication_number: null, ted_notice_id: null })).toBeNull()
  })

  it('returns null when the input is null/undefined', () => {
    expect(tedNoticeUrl(null)).toBeNull()
    expect(tedNoticeUrl(undefined)).toBeNull()
  })
})
