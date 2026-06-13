/**
 * SEC-2026-06-11 #9 — Tiptap `Link` extension must declare an
 * explicit protocol allow-list so future minor bumps can't relax
 * the default (which currently filters `javascript:` but is not
 * guaranteed to keep doing so).
 *
 * The editor stitches Link.configure into a real Tiptap Editor at
 * construction time; the cleanest unit check is to spin up an
 * editor with the same config our app uses and round-trip an
 * `<a href="javascript:…">` through `setContent` → `getHTML()`. A
 * blocked protocol gets dropped by the schema's `parseHTML` →
 * `renderHTML` walker.
 */
import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Link } from '@tiptap/extension-link'

const ALLOWED = ['http', 'https', 'mailto']

function build(content) {
  return new Editor({
    extensions: [
      StarterKit,
      Link.configure({ protocols: ALLOWED, autolink: true, openOnClick: false }),
    ],
    content,
  })
}

describe('Tiptap Link protocol allow-list (security review #9)', () => {
  it('keeps http and https hrefs intact', () => {
    const ed = build('<p><a href="https://example.com">x</a></p>')
    expect(ed.getHTML()).toContain('href="https://example.com"')
    ed.destroy()
  })

  it('keeps mailto: hrefs intact', () => {
    const ed = build('<p><a href="mailto:hi@example.com">mail</a></p>')
    expect(ed.getHTML()).toContain('href="mailto:hi@example.com"')
    ed.destroy()
  })

  it('drops javascript: hrefs (the regression we are guarding)', () => {
    const ed = build('<p><a href="javascript:alert(1)">click</a></p>')
    const out = ed.getHTML()
    expect(out).not.toMatch(/href="javascript:/i)
    ed.destroy()
  })

  it('drops data: hrefs', () => {
    const ed = build('<p><a href="data:text/html,<script>1</script>">x</a></p>')
    const out = ed.getHTML()
    expect(out).not.toMatch(/href="data:/i)
    ed.destroy()
  })
})
