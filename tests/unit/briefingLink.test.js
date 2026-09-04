/**
 * The shapes here are the ones prod actually serves — checked against
 * /capi/briefings/public-investment and /capi/briefings/corporate-influence
 * rather than invented, because the interesting cases (a baked prod
 * origin, a coalesce-to-empty id) are exactly the ones nobody would
 * think to make up.
 */
import { describe, it, expect } from 'vitest'
import { briefingLink } from '../../src/utils/briefingLink.js'

describe('briefingLink', () => {
  it('reduces a same-site link to a router path', () => {
    // Real row from the public-contracts query.
    expect(briefingLink({
      link: 'https://fontem.eu/contract/c818c705-1752-4cb9-854c-c8d5b00f5f81',
    })).toEqual({
      kind: 'internal',
      to: '/contract/c818c705-1752-4cb9-854c-c8d5b00f5f81',
    })
  })

  it('does not send a reader to production from another environment', () => {
    // The query bakes https://fontem.eu into the row, so staging serves
    // prod links. Following one as an href leaves the environment.
    const { kind, to } = briefingLink({
      link: 'https://fontem.eu/company/861a7137-54a8-54ba-b16a-7804a5a7e4cd',
    })
    expect(kind).toBe('internal')
    expect(to.startsWith('/')).toBe(true)
    expect(to).not.toContain('fontem.eu')
  })

  it('treats the canonical dargle.eu host as internal', () => {
    expect(briefingLink({ link: 'https://dargle.eu/contract/abc123' }))
      .toEqual({ kind: 'internal', to: '/contract/abc123' })
  })

  it('still treats the pre-rename fontem.eu host as internal', () => {
    // The links are built inside stored named queries in the database,
    // which the rename did not touch — so every row served today still
    // carries the old origin. Treating it as external would send every
    // briefing card off-site.
    expect(briefingLink({ link: 'https://fontem.eu/contract/abc123' }))
      .toEqual({ kind: 'internal', to: '/contract/abc123' })
  })

  it('treats www the same as the apex', () => {
    expect(briefingLink({ link: 'https://www.dargle.eu/contract/abc123' }))
      .toEqual({ kind: 'internal', to: '/contract/abc123' })
    expect(briefingLink({ link: 'https://www.fontem.eu/contract/abc123' }))
      .toEqual({ kind: 'internal', to: '/contract/abc123' })
  })

  it('refuses a link with no id — the lobbying coalesce case', () => {
    // "'https://fontem.eu/company/' + coalesce(l.company_gmr_id, '')"
    // with an unresolved lobbyist. ~4 in 5 rows look like this.
    expect(briefingLink({ link: 'https://fontem.eu/company/' }))
      .toEqual({ kind: 'none', to: null })
  })

  it('keeps a genuinely external link external', () => {
    const r = briefingLink({ link: 'https://ted.europa.eu/notice/12345' })
    expect(r.kind).toBe('external')
    expect(r.to).toBe('https://ted.europa.eu/notice/12345')
  })

  it('passes through a link that is already a path', () => {
    expect(briefingLink({ link: '/contract/abc123' }))
      .toEqual({ kind: 'internal', to: '/contract/abc123' })
  })

  it('preserves query and fragment on a same-site link', () => {
    expect(briefingLink({ link: 'https://fontem.eu/contract/abc?view=lots#awards' }))
      .toEqual({ kind: 'internal', to: '/contract/abc?view=lots#awards' })
  })

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['whitespace', '   '],
    ['not a URL', 'not a url at all'],
    ['bare host', 'fontem.eu/contract/abc'],
    ['the root', 'https://fontem.eu/'],
  ])('has no destination when the link is %s', (_label, link) => {
    expect(briefingLink({ link })).toEqual({ kind: 'none', to: null })
  })

  it('refuses a javascript: link whatever the row says', () => {
    // Rows are query output, not user input, but a card turns one into
    // something a reader clicks — so the scheme gets checked here.
    expect(briefingLink({ link: 'javascript:alert(1)' }))  // eslint-disable-line no-script-url
      .toEqual({ kind: 'none', to: null })
  })

  it('refuses a protocol-relative link rather than guessing the host', () => {
    // '//host/path' would inherit whatever scheme the page is on and
    // point off-site while looking like a path.
    expect(briefingLink({ link: '//evil.example/contract/abc' }))
      .toEqual({ kind: 'none', to: null })
  })
})
