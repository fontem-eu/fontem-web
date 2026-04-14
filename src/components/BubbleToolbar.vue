<script setup>
/**
 * Confluence-style bubble toolbar — appears on text selection.
 * Shows formatting options: bold, italic, underline, link, headings.
 */
const props = defineProps({
  editor: { type: Object, required: true },
})

function setLink() {
  const url = window.prompt('Enter URL')
  if (url) {
    props.editor.chain().focus().setLink({ href: url }).run()
  }
}
</script>

<template>
  <div class="bubble-toolbar" data-testid="bubble-toolbar">
    <button
      :class="{ active: editor.isActive('bold') }"
      title="Bold"
      @click="editor.chain().focus().toggleBold().run()"
    ><b>B</b></button>
    <button
      :class="{ active: editor.isActive('italic') }"
      title="Italic"
      @click="editor.chain().focus().toggleItalic().run()"
    ><i>I</i></button>
    <button
      :class="{ active: editor.isActive('underline') }"
      title="Underline"
      @click="editor.chain().focus().toggleUnderline().run()"
    ><u>U</u></button>
    <button
      :class="{ active: editor.isActive('strike') }"
      title="Strikethrough"
      @click="editor.chain().focus().toggleStrike().run()"
    ><s>S</s></button>
    <span class="separator" />
    <button
      :class="{ active: editor.isActive('heading', { level: 1 }) }"
      title="Heading 1"
      @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
    >H1</button>
    <button
      :class="{ active: editor.isActive('heading', { level: 2 }) }"
      title="Heading 2"
      @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
    >H2</button>
    <button
      :class="{ active: editor.isActive('heading', { level: 3 }) }"
      title="Heading 3"
      @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
    >H3</button>
    <span class="separator" />
    <button
      :class="{ active: editor.isActive('link') }"
      title="Link"
      @click="setLink"
    >🔗</button>
    <button
      :class="{ active: editor.isActive('code') }"
      title="Inline code"
      @click="editor.chain().focus().toggleCode().run()"
    >&lt;/&gt;</button>
  </div>
</template>

<style scoped>
.bubble-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  background: #1a1a2e;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.bubble-toolbar button {
  border: none;
  background: transparent;
  color: #ccc;
  font-size: 0.75rem;
  padding: 4px 6px;
  border-radius: 3px;
  cursor: pointer;
  min-width: 28px;
  text-align: center;
}
.bubble-toolbar button:hover { background: rgba(255,255,255,0.1); color: #fff; }
.bubble-toolbar button.active { background: rgba(255,255,255,0.2); color: #fff; }
.separator { width: 1px; height: 16px; background: rgba(255,255,255,0.2); margin: 0 4px; }
</style>
