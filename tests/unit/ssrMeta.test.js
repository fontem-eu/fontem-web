/**
 * Unit tests for src/ssr/meta.js — the per-route SSR title and
 * description registry.
 *
 * Pinned because every top-nav route should carry its own meta;
 * regressions here silently degrade SEO + link-preview quality.
 */
import { describe, it, expect } from 'vitest'
import { titleForPath, descriptionForPath } from '../../src/ssr/meta.js'

const NAVIGABLE_ROUTES = [
  '/',
  '/feed',
  '/atlas',
  '/data-quality',
  '/sparql',
  '/privacy',
  '/donate',
  '/login',
]

describe('titleForPath', () => {
  it.each(NAVIGABLE_ROUTES)(
    'has a route-specific title for %s',
    (path) => {
      const title = titleForPath({ path })
      expect(title).toBeTruthy()
      // Every title should mention Fontem so brand is consistent in tabs.
      expect(title.toLowerCase()).toContain('fontem')
    },
  )

  it('the / and /atlas titles are distinct', () => {
    expect(titleForPath({ path: '/' })).not.toBe(titleForPath({ path: '/atlas' }))
  })

  it('falls back to a default for unknown paths', () => {
    const fallback = titleForPath({ path: '/no-such-route' })
    expect(fallback.toLowerCase()).toContain('fontem')
  })
})

describe('descriptionForPath', () => {
  it.each(NAVIGABLE_ROUTES)(
    'has a route-specific description for %s',
    (path) => {
      const desc = descriptionForPath({ path })
      expect(desc).toBeTruthy()
      // Long enough to be useful, short enough to not be cropped.
      expect(desc.length).toBeGreaterThan(40)
      expect(desc.length).toBeLessThan(220)
    },
  )

  it('the / and /atlas descriptions are distinct', () => {
    expect(descriptionForPath({ path: '/' })).not.toBe(
      descriptionForPath({ path: '/atlas' }),
    )
  })
})
