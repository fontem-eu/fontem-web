<script setup>
/**
 * Unified editor toolbar for the data-story editor.
 *
 * Replaces the previous BubbleToolbar + FloatingToolbar pair, which
 * rendered as two separate bars sitting side-by-side with duplicated
 * H1/H2 buttons. This component is the single bar — every formatting
 * and insertion affordance lives here, grouped logically:
 *
 *   text   | headings | lists | block-level | insertions
 *   B/I/U/S/code  H1/H2/H3   bullet/numbered   code-block/quote/divider/link   image/table/widget
 *
 * Children render as plain buttons with shared styling so a future
 * theme swap (token-only colours, dark mode, etc.) hits one place.
 */
const props = defineProps({
  editor: { type: Object, required: true },
})

const emit = defineEmits(['upload-image', 'insert-widget'])

// The inline-code formatting mark and the code-block node share the
// `code` Mark / `codeBlock` Node names in TipTap. Renderers consume
// `editor.isActive('code')` and `editor.isActive('codeBlock')`
// respectively — the names look similar so a comment is cheaper than
// the inevitable follow-up bug report.

function setLink() {
  const url = globalThis.prompt('Enter URL')
  if (url) props.editor.chain().focus().setLink({ href: url }).run()
}
</script>

<template>
  <div class="story-toolbar" data-testid="story-toolbar">
    <!-- Group: text formatting -->
    <div class="group" data-testid="toolbar-group-text">
      <button
        type="button"
        class="tb-btn"
        :class="{ active: editor.isActive('bold') }"
        title="Bold (⌘B)"
        data-testid="tb-bold"
        @click="editor.chain().focus().toggleBold().run()"
      ><b>B</b></button>
      <button
        type="button"
        class="tb-btn"
        :class="{ active: editor.isActive('italic') }"
        title="Italic (⌘I)"
        data-testid="tb-italic"
        @click="editor.chain().focus().toggleItalic().run()"
      ><i>I</i></button>
      <button
        type="button"
        class="tb-btn"
        :class="{ active: editor.isActive('underline') }"
        title="Underline (⌘U)"
        data-testid="tb-underline"
        @click="editor.chain().focus().toggleUnderline().run()"
      ><u>U</u></button>
      <button
        type="button"
        class="tb-btn"
        :class="{ active: editor.isActive('strike') }"
        title="Strikethrough"
        data-testid="tb-strike"
        @click="editor.chain().focus().toggleStrike().run()"
      ><s>S</s></button>
      <button
        type="button"
        class="tb-btn"
        :class="{ active: editor.isActive('code') }"
        title="Inline code"
        data-testid="tb-code-inline"
        @click="editor.chain().focus().toggleCode().run()"
      >&lt;/&gt;</button>
    </div>

    <span class="separator" aria-hidden="true" />

    <!-- Group: headings -->
    <div class="group" data-testid="toolbar-group-heading">
      <button
        type="button"
        class="tb-btn"
        :class="{ active: editor.isActive('heading', { level: 1 }) }"
        title="Heading 1"
        data-testid="tb-h1"
        @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
      >H1</button>
      <button
        type="button"
        class="tb-btn"
        :class="{ active: editor.isActive('heading', { level: 2 }) }"
        title="Heading 2"
        data-testid="tb-h2"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
      >H2</button>
      <button
        type="button"
        class="tb-btn"
        :class="{ active: editor.isActive('heading', { level: 3 }) }"
        title="Heading 3"
        data-testid="tb-h3"
        @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
      >H3</button>
    </div>

    <span class="separator" aria-hidden="true" />

    <!-- Group: lists -->
    <div class="group" data-testid="toolbar-group-lists">
      <button
        type="button"
        class="tb-btn"
        :class="{ active: editor.isActive('bulletList') }"
        title="Bullet list"
        data-testid="tb-bullet-list"
        @click="editor.chain().focus().toggleBulletList().run()"
      >•</button>
      <button
        type="button"
        class="tb-btn"
        :class="{ active: editor.isActive('orderedList') }"
        title="Numbered list"
        data-testid="tb-ordered-list"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >1.</button>
    </div>

    <span class="separator" aria-hidden="true" />

    <!-- Group: block-level affordances -->
    <div class="group" data-testid="toolbar-group-block">
      <button
        type="button"
        class="tb-btn"
        :class="{ active: editor.isActive('codeBlock') }"
        title="Code block"
        data-testid="tb-code-block"
        @click="editor.chain().focus().toggleCodeBlock().run()"
      >{ }</button>
      <button
        type="button"
        class="tb-btn"
        :class="{ active: editor.isActive('blockquote') }"
        title="Blockquote"
        data-testid="tb-blockquote"
        @click="editor.chain().focus().toggleBlockquote().run()"
      >"</button>
      <button
        type="button"
        class="tb-btn"
        title="Divider"
        data-testid="tb-divider"
        @click="editor.chain().focus().setHorizontalRule().run()"
      >─</button>
      <button
        type="button"
        class="tb-btn"
        :class="{ active: editor.isActive('link') }"
        title="Link"
        data-testid="tb-link"
        @click="setLink"
      >🔗</button>
    </div>

    <span class="separator" aria-hidden="true" />

    <!-- Group: insertions (image / table / pocket widget) -->
    <div class="group" data-testid="toolbar-group-insert">
      <button
        type="button"
        class="tb-btn"
        title="Image"
        data-testid="tb-image"
        @click="emit('upload-image')"
      >🖼</button>
      <button
        type="button"
        class="tb-btn"
        title="Table"
        data-testid="tb-table"
        @click="editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()"
      >☰</button>
      <button
        type="button"
        class="tb-btn"
        title="Widget from pocket"
        data-testid="tb-widget"
        @click="emit('insert-widget')"
      >📊</button>
    </div>
  </div>
</template>

<style scoped>
.story-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.tb-btn {
  border: none;
  background: transparent;
  color: var(--muted, #999);
  font-size: 0.75rem;
  padding: 4px 6px;
  border-radius: 3px;
  cursor: pointer;
  min-width: 28px;
  text-align: center;
  line-height: 1;
}
.tb-btn:hover {
  background: var(--surface, #f5f5f5);
  color: var(--text);
}
.tb-btn.active {
  background: var(--accent, #2563eb);
  color: #fff;
}
.separator {
  width: 1px;
  height: 16px;
  background: var(--border, #ddd);
  margin: 0 2px;
}
</style>
