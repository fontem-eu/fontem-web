<script setup>
/**
 * Confluence-style data-story editor — single unified TipTap document.
 *
 * No sections, no markdown/rich-text toggle. One WYSIWYG editor with:
 * - Bubble menu (formatting on text selection)
 * - Floating menu (insert blocks on empty lines)
 * - Inline image upload (to MinIO)
 * - Widget nodes (interactive Vue components inline)
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Image } from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { WidgetNode } from '../extensions/WidgetNode.js'
import { EntityMention } from '../extensions/EntityMention.js'
import { MentionTrigger } from '../extensions/MentionTrigger.js'
import StoryEditorToolbar from '../components/StoryEditorToolbar.vue'
import AssistPanel from '../components/AssistPanel.vue'
import EntitySidePanel from '../components/EntitySidePanel.vue'
import MentionAutocomplete from '../components/MentionAutocomplete.vue'
import ChapterRail from '../components/ChapterRail.vue'
import TableControlsOverlay from '../components/TableControlsOverlay.vue'
import { usePocket } from '../composables/usePocket.js'
import { useToast } from '../composables/useToast.js'
import {
  getReport,
  updateReport,
  saveDocument,
  setStoryTags,
  uploadImage,
} from '../api/community.js'
import TagEditor from '../components/TagEditor.vue'

const route = useRoute()
const reportId = route.params.id

const title = ref('')
const abstract = ref('')
const visibility = ref('private')
const tags = ref([])
const saving = ref(false)
const error = ref(null)
const loading = ref(true)

// ── ChapterRail (TOC) ───────────────────────────────────────
// Same wire-up shape as ReportView.vue: the rail walks the rendered
// DOM for h2/h3 headings, slugifies + stamps stable ids on them,
// and intersects-observes the elements for scroll-position. Editor
// content mutates a lot (every keystroke is a transaction), so we
// bump `bodyVersion` on TipTap's `update` hook and the rail re-extracts.
const editorBodyRef = ref(null)
const bodyVersion = ref(0)

const toast = useToast()

// ── Pocket ──────────────────────────────────────────────────
const { items: pocketItems, remove: removePocketItem, refresh: refreshPocket } = usePocket()
const showPocketModal = ref(false)

function openPocketModal() {
  refreshPocket()
  showPocketModal.value = true
}

function insertFromPocket(item) {
  if (!editor) return
  editor.chain().focus().insertContent({
    type: 'widget',
    attrs: {
      widget_type: item.widget_type,
      entityId: item.config?.entityId || item.config?.entity_id,
      schema_version: 1,
      ...(item.config?.depth ? { depth: item.config.depth } : {}),
    },
  }).run()
  showPocketModal.value = false
}

// ── Image upload ────────────────────────────────────────────
const fileInput = ref(null)

async function handleImageUpload() {
  fileInput.value?.click()
}

async function onFileSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const result = await uploadImage(reportId, file)
    editor.chain().focus().setImage({ src: result.url }).run()
  } catch (err) {
    error.value = `Image upload failed: ${err.message}`
  }
  event.target.value = ''
}

// ── Editor ──────────────────────────────────────────────────
let editor = null

// `mentionState` is reactive — MentionTrigger writes to it on every
// editor selection update; MentionAutocomplete reads it to render
// the @-popover. Kept top-level so the popover lives outside the
// editor's atomic tree (Tiptap NodeViews can't host floating UI).
const mentionState = ref({ active: false })

function createEditor(content = '') {
  return new Editor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing your analysis...' }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      WidgetNode,
      EntityMention,
      MentionTrigger.configure({
        onState: (s) => { mentionState.value = s },
      }),
    ],
    content,
    onUpdate() {
      // Keystrokes mutate the heading set; ChapterRail re-reads
      // bodyVersion as a change signal. requestAnimationFrame
      // batches together flurries of edits into one rail refresh.
      requestAnimationFrame(() => { bodyVersion.value += 1 })
    },
    onCreate() {
      bodyVersion.value += 1
    },
  })
}

// ── AI Assist ───────────────────────────────────────────────
function onAssistInsert(text) {
  if (editor) {
    editor.chain().focus().insertContent(`<p>${text}</p>`).run()
  }
}

/**
 * Handle a successfully-applied AI proposal.
 *
 * Why this is its own handler (instead of the old @refresh→loadReport):
 * loadReport destroys the editor and rebuilds it from the server's
 * copy of the report. For a content edit, the server hasn't seen
 * the new content yet — so the rebuild *erased the edit the user just
 * applied*. That manifested as "I clicked Apply and nothing happened".
 *
 * Now:
 *   - 'content'  → the editor already has the change; persist it.
 *   - 'metadata' → updateReport() already ran in executeProposal;
 *                  just mirror the params into local refs so the
 *                  header reflects the new title/abstract immediately.
 */
