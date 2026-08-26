/**
 * Router auth-gate predicate.
 *
 * Regression: the gate used to be a `startsWith('/reports')` prefix
 * list, which swallowed `/reports/:id` (the public read view) along
 * with `/reports/:id/edit` (the editor). Anonymous visitors clicking
 * a shared report link got bounced to /login even though the backend
 * happily serves `public_open` reports without auth. This suite pins
 * the predicate so we don't lose the public-read path again.
 */
import { describe, it, expect } from 'vitest'
import { requiresAuth } from '../../src/router/authGate.js'

describe('requiresAuth — router gate predicate', () => {
  describe('public paths (no auth required)', () => {
    const publicPaths = [
      '/',
      '/login',
      '/privacy',
      '/development',
      '/sparql',
      '/geo',
      '/data-quality',
      '/data-quality/contracts',
      '/reports/abc-123',                // public read view of a report
      '/reports/abc-123/share',          // any non-/edit subpath of a report
      '/reports/with-dashes-and_underscores',
    ]
    for (const p of publicPaths) {
      it(`allows ${p} without auth`, () => {
        expect(requiresAuth(p)).toBe(false)
      })
    }
  })

  describe('gated paths (auth required)', () => {
    const gatedPaths = [
      '/my-reports',
      '/my-reports/drafts',
      '/reports/abc-123/edit',           // editor — gated
      '/reports/abc-123/edit/section',   // any nested editor sub-path
      '/issues',
      '/issues/123',
      '/activity',
      '/ai-usage',
      '/admin',
      '/admin/moderation',
      '/admin/entity-resolution',
    ]
    for (const p of gatedPaths) {
      it(`gates ${p} behind auth`, () => {
        expect(requiresAuth(p)).toBe(true)
      })
    }
  })

  it('does NOT match /report (singular) — only the plural /reports route exists', () => {
    // Belt-and-suspenders: catches typos like `/report/foo` so they
    // don't quietly bypass auth (they 404 anyway, but the predicate
    // shouldn't claim they need auth either — that would mask the
    // 404 with a login redirect).
    expect(requiresAuth('/report/abc/edit')).toBe(false)
  })

  it('treats /reports (the index, which redirects to /my-reports) as public — the redirect lands on a gated path', () => {
    // /reports is a redirect target, not a renderable page. The
    // gate doesn't need to fire on it: the redirect resolves to
    // /my-reports, where the gate fires correctly. Pinning this
    // behaviour so we don't accidentally introduce a double-redirect.
    expect(requiresAuth('/reports')).toBe(false)
  })
})
