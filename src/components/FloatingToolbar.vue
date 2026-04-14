<script setup>
/**
 * Confluence-style floating menu — appears on empty lines.
 * Insert: headings, image, table, widget from pocket, horizontal rule, code block.
 */
defineProps({
  editor: { type: Object, required: true },
})

const emit = defineEmits(['upload-image', 'insert-widget'])
</script>

<template>
  <div class="floating-toolbar" data-testid="floating-toolbar">
    <button title="Heading 1" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()">H1</button>
    <button title="Heading 2" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
    <button title="Bullet list" @click="editor.chain().focus().toggleBulletList().run()">•</button>
    <button title="Numbered list" @click="editor.chain().focus().toggleOrderedList().run()">1.</button>
    <button title="Image" @click="emit('upload-image')">🖼</button>
    <button title="Table" @click="editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()">☰</button>
    <button title="Widget" @click="emit('insert-widget')">📊</button>
    <button title="Code block" @click="editor.chain().focus().toggleCodeBlock().run()">&lt;/&gt;</button>
    <button title="Divider" @click="editor.chain().focus().setHorizontalRule().run()">─</button>
    <button title="Blockquote" @click="editor.chain().focus().toggleBlockquote().run()">"</button>
  </div>
</template>

<style scoped>
.floating-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #ddd);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.floating-toolbar button {
  border: none;
  background: transparent;
  color: var(--muted, #999);
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
}
.floating-toolbar button:hover { background: var(--bg, #f5f5f5); color: var(--text); }
</style>
