import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { makeTestI18n } from './helpers/i18n.js'

const ORIGINAL_DOC = { version: 2, tiptap: { type: 'doc', content: [
  { type: 'paragraph', content: [{ type: 'text', text: 'The rewritten original text.' }] }] } }
const STALE_DOC = { version: 2, tiptap: { type: 'doc', content: [
  { type: 'paragraph', content: [{ type: 'text', text: 'Texto antigo desatualizado.' }] }] } }

const REPORT = {
  id: 'r1', title: 'Original title', abstract: 'Original abstract',
  language: 'en', content_doc: ORIGINAL_DOC, created_by: 'u1',
  translations: [{ lang: 'pt', outdated: true }],
}
const getReport = vi.fn()
const getTranslation = vi.fn()
vi.mock('../../src/api/community.js', () => ({
  getReport: (...a) => getReport(...a),
  getTranslation: (...a) => getTranslation(...a),
  getUserProfile: vi.fn().mockResolvedValue(null),
}))
vi.mock('../../src/api/geo.js', () => ({ fetchNutsRegions: vi.fn().mockResolvedValue([]) }))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: 'r1' } }) }))
// The UI language is Portuguese — the exact situation that served stale text.
vi.mock('../../src/composables/useLang.js', () => ({
  useLang: () => ({ lang: { value: 'pt' } }),
}))

import ReportView from '../../src/views/ReportView.vue'

const stubs = {
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  EditorContent: { props: ['editor'], template: '<div class="ec" />' },
  ChapterRail: true, FlowerButton: true, EntitySidePanel: true, AuthorCard: true,
  WidgetRenderer: true,
}
const mountView = () => mount(ReportView, { global: { plugins: [makeTestI18n()], stubs } })

describe('ReportView — stale translation falls back to the original', () => {
  beforeEach(() => {
    getReport.mockReset(); getTranslation.mockReset()
    getReport.mockResolvedValue({ ...REPORT })
    getTranslation.mockResolvedValue({
      lang: 'pt', title: 'Título antigo', abstract: 'Resumo antigo',
      content_doc: STALE_DOC, outdated: true,
    })
  })

  it('does not auto-open the stale pt translation for a pt reader', async () => {
    const w = mountView(); await flushPromises()
    // the regression: it must NOT have fetched/opened the outdated translation
    expect(getTranslation).not.toHaveBeenCalled()
    expect(w.find('[data-testid="stale-translation-notice"]').exists()).toBe(false)
    expect(w.text()).toContain('Original title')
  })

  it('shows the original title/abstract + a notice when the reader picks the stale language', async () => {
    const w = mountView(); await flushPromises()
    await w.findComponent({ name: 'TranslationBar' }).vm.$emit('switch', 'pt')
    await flushPromises()

    const notice = w.find('[data-testid="stale-translation-notice"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toMatch(/PT/)
    // original text wins over the drifted translation
    expect(w.text()).toContain('Original title')
    expect(w.text()).toContain('Original abstract')
    expect(w.text()).not.toContain('Título antigo')
    expect(w.text()).not.toContain('Resumo antigo')
  })

  it('a CURRENT translation is still shown normally, with no notice', async () => {
    getReport.mockResolvedValue({ ...REPORT, translations: [{ lang: 'pt', outdated: false }] })
    getTranslation.mockResolvedValue({
      lang: 'pt', title: 'Título atual', abstract: 'Resumo atual',
      content_doc: STALE_DOC, outdated: false,
    })
    const w = mountView(); await flushPromises()
    expect(getTranslation).toHaveBeenCalledWith('r1', 'pt')   // auto-opened
    expect(w.find('[data-testid="stale-translation-notice"]').exists()).toBe(false)
    expect(w.text()).toContain('Título atual')
  })
})
