/**
 * The KeepAlive include list and the component names must agree.
 *
 * `include` matches by component name. If a view's name drifts — or was
 * never declared, which is the default for `<script setup>` in some
 * setups — the filter quietly matches nothing: no error, no warning,
 * and the feed goes back to refetching and jumping to the top. The
 * failure is invisible, so it gets a test.
 */
import { describe, it, expect } from 'vitest'

import { CACHED_VIEWS, viewKey } from '../../src/router/cachedViews.js'
import FeedView from '../../src/views/FeedView.vue'
import BriefingsView from '../../src/views/BriefingsView.vue'

describe('cached views', () => {
  it('FeedView declares the name the include list looks for', () => {
    expect(FeedView.name).toBe('FeedView')
    expect(CACHED_VIEWS).toContain(FeedView.name)
  })

  it('BriefingsView declares the name the include list looks for', () => {
    expect(BriefingsView.name).toBe('BriefingsView')
    expect(CACHED_VIEWS).toContain(BriefingsView.name)
  })

  it('caches only the list views', () => {
    // Detail pages must not be cached: two different contracts share one
    // component, and a cached instance would show the previous contract.
    expect(CACHED_VIEWS).toEqual(['FeedView', 'BriefingsView'])
  })
})

describe('viewKey', () => {
  it('keys a kept-alive view by its path', () => {
    expect(viewKey({ type: { name: 'FeedView' } }, { path: '/stories-feed' })).toBe('/stories-feed')
  })

  it('gives every other view no key, so it is reused across its own paths', () => {
    expect(viewKey({ type: { name: 'StudioPlotView' } }, { path: '/studio/p/1/plot/2' })).toBeUndefined()
    expect(viewKey({ type: {} }, { path: '/c/AAPL/profile' })).toBeUndefined()
  })

  it('tolerates the empty render before a route resolves', () => {
    expect(viewKey(null, { path: '/' })).toBeUndefined()
  })
})
