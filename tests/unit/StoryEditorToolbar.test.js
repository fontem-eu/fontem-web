import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import StoryEditorToolbar from '../../src/components/StoryEditorToolbar.vue'

// Editor stub — replaces the real TipTap editor with a chainable
// recorder so the toolbar's button clicks can be inspected as
// declarative call sequences.
function makeEditor({ active = {} } = {}) {
  const calls = []
  const chain = {
    focus: vi.fn(() => chain),
    toggleBold: vi.fn(() => chain),
    toggleItalic: vi.fn(() => chain),
    toggleUnderline: vi.fn(() => chain),
    toggleStrike: vi.fn(() => chain),
    toggleCode: vi.fn(() => chain),
    toggleCodeBlock: vi.fn(() => chain),
    toggleBulletList: vi.fn(() => chain),
    toggleOrderedList: vi.fn(() => chain),
    toggleBlockquote: vi.fn(() => chain),
    toggleHeading: vi.fn((opts) => {
      calls.push(['toggleHeading', opts])
      return chain
    }),
    setHorizontalRule: vi.fn(() => chain),
    setLink: vi.fn((opts) => {
      calls.push(['setLink', opts])
      return chain
    }),
    insertTable: vi.fn((opts) => {
      calls.push(['insertTable', opts])
      return chain
    }),
    run: vi.fn(() => chain),
  }
  return {
    chain: vi.fn(() => chain),
    isActive: vi.fn((name, attrs) => {
      if (typeof attrs === 'object') {
        return Boolean(active[`${name}:${JSON.stringify(attrs)}`])
      }
      return Boolean(active[name])
    }),
    _chainObj: chain,
    _calls: calls,
  }
}

function mountBar(editor) {
  return mount(StoryEditorToolbar, { props: { editor } })
}

