import { describe, it, expect, vi, afterEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'

// The boot order, not a component. The UI language used to be settled in
// App.vue's onMounted, and a parent's onMounted runs after its children's:
// the page on screen had already sent its first requests with no language.
// Every view that follows the language then loaded a second time when it
// arrived — on staging, /search asked for its results once without
// ?lang= and once with it, and showed whichever answer came back last.

const seen = vi.hoisted(() => ({ langAtMount: null }))

vi.mock('../../src/app.js', async () => {
  const { currentLang } = await import('../../src/composables/useLang.js')
  return {
    createDargleApp: () => ({
      app: { mount: () => { seen.langAtMount = currentLang() } },
      router: { isReady: () => Promise.resolve(), afterEach: () => {} },
      i18n: {},
    }),
  }
})
vi.mock('../../src/api/session.js', () => ({ restoreSession: () => {} }))
vi.mock('../../src/composables/useAnalytics.js', () => ({ useAnalytics: () => ({ page: () => {} }) }))
vi.mock('../../src/i18n.js', () => ({ activateLocale: () => {} }))

afterEach(() => { localStorage.clear() })

describe('booting the app', () => {
  it('settles the reader\'s language before anything mounts', async () => {
    localStorage.setItem('gmr-lang', 'de')
    await import('../../src/main.js')
    await flushPromises()
    expect(seen.langAtMount).toBe('de')
  })
})
