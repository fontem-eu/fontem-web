/**
 * TagEditor — pill-style 3-cap tag input with slug normalisation.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TagEditor from '../../src/components/TagEditor.vue'

vi.mock('../../src/api/community.js', () => ({
  listAllTags: vi.fn(() => Promise.resolve({
    tags: [
      { tag: 'public-expenditure', story_count: 4 },
      { tag: 'procurement', story_count: 2 },
      { tag: 'lobbying', story_count: 1 },
    ],
  })),
}))

afterEach(() => vi.restoreAllMocks())

describe('TagEditor', () => {
  it('renders one pill per modelValue tag', async () => {
    const w = mount(TagEditor, {
      props: { modelValue: ['procurement', 'lobbying'] },
    })
    await flushPromises()
    expect(w.findAll('.pill')).toHaveLength(2)
    expect(w.find('[data-testid="tag-pill-procurement"]').exists()).toBe(true)
  })

  it('emits update:modelValue with the slug-normalised tag on Enter', async () => {
    const w = mount(TagEditor, { props: { modelValue: [] } })
    await flushPromises()
    const input = w.find('[data-testid="tag-editor-input"]')
    await input.setValue('Public Expenditure')
    await input.trigger('keydown.enter')
    expect(w.emitted('update:modelValue')[0][0]).toEqual(['public-expenditure'])
  })

  it('rejects empty submissions', async () => {
    const w = mount(TagEditor, { props: { modelValue: [] } })
    await flushPromises()
    const input = w.find('[data-testid="tag-editor-input"]')
    await input.setValue('   ')
    await input.trigger('keydown.enter')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('drops duplicates after normalisation', async () => {
    const w = mount(TagEditor, { props: { modelValue: ['procurement'] } })
    await flushPromises()
    const input = w.find('[data-testid="tag-editor-input"]')
    await input.setValue('PROCUREMENT')
    await input.trigger('keydown.enter')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('disables input + shows hint when at the cap', async () => {
    const w = mount(TagEditor, {
      props: { modelValue: ['a', 'b', 'c'], maxTags: 3 },
    })
    await flushPromises()
    expect(w.find('[data-testid="tag-editor-input"]').attributes('disabled')).toBeDefined()
    expect(w.text()).toMatch(/Maximum 3 tags/)
  })

  it('removes a tag when its × is clicked', async () => {
    const w = mount(TagEditor, { props: { modelValue: ['procurement', 'lobbying'] } })
    await flushPromises()
    await w.find('[data-testid="tag-pill-procurement"] .pill-x').trigger('click')
    expect(w.emitted('update:modelValue')[0][0]).toEqual(['lobbying'])
  })

  it('shows existing-tag suggestions on focus, excluding already-selected ones', async () => {
    const w = mount(TagEditor, { props: { modelValue: ['procurement'] }, attachTo: document.body })
    await flushPromises()
    await w.find('[data-testid="tag-editor-input"]').trigger('focus')
    const sugg = w.find('[data-testid="tag-suggestions"]')
    expect(sugg.exists()).toBe(true)
    const text = sugg.text()
    expect(text).toContain('public-expenditure')
    expect(text).toContain('lobbying')
    expect(text).not.toContain('procurement') // already selected → hidden
    w.unmount()
  })

  it('clicking a suggestion adds it as a new tag', async () => {
    const w = mount(TagEditor, { props: { modelValue: [] }, attachTo: document.body })
    await flushPromises()
    await w.find('[data-testid="tag-editor-input"]').trigger('focus')
    const btn = w.findAll('[data-testid="tag-suggestions"] .suggestion-btn')[0]
    await btn.trigger('mousedown')
    expect(w.emitted('update:modelValue')[0][0]).toEqual(['public-expenditure'])
    w.unmount()
  })
})
