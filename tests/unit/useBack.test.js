/**
 * Back navigation.
 *
 * The contract page used to offer a hardcoded `<RouterLink to="/spending">`.
 * However a reader arrived — the mixed feed, the briefings feed, a search,
 * a shared link — the arrow sent them to Public spending, and because it
 * pushed rather than popped, each visit put the page they actually came
 * from one step further back. These pin the replacement: pop when there is
 * an in-app entry to pop, fall back only when there genuinely isn't one.
 */
import { describe, it, expect, vi } from 'vitest'

import { hasInAppHistory, useBack } from '../../src/composables/useBack.js'

const mocks = vi.hoisted(() => ({ router: null }))
vi.mock('vue-router', () => ({ useRouter: () => mocks.router }))

function routerWith(state) {
  return {
    options: { history: { state } },
    back: vi.fn(),
    push: vi.fn(),
  }
}

describe('hasInAppHistory', () => {
  it('is true for an in-app path', () => {
    expect(hasInAppHistory({ back: '/briefings' })).toBe(true)
  })

  it('is false when there is no previous entry', () => {
    // A shared contract link opened in a fresh tab. This is the case the
    // hardcoded fallback existed for, and the only case it was right for.
    expect(hasInAppHistory({ back: null })).toBe(false)
  })

  it('is false when history state is absent entirely', () => {
    expect(hasInAppHistory(undefined)).toBe(false)
    expect(hasInAppHistory({})).toBe(false)
  })

  it('refuses an off-site URL even though it came from history', () => {
    expect(hasInAppHistory({ back: 'https://example.com/' })).toBe(false)
  })

  it('refuses a protocol-relative URL despite its leading slash', () => {
    // "//evil.example" is off-site, and a naive startsWith('/') accepts it.
    expect(hasInAppHistory({ back: '//evil.example/path' })).toBe(false)
  })
})

describe('useBack', () => {
  it('pops the history entry when the reader came from inside the app', () => {
    mocks.router = routerWith({ back: '/' })

    const { goBack } = useBack('/spending')
    goBack()

    expect(mocks.router.back).toHaveBeenCalledTimes(1)
    expect(mocks.router.push).not.toHaveBeenCalled()
  })

  it('returns to the mixed feed, not a fixed page, when that is where they were', () => {
    // The actual reported bug: reading the feed, opening a briefing,
    // pressing back, and landing on Public spending instead.
    mocks.router = routerWith({ back: '/' })

    const { goBack, cameFromApp } = useBack('/spending')
    goBack()

    expect(cameFromApp).toBe(true)
    expect(mocks.router.push).not.toHaveBeenCalled()
  })

  it('falls back to the declared destination on a cold deep link', () => {
    mocks.router = routerWith({ back: null })

    const { goBack, cameFromApp } = useBack('/spending')
    goBack()

    expect(cameFromApp).toBe(false)
    expect(mocks.router.push).toHaveBeenCalledWith('/spending')
    expect(mocks.router.back).not.toHaveBeenCalled()
  })

  it('defaults the fallback to the feed', () => {
    mocks.router = routerWith({ back: null })

    useBack().goBack()

    expect(mocks.router.push).toHaveBeenCalledWith('/')
  })

  it('reads history once at setup, so a later mutation cannot flip it', () => {
    // history.state is not reactive; recomputing it per click would give
    // a component that silently behaves differently on the second press.
    mocks.router = routerWith({ back: '/briefings' })
    const { goBack } = useBack('/spending')

    mocks.router.options.history.state = { back: null }
    goBack()

    expect(mocks.router.back).toHaveBeenCalledTimes(1)
    expect(mocks.router.push).not.toHaveBeenCalled()
  })
})