async function onProposalApplied({ action, category, params }) {
  if (category === 'metadata') {
    if (action === 'update_title' && params?.title !== undefined) {
      title.value = params.title
    } else if (action === 'update_abstract' && params?.abstract !== undefined) {
      abstract.value = params.abstract
    }
    return
  }
  if (category === 'content' && editor) {
    saving.value = true
    try {
      await saveDocument(reportId, editor.getJSON())
    } catch (err) {
      // Don't unwind the editor change — the user can hit Save manually
      // to retry. Surface the error so they see why the persistence
      // didn't happen.
      error.value = `Apply succeeded locally but save failed: ${err.message}`
    } finally {
      saving.value = false
    }
  }
}

const reportContext = computed(() => {
  if (!editor) return ''
  const text = editor.getText()
  const parts = []
  if (title.value?.trim()) parts.push(`# ${title.value.trim()}`)
  if (abstract.value?.trim()) parts.push(abstract.value.trim())
  if (text?.trim()) parts.push(text.trim())
  return parts.join('\n\n')
})

// ── Load ────────────────────────────────────────────────────
async function loadReport() {
  try {
    const report = await getReport(reportId)
    title.value = report.title || ''
    abstract.value = report.abstract || ''
    visibility.value = report.visibility || 'private'
    tags.value = Array.isArray(report.tags) ? report.tags : []

    if (editor) editor.destroy()

    // v2: TipTap JSON document
    if (report.content_doc?.version === 2) {
      editor = createEditor(report.content_doc.tiptap)
    } else {
      // v1: concatenate section HTML into a single document
      const html = (report.sections || []).map(s => s.content || '').join('')
      editor = createEditor(html || '')
    }
  } catch (err) {
    error.value = err.message
    if (!editor) editor = createEditor()
  }
}

