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

import { CACHED_VIEWS } from '../../src/router/cachedViews.js'
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
