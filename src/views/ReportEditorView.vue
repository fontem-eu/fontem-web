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
import { useI18n } from 'vue-i18n'
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
import ArticleQualityEvaluator from '../components/ArticleQualityEvaluator.vue'
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
  listDossiers,
  addDossierArticle,
  listInvestigations,
  addInvestigationStory,
  listVisualizations,
  getTranslation,
  saveTranslation,
  resolveTranslation,
} from '../api/community.js'
import { canContribute } from '../utils/investigationRole.js'
import TagEditor from '../components/TagEditor.vue'
import NutsRegionPicker from '../components/NutsRegionPicker.vue'
import { fetchNutsRegions } from '../api/geo.js'
import TranslationControls from '../components/TranslationControls.vue'

const route = useRoute()
const { t } = useI18n()
const reportId = route.params.id

// ── Add to dossier ──────────────────────────────────────────
const showDossierPicker = ref(false)
const dossierOptions = ref([])
const dossierAddStatus = ref(null)
async function openDossierPicker() {
  dossierAddStatus.value = null
  try {
    dossierOptions.value = (await listDossiers()) || []
    showDossierPicker.value = true
  } catch (err) {
    dossierAddStatus.value = err.message
  }
}
async function addToDossier(dossierId) {
  try {
    await addDossierArticle(dossierId, reportId)
    showDossierPicker.value = false
    dossierAddStatus.value = 'added'
  } catch (err) {
    dossierAddStatus.value = err.message
  }
}

// ── Add to investigation (M4) ───────────────────────────────
const showInvestigationPicker = ref(false)
const investigationOptions = ref([])
const investigationAddStatus = ref(null)
async function openInvestigationPicker() {
  investigationAddStatus.value = null
  try {
    const all = (await listInvestigations()) || []
    // Only investigations where the current user may add stories (write cap or
    // owner) — the others would 403 server-side.
    investigationOptions.value = all.filter((i) => canContribute(i.membership))
    showInvestigationPicker.value = true
  } catch (err) {
    investigationAddStatus.value = err.message
  }
}
async function addToInvestigation(investigationId) {
  try {
    await addInvestigationStory(investigationId, reportId)
    showInvestigationPicker.value = false
    investigationAddStatus.value = 'added'
  } catch (err) {
    investigationAddStatus.value = err.message
  }
}

const title = ref('')
const abstract = ref('')
const visibility = ref('private')
const nutsRegion = ref('')
const regionNames = ref({})
const tags = ref([])
const saving = ref(false)

// ── translations ────────────────────────────────────────────
// transLang '' = editing the original. Switching languages swaps the
// title/abstract/body in place; per-language drafts are cached so a
// round-trip doesn't destroy unsaved work. A missing translation
// prefills from the original so the translator starts from the text.
const storyLanguage = ref('en')
const translations = ref([])          // [{lang, outdated}]
const transLang = ref('')
const draftCache = new Map()          // lang ('' = original) -> {title, abstract, doc}

function snapshotCurrent() {
  draftCache.set(transLang.value, {
    title: title.value, abstract: abstract.value, doc: editor ? editor.getJSON() : null,
  })
}

async function switchTranslation(lang) {
  if (lang === transLang.value) return
  snapshotCurrent()
  let draft = draftCache.get(lang)
  if (!draft && lang) {
    try {
      const t = await getTranslation(reportId, lang)
      draft = { title: t.title, abstract: t.abstract || '', doc: t.content_doc?.tiptap || null }
    } catch {
      // No translation yet — prefill from the original so the
      // translator has the full text to work over.
      const base = draftCache.get('') || {}
      draft = { title: base.title || '', abstract: base.abstract || '', doc: base.doc || null }
    }
  }
  if (!draft) draft = { title: '', abstract: '', doc: null }
  transLang.value = lang
  title.value = draft.title
  abstract.value = draft.abstract
  if (editor && draft.doc) editor.commands.setContent(draft.doc)
  requestAnimationFrame(() => { bodyVersion.value += 1 })
}

async function resolveOutdated() {
  try {
    await resolveTranslation(reportId, transLang.value)
    translations.value = translations.value.map((t) =>
      (t.lang === transLang.value ? { ...t, outdated: false } : t))
    toast.success('Translation marked up to date')
  } catch (err) {
    error.value = err.message
  }
}
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
const articleInvestigationId = ref(null)
const investigationViz = ref([])

async function openPocketModal() {
  refreshPocket()
  investigationViz.value = []
  if (articleInvestigationId.value) {
    // Articles in an investigation can also insert that investigation's saved
    // visualizations, not just the browser-local pocket. Failure here is
    // non-fatal — the pocket source still works.
    try {
      investigationViz.value = (await listVisualizations(articleInvestigationId.value)) || []
    } catch { /* ignore */ }
  }
  showPocketModal.value = true
}