onMounted(async () => {
  try {
    await loadReport()
  } catch (err) {
    error.value = err.message
    editor = createEditor()
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  if (editor) editor.destroy()
})

// ── Save ────────────────────────────────────────────────────
async function save() {
  saving.value = true
  error.value = null
  try {
    await updateReport(reportId, {
      title: title.value,
      abstract: abstract.value,
      visibility: visibility.value,
    })
    // Tags persist via a separate endpoint (owner-only PUT). Server
    // re-normalises on its side, so the response here is the
    // canonical slug list — keep our `tags` ref in sync.
    const tagResp = await setStoryTags(reportId, tags.value)
    if (Array.isArray(tagResp?.tags)) tags.value = tagResp.tags
    await saveDocument(reportId, editor.getJSON())
    toast.success('Story saved')
  } catch (err) {
    error.value = err.message
    // Sticky error toast: the inline `.error-bar` still renders the
    // same message, but the toast is hard to miss even when the user
    // has scrolled down through a long story.
    toast.error(`Save failed: ${err.message}`, { durationMs: 0 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="report-editor" data-testid="story-editor">
    <!-- Header -->
    <div class="editor-header">
      <router-link to="/my-stories" class="back-link" data-testid="back-to-my-stories">
        &larr; My Stories
      </router-link>
      <div class="header-actions">
        <select v-model="visibility" class="visibility-select" data-testid="visibility-select">
          <option value="private">Private — only me</option>
          <option value="public_auth">Signed-in users</option>
          <option value="public_open">Public — anyone</option>
        </select>
        <AssistPanel
          :report-context="reportContext"
          :report-id="reportId"
          :editor-state="{ editor, title: title, abstract: abstract }"
          @insert="onAssistInsert"
          @applied="onProposalApplied"
        />
        <button class="save-btn" :disabled="saving" data-testid="save-story" @click="save">
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="error-bar" data-testid="editor-error">{{ error }}</div>
    <div v-if="loading" class="loading-msg">Loading story...</div>

    <template v-else>
      <!-- Title -->
      <input
        v-model="title"
        type="text"
        class="title-input"
        placeholder="Story title"
        data-testid="story-title-input"
      />

      <!-- Abstract -->
      <textarea
        v-model="abstract"
        class="abstract-input"
        placeholder="Brief abstract..."
        rows="2"
        data-testid="story-abstract-input"
      />

      <!-- Tags — capped at 3 by TagEditor + the backend; suggestions
           come from /tags (existing public-story tags). -->
      <TagEditor v-model="tags" class="tag-editor-slot" />

      <!-- Unified Editor with static toolbar -->
      <div class="editor-body" data-testid="editor-body">
        <StoryEditorToolbar
          v-if="editor"
          :editor="editor"
          data-testid="editor-toolbar"
          @upload-image="handleImageUpload"
          @insert-widget="openPocketModal"
        />
        <!-- Two-column layout: editor + chapter-rail (TOC). Rail
             hides at <1024 px via its own media query. The ref is
             on the inner div so ChapterRail can walk h2/h3 nodes
             rendered into the TipTap EditorContent. The table
             controls overlay sits inside the same scroll container
             so it can position itself relative to .editor-body-col. -->
        <div class="editor-layout">
          <div ref="editorBodyRef" class="editor-body-col">
            <EditorContent v-if="editor" :editor="editor" class="tiptap-editor" />
            <TableControlsOverlay v-if="editor" :editor="editor" />
          </div>
          <ChapterRail
            v-if="editor"
            :body-ref="editorBodyRef"
            :version="bodyVersion"
            data-testid="editor-chapter-rail"
          />
        </div>
      </div>

      <!-- @-mention autocomplete + side panel. The autocomplete only
           renders while MentionTrigger reports an active query; the
           side panel listens for chip clicks and resolves on demand. -->
      <MentionAutocomplete v-if="editor" :editor="editor" :state="mentionState" />
      <EntitySidePanel />

      <!-- Hidden file input for image upload -->
      <input
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        style="display: none"
        @change="onFileSelected"
      />
    </template>

    <!-- Pocket picker modal -->
    <div
      v-if="showPocketModal"
      class="modal-overlay"
      data-testid="pocket-modal"
      @click.self="showPocketModal = false"
    >
      <div class="modal-content">
        <h3>Insert Widget</h3>
        <p v-if="!pocketItems.length" class="pocket-empty">
          Your pocket is empty. Save visualizations using the Pocket button first.
        </p>
        <ul v-else class="pocket-list" data-testid="pocket-list">
          <li
            v-for="item in pocketItems"
            :key="item.id"
            class="pocket-item"
            :data-testid="'pocket-item-' + item.id"
          >
            <div class="pocket-item-info" @click="insertFromPocket(item)">
              <span class="pocket-item-type">{{ item.widget_type?.replace(/_/g, ' ') }}</span>
              <span class="pocket-item-name">{{ item.name }}</span>
            </div>
            <button class="pocket-item-remove" @click.stop="removePocketItem(item.id)">&times;</button>
          </li>
        </ul>
        <div class="modal-actions">
          <button @click="showPocketModal = false">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.report-editor { max-width: 800px; margin: 0 auto; padding: 1.5rem 1rem; }
.editor-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.back-link { color: var(--accent); text-decoration: none; font-size: 0.85rem; }
.header-actions { display: flex; gap: 0.5rem; align-items: center; }
.visibility-select { padding: 0.35rem 0.5rem; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 0.8rem; border-radius: 4px; }
.save-btn { padding: 0.4rem 1rem; background: var(--accent); color: #fff; border: none; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }
.save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.error-bar { padding: 0.5rem 0.75rem; margin-bottom: 1rem; background: #fee2e2; color: #991b1b; border-radius: 4px; font-size: 0.8rem; }
.loading-msg { color: var(--muted); font-size: 0.85rem; text-align: center; padding: 2rem 0; }
.title-input { display: block; width: 100%; padding: 0.5rem 0; border: none; border-bottom: 2px solid var(--border); background: transparent; color: var(--text); font-size: 1.5rem; font-weight: 700; outline: none; margin-bottom: 0.75rem; }
.title-input:focus { border-color: var(--accent); }
.abstract-input { display: block; width: 100%; padding: 0.5rem; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 0.85rem; border-radius: 4px; resize: vertical; outline: none; margin-bottom: 0.9rem; }
.tag-editor-slot { margin-bottom: 1.2rem; }
.abstract-input:focus { border-color: var(--accent); }

.editor-body { border: 1px solid var(--border); border-radius: 6px; background: var(--surface); min-height: 400px; overflow: hidden; }
/* Two-column layout under the toolbar: editor on the left, chapter
   rail on the right. Rail collapses below 1024 px (its own media
   query). `min-width: 0` keeps the editor from blowing past the
   wrapper when long lines wrap. `position: relative` is what lets
   TableControlsOverlay position itself relative to this scroll
   container instead of the document. */
.editor-layout { display: flex; gap: 1.5rem; align-items: flex-start; }
.editor-body-col { flex: 1; min-width: 0; position: relative; }
.tiptap-editor { padding: 1rem 1.25rem; font-size: 0.9rem; color: var(--text); }
.tiptap-editor :deep(.tiptap) { outline: none; min-height: 350px; }
.tiptap-editor :deep(.tiptap p.is-editor-empty:first-child::before) { content: attr(data-placeholder); color: var(--muted); pointer-events: none; float: left; height: 0; }
.tiptap-editor :deep(.tiptap h1) { font-size: 1.4rem; font-weight: 700; margin: 0.75rem 0 0.5rem; }
.tiptap-editor :deep(.tiptap h2) { font-size: 1.2rem; font-weight: 600; margin: 0.75rem 0 0.5rem; }
.tiptap-editor :deep(.tiptap h3) { font-size: 1.05rem; font-weight: 600; margin: 0.5rem 0; }
.tiptap-editor :deep(.tiptap ul), .tiptap-editor :deep(.tiptap ol) { padding-left: 1.5rem; margin: 0.5rem 0; }
.tiptap-editor :deep(.tiptap code) { background: var(--bg); padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.85em; }
.tiptap-editor :deep(.tiptap pre) { background: var(--bg); padding: 0.75rem; border-radius: 4px; overflow-x: auto; }
.tiptap-editor :deep(.tiptap img) { max-width: 100%; height: auto; border-radius: 4px; margin: 0.5rem 0; }
.tiptap-editor :deep(.tiptap table) { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
.tiptap-editor :deep(.tiptap th), .tiptap-editor :deep(.tiptap td) { border: 1px solid var(--border); padding: 0.4rem 0.6rem; text-align: left; font-size: 0.85rem; }
.tiptap-editor :deep(.tiptap th) { background: var(--bg); font-weight: 600; }
.tiptap-editor :deep(.tiptap blockquote) { border-left: 3px solid var(--accent); padding-left: 0.75rem; color: var(--muted); margin: 0.5rem 0; }
.tiptap-editor :deep(.tiptap hr) { border: none; border-top: 1px solid var(--border); margin: 1rem 0; }
.tiptap-editor :deep(.tiptap a) { color: var(--accent); text-decoration: underline; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-content { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 1.5rem; width: 90%; max-width: 400px; }
.modal-content h3 { margin: 0 0 1rem; font-size: 1rem; color: var(--text); }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
.modal-actions button { padding: 0.35rem 0.75rem; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 0.8rem; border-radius: 4px; cursor: pointer; }
.pocket-empty { font-size: 0.8rem; color: var(--muted); line-height: 1.6; margin: 0; }
.pocket-list { list-style: none; padding: 0; margin: 0; max-height: 300px; overflow-y: auto; }
.pocket-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0; border-bottom: 1px solid var(--border); }
.pocket-item:last-child { border-bottom: none; }
.pocket-item-info { flex: 1; cursor: pointer; min-width: 0; }
.pocket-item-info:hover .pocket-item-name { color: var(--accent); }
.pocket-item-type { display: block; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.pocket-item-name { display: block; font-size: 0.85rem; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pocket-item-remove { flex-shrink: 0; width: 24px; height: 24px; border: none; background: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
.pocket-item-remove:hover { color: #dc2626; }
</style>
