<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { getWidgetTypes } from '../widgets/registry.js'
import {
  getReport,
  updateReport,
  addSection,
  editSection,
} from '../api/community.js'

const route = useRoute()
const reportId = route.params.id

const title = ref('')
const abstract = ref('')
const visibility = ref('private')
const sections = ref([])   // { id, editor, content }
const saving = ref(false)
const error = ref(null)
const loading = ref(true)

// ── Widget insertion modal ──────────────────────────────────────
const showWidgetModal = ref(false)
const widgetTargetIndex = ref(null)
const widgetType = ref('')
const widgetEntityId = ref('')
const widgetTypes = getWidgetTypes()

function openWidgetModal(sectionIndex) {
  widgetTargetIndex.value = sectionIndex
  widgetType.value = widgetTypes[0]?.key || ''
  widgetEntityId.value = ''
  showWidgetModal.value = true
}

function insertWidget() {
  if (!widgetType.value || widgetTargetIndex.value === null) return
  const config = {
    widget_type: widgetType.value,
    schema_version: 1,
    entityId: widgetEntityId.value,
  }
  const marker = '\n```widget\n' + JSON.stringify(config) + '\n```\n'
  const sec = sections.value[widgetTargetIndex.value]
  if (sec?.editor) {
    sec.editor.commands.insertContent(marker)
  }
  showWidgetModal.value = false
}

// ── Editor helpers ──────────────────────────────────────────────
function createEditor(content = '') {
  return new Editor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your analysis here...' }),
    ],
    content,
  })
}

function addNewSection() {
  const editor = createEditor()
  sections.value.push({ id: null, editor, content: '' })
}

function removeSection(index) {
  const sec = sections.value[index]
  if (sec.editor) sec.editor.destroy()
  sections.value.splice(index, 1)
}