function insertFromPocket(item) {
  if (!editor) return
  // Carry every attr the widget needs into the node. WidgetNode only
  // persists declared attrs, so each must be set explicitly here.
  const c = item.config || {}
  const attrs = { widget_type: item.widget_type, schema_version: 1 }
  const entityId = c.entityId || c.entity_id
  if (entityId) attrs.entityId = entityId
  if (c.depth) attrs.depth = c.depth
  if (c.dataset) attrs.dataset = c.dataset
  if (c.nuts_level !== undefined && c.nuts_level !== null) attrs.nuts_level = c.nuts_level
  if (c.year !== undefined && c.year !== null) attrs.year = c.year
  if (c.dimensions) attrs.dimensions = c.dimensions
  if (c.chart) attrs.chart = c.chart
  if (c.props) attrs.props = c.props
  // new viz abstraction: a recipe of params (grouped), not data.
  if (c.data_params) attrs.data_params = c.data_params
  if (c.ui_params) attrs.ui_params = c.ui_params
  editor.chain().focus().insertContent({ type: 'widget', attrs }).run()
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
      Placeholder.configure({ placeholder: t('report_editor.start_writing') }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({
        // Explicit protocol allow-list. Tiptap's defaults filter out
        // `javascript:` / `data:` today, but a future minor bump
        // could change that. Pinning here so we know exactly which
        // schemes we honour regardless of upstream churn. See the
        // 2026-06-11 security review, finding #9.
        protocols: ['http', 'https', 'mailto'],
        openOnClick: false,
        autolink: true,
      }),
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
    nutsRegion.value = report.nuts_region || ''
    tags.value = Array.isArray(report.tags) ? report.tags : []
    articleInvestigationId.value = report.investigation_id || null
    storyLanguage.value = report.language || 'en'
    translations.value = Array.isArray(report.translations) ? report.translations : []
    draftCache.set('', {
      title: report.title || '',
      abstract: report.abstract || '',
      doc: report.content_doc?.version === 2 ? report.content_doc.tiptap : null,
    })

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
  try {
    const data = await fetchNutsRegions()
    const map = {}
    for (const r of data?.regions || []) map[r.code] = r.name
    regionNames.value = map
  } catch { /* region name resolution is optional */ }
})

// Descriptive name of the selected region (or a placeholder) for the summary.
const regionDisplay = computed(() =>
  nutsRegion.value ? (regionNames.value[nutsRegion.value] || nutsRegion.value)
    : t('report_editor.region_none'))

onBeforeUnmount(() => {
  if (editor) editor.destroy()
})