describe('StoryEditorToolbar', () => {
  let editor
  beforeEach(() => { editor = makeEditor() })

  it('renders a single unified toolbar (the two old bars are gone)', () => {
    const w = mountBar(editor)
    expect(w.find('[data-testid="story-toolbar"]').exists()).toBe(true)
    // BubbleToolbar / FloatingToolbar selectors must not appear —
    // they were merged into this component and the source files
    // were deleted. If they reappear something regressed.
    expect(w.find('[data-testid="bubble-toolbar"]').exists()).toBe(false)
    expect(w.find('[data-testid="floating-toolbar"]').exists()).toBe(false)
  })

  it('groups buttons logically: text / heading / lists / block / insert', () => {
    const w = mountBar(editor)
    for (const g of ['text', 'heading', 'lists', 'block', 'insert']) {
      expect(
        w.find(`[data-testid="toolbar-group-${g}"]`).exists(),
        `missing group: ${g}`,
      ).toBe(true)
    }
  })

  // ── Headings: appears exactly once each — previous toolbars had
  // H1 / H2 in both BubbleToolbar AND FloatingToolbar, which the user
  // flagged as the visible duplication. ────────────────────────────
  it('does NOT duplicate the heading buttons', () => {
    const w = mountBar(editor)
    expect(w.findAll('[data-testid="tb-h1"]').length).toBe(1)
    expect(w.findAll('[data-testid="tb-h2"]').length).toBe(1)
    expect(w.findAll('[data-testid="tb-h3"]').length).toBe(1)
  })

  // ── Text formatting ──
  const textCases = [
    ['tb-bold',       'toggleBold'],
    ['tb-italic',     'toggleItalic'],
    ['tb-underline',  'toggleUnderline'],
    ['tb-strike',     'toggleStrike'],
    ['tb-code-inline', 'toggleCode'],
  ]
  textCases.forEach(([testid, cmd]) => {
    it(`${testid} → editor.chain().focus().${cmd}().run()`, async () => {
      const w = mountBar(editor)
      await w.find(`[data-testid="${testid}"]`).trigger('click')
      expect(editor.chain).toHaveBeenCalled()
      expect(editor._chainObj.focus).toHaveBeenCalled()
      expect(editor._chainObj[cmd]).toHaveBeenCalled()
      expect(editor._chainObj.run).toHaveBeenCalled()
    })
  })

  // ── Headings ──
  it('tb-h1 toggles heading level 1', async () => {
    const w = mountBar(editor)
    await w.find('[data-testid="tb-h1"]').trigger('click')
    expect(editor._calls).toContainEqual(['toggleHeading', { level: 1 }])
  })
  it('tb-h2 toggles heading level 2', async () => {
    const w = mountBar(editor)
    await w.find('[data-testid="tb-h2"]').trigger('click')
    expect(editor._calls).toContainEqual(['toggleHeading', { level: 2 }])
  })
  it('tb-h3 toggles heading level 3', async () => {
    const w = mountBar(editor)
    await w.find('[data-testid="tb-h3"]').trigger('click')
    expect(editor._calls).toContainEqual(['toggleHeading', { level: 3 }])
  })

  // ── Lists ──
  it('tb-bullet-list toggles a bullet list', async () => {
    const w = mountBar(editor)
    await w.find('[data-testid="tb-bullet-list"]').trigger('click')
    expect(editor._chainObj.toggleBulletList).toHaveBeenCalled()
  })
  it('tb-ordered-list toggles a numbered list', async () => {
    const w = mountBar(editor)
    await w.find('[data-testid="tb-ordered-list"]').trigger('click')
    expect(editor._chainObj.toggleOrderedList).toHaveBeenCalled()
  })

  // ── Block-level ──
  it('tb-code-block toggles the code block', async () => {
    const w = mountBar(editor)
    await w.find('[data-testid="tb-code-block"]').trigger('click')
    expect(editor._chainObj.toggleCodeBlock).toHaveBeenCalled()
  })
  it('tb-blockquote toggles a blockquote', async () => {
    const w = mountBar(editor)
    await w.find('[data-testid="tb-blockquote"]').trigger('click')
    expect(editor._chainObj.toggleBlockquote).toHaveBeenCalled()
  })
  it('tb-divider inserts a horizontal rule', async () => {
    const w = mountBar(editor)
    await w.find('[data-testid="tb-divider"]').trigger('click')
    expect(editor._chainObj.setHorizontalRule).toHaveBeenCalled()
  })

  // ── Link ──
  it('tb-link prompts for a URL and applies it when the user types one', async () => {
    vi.stubGlobal('prompt', vi.fn(() => 'https://example.com'))
    const w = mountBar(editor)
    await w.find('[data-testid="tb-link"]').trigger('click')
    expect(editor._calls).toContainEqual(['setLink', { href: 'https://example.com' }])
    vi.unstubAllGlobals()
  })
  it('tb-link is a no-op when the user cancels the prompt', async () => {
    vi.stubGlobal('prompt', vi.fn(() => null))
    const w = mountBar(editor)
    await w.find('[data-testid="tb-link"]').trigger('click')
    expect(editor._calls.some(([c]) => c === 'setLink')).toBe(false)
    vi.unstubAllGlobals()
  })

  // ── Insertions ──
  it('tb-image emits upload-image (no editor call — host handles the upload)', async () => {
    const w = mountBar(editor)
    await w.find('[data-testid="tb-image"]').trigger('click')
    expect(w.emitted('upload-image')?.length).toBe(1)
  })
  it('tb-widget emits insert-widget', async () => {
    const w = mountBar(editor)
    await w.find('[data-testid="tb-widget"]').trigger('click')
    expect(w.emitted('insert-widget')?.length).toBe(1)
  })
  it('tb-table inserts a 3×3 table with a header row', async () => {
    const w = mountBar(editor)
    await w.find('[data-testid="tb-table"]').trigger('click')
    expect(editor._calls).toContainEqual([
      'insertTable',
      { rows: 3, cols: 3, withHeaderRow: true },
    ])
  })

  // ── Active state ──
  it('applies the `active` class to a button when the editor reports the mark as active', () => {
    editor = makeEditor({ active: { bold: true, 'heading:{"level":2}': true } })
    const w = mountBar(editor)
    expect(w.find('[data-testid="tb-bold"]').classes()).toContain('active')
    expect(w.find('[data-testid="tb-h2"]').classes()).toContain('active')
    expect(w.find('[data-testid="tb-italic"]').classes()).not.toContain('active')
  })
})