// ── Load report ─────────────────────────────────────────────────
onMounted(async () => {
  try {
    const report = await getReport(reportId)
    title.value = report.title || ''
    abstract.value = report.abstract || ''
    visibility.value = report.visibility || 'private'

    const reportSections = report.sections || []
    if (reportSections.length === 0) {
      addNewSection()
    } else {
      for (const sec of reportSections) {
        const editor = createEditor(sec.content || '')
        sections.value.push({ id: sec.id, editor, content: sec.content || '' })
      }
    }
  } catch (err) {
    error.value = err.message
    addNewSection()
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  for (const sec of sections.value) {
    if (sec.editor) sec.editor.destroy()
  }
})

// ── Save ────────────────────────────────────────────────────────
async function save() {
  saving.value = true
  error.value = null
  try {
    await updateReport(reportId, {
      title: title.value,
      abstract: abstract.value,
      visibility: visibility.value,
    })
    for (const sec of sections.value) {
      const html = sec.editor ? sec.editor.getHTML() : ''
      if (sec.id) {
        await editSection(reportId, sec.id, html)
      } else {
        const created = await addSection(reportId, html)
        if (created?.id) sec.id = created.id
      }
    }
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}


</script>

<template>
  <div class="report-editor" data-testid="report-editor">
    <!-- Header -->
    <div class="editor-header">
      <router-link to="/reports" class="back-link" data-testid="back-to-reports">
        &larr; Reports
      </router-link>
      <div class="header-actions">
        <select
          v-model="visibility"
          class="visibility-select"
          data-testid="visibility-select"
        >
          <option value="private">Private</option>
          <option value="shared">Shared</option>
          <option value="public">Public</option>
        </select>
        <button
          class="save-btn"
          :disabled="saving"
          data-testid="save-report"
          @click="save"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-bar" data-testid="editor-error">{{ error }}</div>

    <!-- Loading -->
    <div v-if="loading" class="loading-msg">Loading report...</div>

    <template v-else>
      <!-- Title -->
      <input
        v-model="title"
        type="text"
        class="title-input"
        placeholder="Report title"
        data-testid="report-title-input"
      />

      <!-- Abstract -->
      <textarea
        v-model="abstract"
        class="abstract-input"
        placeholder="Brief abstract..."
        rows="2"
        data-testid="report-abstract-input"
      />

      <!-- Sections -->
      <div
        v-for="(sec, idx) in sections"
        :key="idx"
        class="section-block"
        :data-testid="`section-${idx}`"
      >
        <div class="section-toolbar">
          <span class="section-label">Section {{ idx + 1 }}</span>
          <button
            class="toolbar-btn"
            data-testid="insert-widget-btn"
            @click="openWidgetModal(idx)"
          >
            Insert Widget
          </button>
          <button
            v-if="sections.length > 1"
            class="toolbar-btn danger"
            data-testid="remove-section-btn"
            @click="removeSection(idx)"
          >
            Remove
          </button>
        </div>
        <EditorContent :editor="sec.editor" class="tiptap-editor" />
      </div>

      <button
        class="add-section-btn"
        data-testid="add-section-btn"
        @click="addNewSection"
      >
        + Add section
      </button>
    </template>

    <!-- Widget insertion modal -->
    <div
      v-if="showWidgetModal"
      class="modal-overlay"
      data-testid="widget-modal"
      @click.self="showWidgetModal = false"
    >
      <div class="modal-content">
        <h3>Insert Widget</h3>
        <label class="modal-label">
          Type
          <select v-model="widgetType" data-testid="widget-type-select">
            <option v-for="wt in widgetTypes" :key="wt.key" :value="wt.key">
              {{ wt.label }}
            </option>
          </select>
        </label>
        <label class="modal-label">
          Entity ID
          <input
            v-model="widgetEntityId"
            type="text"
            placeholder="e.g. AAPL or UUID"
            data-testid="widget-entity-input"
          />
        </label>
        <div class="modal-actions">
          <button @click="showWidgetModal = false">Cancel</button>
          <button class="save-btn" data-testid="widget-insert-confirm" @click="insertWidget">
            Insert
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.report-editor {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.back-link {
  color: var(--accent);
  text-decoration: none;
  font-size: 0.85rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.visibility-select {
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.8rem;
  border-radius: 4px;
}

.save-btn {
  padding: 0.4rem 1rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-bar {
  padding: 0.5rem 0.75rem;
  margin-bottom: 1rem;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 4px;
  font-size: 0.8rem;
}

.loading-msg {
  color: var(--muted);
  font-size: 0.85rem;
  text-align: center;
  padding: 2rem 0;
}

.title-input {
  display: block;
  width: 100%;
  padding: 0.5rem 0;
  border: none;
  border-bottom: 2px solid var(--border);
  background: transparent;
  color: var(--text);
  font-size: 1.5rem;
  font-weight: 700;
  outline: none;
  margin-bottom: 0.75rem;
}

.title-input:focus {
  border-color: var(--accent);
}

.abstract-input {
  display: block;
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
  border-radius: 4px;
  resize: vertical;
  outline: none;
  margin-bottom: 1.5rem;
}

.abstract-input:focus {
  border-color: var(--accent);
}

.section-block {
  border: 1px solid var(--border);
  border-radius: 4px;
  margin-bottom: 1rem;
  background: var(--surface);
}

.section-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.section-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--muted);
  flex: 1;
}

.toolbar-btn {
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.7rem;
  border-radius: 3px;
  cursor: pointer;
}

.toolbar-btn.danger {
  color: #dc2626;
  border-color: #dc2626;
}

.tiptap-editor {
  padding: 0.75rem;
  min-height: 150px;
  font-size: 0.9rem;
  color: var(--text);
}

.tiptap-editor :deep(.tiptap) {
  outline: none;
  min-height: 120px;
}

.tiptap-editor :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: var(--muted);
  pointer-events: none;
  float: left;
  height: 0;
}

.tiptap-editor :deep(.tiptap h1) { font-size: 1.4rem; font-weight: 700; margin: 0.5rem 0; }
.tiptap-editor :deep(.tiptap h2) { font-size: 1.2rem; font-weight: 600; margin: 0.5rem 0; }
.tiptap-editor :deep(.tiptap h3) { font-size: 1.05rem; font-weight: 600; margin: 0.5rem 0; }
.tiptap-editor :deep(.tiptap ul),
.tiptap-editor :deep(.tiptap ol) { padding-left: 1.5rem; margin: 0.5rem 0; }
.tiptap-editor :deep(.tiptap code) { background: var(--bg); padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.85em; }
.tiptap-editor :deep(.tiptap pre) { background: var(--bg); padding: 0.75rem; border-radius: 4px; overflow-x: auto; }

.add-section-btn {
  display: block;
  width: 100%;
  padding: 0.6rem;
  border: 2px dashed var(--border);
  background: transparent;
  color: var(--muted);
  font-size: 0.85rem;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 2rem;
}

.add-section-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1.5rem;
  width: 90%;
  max-width: 400px;
}

.modal-content h3 {
  margin: 0 0 1rem;
  font-size: 1rem;
  color: var(--text);
}

.modal-label {
  display: block;
  margin-bottom: 0.75rem;
  font-size: 0.8rem;
  color: var(--muted);
}

.modal-label select,
.modal-label input {
  display: block;
  width: 100%;
  margin-top: 0.25rem;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 0.85rem;
  border-radius: 4px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.modal-actions button {
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.8rem;
  border-radius: 4px;
  cursor: pointer;
}
</style>