// ── Save ────────────────────────────────────────────────────
async function save() {
  saving.value = true
  error.value = null
  // Translation mode: persist only the active language's text. Saving
  // pins the translation to the original's current version (the
  // outdated flag clears server-side; mirror it locally).
  if (transLang.value) {
    try {
      await saveTranslation(reportId, transLang.value, {
        title: title.value,
        abstract: abstract.value,
        tiptap: editor.getJSON(),
      })
      const lang = transLang.value
      const known = translations.value.some((t) => t.lang === lang)
      translations.value = known
        ? translations.value.map((t) => (t.lang === lang ? { ...t, outdated: false } : t))
        : [...translations.value, { lang, outdated: false }]
      draftCache.delete(lang)
      toast.success('Translation saved')
    } catch (err) {
      error.value = err.message
      toast.error(`Save failed: ${err.message}`, { durationMs: 0 })
    } finally {
      saving.value = false
    }
    return
  }
  try {
    await updateReport(reportId, {
      title: title.value,
      abstract: abstract.value,
      visibility: visibility.value,
      language: storyLanguage.value,
      nuts_region: nutsRegion.value,
    })
    // Tags persist via a separate endpoint (owner-only PUT). Server
    // re-normalises on its side, so the response here is the
    // canonical slug list — keep our `tags` ref in sync.
    const tagResp = await setStoryTags(reportId, tags.value)
    if (Array.isArray(tagResp?.tags)) tags.value = tagResp.tags
    await saveDocument(reportId, editor.getJSON())
    // The document save bumped content_version — every translation is
    // now potentially outdated until reviewed. Keep the local list honest.
    translations.value = translations.value.map((t) => ({ ...t, outdated: true }))
    draftCache.set('', { title: title.value, abstract: abstract.value, doc: editor.getJSON() })
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
        {{ $t('nav.back_my_stories') }}
      </router-link>
      <div class="header-actions">
        <TranslationControls
          :story-language="storyLanguage"
          :translations="translations"
          :current="transLang"
          @switch="switchTranslation"
          @resolve="resolveOutdated"
        />
        <select v-model="visibility" class="visibility-select" data-testid="visibility-select">
          <option value="private">{{ $t('report_editor.private_only_me') }}</option>
          <option value="public_auth">{{ $t('report_editor.signed_in_users') }}</option>
          <option value="public_open">{{ $t('report_editor.public_anyone') }}</option>
        </select>
        <details class="region-meta" data-testid="region-meta">
          <summary class="region-summary">
            {{ $t('report_editor.region_label') }}: <strong>{{ regionDisplay }}</strong>
          </summary>
          <div class="region-picker-wrap">
            <NutsRegionPicker v-model="nutsRegion" />
          </div>
        </details>
        <AssistPanel
          :report-context="reportContext"
          :report-id="reportId"
          :editor-state="{ editor, title: title, abstract: abstract }"
          @insert="onAssistInsert"
          @applied="onProposalApplied"
        />
        <button class="save-btn" data-testid="add-to-dossier-btn" @click="openDossierPicker">
          {{ $t('investigations.add_to_dossier') }}
        </button>
        <button class="save-btn" data-testid="add-to-investigation-btn" @click="openInvestigationPicker">
          {{ $t('investigations.add_to_investigation') }}
        </button>
        <button class="save-btn" :disabled="saving" data-testid="save-story" @click="save">
          {{ saving ? $t('report_editor.saving') : $t('report_editor.save') }}
        </button>
      </div>
    </div>

    <div v-if="error" class="error-bar" data-testid="editor-error">{{ error }}</div>
    <div v-if="loading" class="loading-msg">{{ $t('app.loading_story') }}</div>

    <template v-else>
      <!-- Title -->
      <input
        v-model="title"
        type="text"
        class="title-input"
        :placeholder="$t('report_editor.story_title')"
        data-testid="story-title-input"
      />

      <!-- Abstract -->
      <textarea
        v-model="abstract"
        class="abstract-input"
        :placeholder="$t('report_editor.brief_abstract')"
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

      <!-- Article-quality heuristics: on-demand reading-time + data/text
           balance, scored against the ~10-minute, data-first house style. -->
      <ArticleQualityEvaluator
        class="quality-panel"
        :get-doc="() => (editor ? editor.getJSON() : null)"
        data-testid="article-quality-panel"
      />

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

    <!-- Add-to-dossier picker -->
    <div
      v-if="showDossierPicker"
      class="modal-overlay"
      data-testid="dossier-picker"
      @click.self="showDossierPicker = false"
    >
      <div class="modal-content">
        <h3>{{ $t('investigations.add_to_dossier') }}</h3>
        <p v-if="!dossierOptions.length" class="pocket-empty">{{ $t('investigations.empty') }}</p>
        <ul v-else class="pocket-list" data-testid="dossier-picker-list">
          <li v-for="d in dossierOptions" :key="d.id" class="pocket-item">
            <div class="pocket-item-info" :data-testid="'dossier-pick-' + d.id" @click="addToDossier(d.id)">
              <span class="pocket-item-name">{{ d.name }}</span>
            </div>
          </li>
        </ul>
        <div class="modal-actions"><button @click="showDossierPicker = false">{{ $t('app.cancel') }}</button></div>
      </div>
    </div>

    <!-- Add-to-investigation picker -->
    <div
      v-if="showInvestigationPicker"
      class="modal-overlay"
      data-testid="investigation-picker"
      @click.self="showInvestigationPicker = false"
    >
      <div class="modal-content">
        <h3>{{ $t('investigations.add_to_investigation') }}</h3>
        <p v-if="!investigationOptions.length" class="pocket-empty">{{ $t('investigations.empty') }}</p>
        <ul v-else class="pocket-list" data-testid="investigation-picker-list">
          <li v-for="i in investigationOptions" :key="i.id" class="pocket-item">
            <div class="pocket-item-info" :data-testid="'investigation-pick-' + i.id" @click="addToInvestigation(i.id)">
              <span class="pocket-item-name">{{ i.name }}</span>
            </div>
          </li>
        </ul>
        <div class="modal-actions"><button @click="showInvestigationPicker = false">{{ $t('app.cancel') }}</button></div>
      </div>
    </div>

    <!-- Pocket picker modal -->
    <div
      v-if="showPocketModal"
      class="modal-overlay"
      data-testid="pocket-modal"
      @click.self="showPocketModal = false"
    >
      <div class="modal-content">
        <h3>{{ $t('report_editor.insert_widget') }}</h3>
        <template v-if="investigationViz.length">
          <h4 class="pocket-subhead" data-testid="inv-viz-heading">{{ $t('investigations.from_this_investigation') }}</h4>
          <ul class="pocket-list" data-testid="inv-viz-list">
            <li
              v-for="v in investigationViz"
              :key="v.id"
              class="pocket-item"
              :data-testid="'inv-viz-item-' + v.id"
            >
              <div class="pocket-item-info" @click="insertFromPocket(v)">
                <span class="pocket-item-type">{{ v.widget_type?.replace(/_/g, ' ') }}</span>
                <span class="pocket-item-name">{{ v.name }}</span>
              </div>
            </li>
          </ul>
          <h4 class="pocket-subhead">{{ $t('investigations.from_your_pocket') }}</h4>
        </template>
        <p v-if="!pocketItems.length" class="pocket-empty">
          {{ $t('report_editor.your_pocket_is_empty') }}
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
          <button @click="showPocketModal = false">{{ $t('report_editor.close') }}</button>
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
.region-meta { position: relative; font-size: 0.8rem; }
.region-summary { cursor: pointer; padding: 0.35rem 0.5rem; border: 1px solid var(--border); border-radius: 4px; background: var(--surface); color: var(--text); list-style: none; white-space: nowrap; }
.region-picker-wrap { position: absolute; z-index: 20; margin-top: 0.3rem; width: 240px; padding: 0.6rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); box-shadow: 0 6px 20px rgba(0,0,0,0.15); }
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
