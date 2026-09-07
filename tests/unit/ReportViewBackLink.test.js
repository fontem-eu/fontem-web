/**
 * Where "back" goes from a story.
 *
 * An author reading a story they had been editing was sent to the public
 * list, which is not where they came from. And the link called itself
 * "Stories" while pointing at `/`, which stopped being true when `/`
 * became the mixed landing feed and Stories moved to /stories-feed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { makeTestI18n } from './helpers/i18n.js'

const REPORT = {
  id: 'r1', title: 'A story', abstract: 'x', language: 'en',
  content_doc: { version: 2, tiptap: { type: 'doc', content: [] } },
  created_by: 'author-1',
}

const getReport = vi.fn()
vi.mock('../../src/api/community.js', () => ({
  getReport: (...a) => getReport(...a),
  getTranslation: vi.fn(),
  getUserProfile: vi.fn().mockResolvedValue(null),
}))
vi.mock('../../src/api/geo.js', () => ({ fetchNutsRegions: vi.fn().mockResolvedValue([]) }))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: 'r1' } }) }))
vi.mock('../../src/composables/useLang.js', () => ({
  useLang: () => ({ lang: { value: 'en' } }),
}))

const { _internal } = await import('../../src/api/session.js')
const ReportView = (await import('../../src/views/ReportView.vue')).default

const stubs = {
  RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  EditorContent: { props: ['editor'], template: '<div />' },
  ChapterRail: true, FlowerButton: true, EntitySidePanel: true, AuthorCard: true,
  WidgetRenderer: true,
}

async function mountAs(user) {
  _internal.clearForTests()
  if (user) _internal.setUserForTests(user)
  const wrapper = mount(ReportView, { global: { plugins: [makeTestI18n()], stubs } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  getReport.mockResolvedValue(REPORT)
})

describe('ReportView — the back link', () => {
  it('sends the author back to their own stories', async () => {
    const w = await mountAs({ id: 'author-1' })
    const back = w.find('[data-testid="back-to-feed"]')
    expect(back.attributes('href')).toBe('/my-stories')
    expect(back.text()).toMatch(/My Stories/i)
  })

  it('sends anyone else to the stories list', async () => {
    const w = await mountAs({ id: 'someone-else' })
    expect(w.find('[data-testid="back-to-feed"]').attributes('href')).toBe('/stories-feed')
  })

  it('sends a signed-out reader to the stories list', async () => {
    const w = await mountAs(null)
    expect(w.find('[data-testid="back-to-feed"]').attributes('href')).toBe('/stories-feed')
  })

  it('never points at `/`, which is the mixed feed and not Stories', async () => {
    // The label says Stories. `/` stopped being that.
    for (const user of [{ id: 'author-1' }, { id: 'other' }, null]) {
      const w = await mountAs(user)
      expect(w.find('[data-testid="back-to-feed"]').attributes('href')).not.toBe('/')
    }
  })
})
