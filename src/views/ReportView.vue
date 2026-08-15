<script setup>
import { isAuthed } from '../api/session.js'
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute } from 'vue-router'
import { marked } from 'marked'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Image } from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { Underline } from '@tiptap/extension-underline'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { WidgetNode } from '../extensions/WidgetNode.js'
import { EntityMention } from '../extensions/EntityMention.js'
import WidgetRenderer from '../widgets/WidgetRenderer.vue'
import ChapterRail from '../components/ChapterRail.vue'
import FlowerButton from '../components/FlowerButton.vue'
import TranslationBar from '../components/TranslationBar.vue'
import EntitySidePanel from '../components/EntitySidePanel.vue'
import AuthorCard from '../components/AuthorCard.vue'
import { getReport, getTranslation, getUserProfile } from '../api/community.js'
import { fetchNutsRegions } from '../api/geo.js'
import { useLang } from '../composables/useLang.js'
import { defaultTranslationFor } from '../utils/translationDefault.js'
import { sanitizeHtml } from '../utils/sanitize.js'
import { tallyTiptap, tallyLegacySections, minutesFromTally } from '../utils/readingTime.js'

marked.setOptions({ breaks: true, gfm: true })

const route = useRoute()
const reportId = route.params.id

const report = ref(null)
const loading = ref(true)
const isV2 = ref(false)
let readOnlyEditor = null
const error = ref(null)
const author = ref(null)
const regionNames = ref({})

// `bodyRef` points at the rendered story body — the ChapterRail uses
// it to extract h2/h3 chapters and observe scroll position. `bodyVersion`
// bumps each time we swap content (load → first paint, edit return)
// so the rail re-extracts.
const bodyRef = ref(null)
const bodyVersion = ref(0)

const hasToken = computed(() => isAuthed.value)
const { lang: uiLang } = useLang()

// ── translations ────────────────────────────────────────────
// '' = the original text; otherwise the active translation object
// {lang, title, abstract, content_doc, outdated}. Swapping languages
// re-points the read-only editor at the corresponding document.
const activeLang = ref('')
const activeTranslation = ref(null)
// A translation whose source moved after it was written is not shown at
// all — we fall back to the original text and say so. Keeping the picker
// on the chosen language (rather than snapping back) makes the fallback
// legible: you see what you asked for, and why you did not get it.
const translationStale = computed(() => !!(activeLang.value && activeTranslation.value?.outdated))
const displayTitle = computed(() => (translationStale.value
  ? report.value?.title
  : activeTranslation.value?.title || report.value?.title))
const regionName = computed(() => {
  const code = report.value?.nuts_region
  return code ? (regionNames.value[code] || code) : ''
})
const displayAbstract = computed(() => (activeLang.value && !translationStale.value
  ? activeTranslation.value?.abstract
  : report.value?.abstract))

// Estimated reading time (minutes) for the *currently displayed* content —
// the active translation's doc when one is selected, else the original.
// Computed from the document model (see utils/readingTime.js), so it stays
// correct across language switches with no persistence or DOM measurement.
const readingMinutes = computed(() => {
  const r = report.value
  if (!r) return 0
  const tr = activeLang.value && !translationStale.value ? activeTranslation.value : null
  const doc = (tr?.content_doc?.version === 2 && tr.content_doc.tiptap)
    || (r.content_doc?.version === 2 && r.content_doc.tiptap)
  const tally = doc ? tallyTiptap(doc) : tallyLegacySections(r.sections || [])
  return minutesFromTally(tally)
})

async function switchLanguage(lang) {
  if (lang === activeLang.value) return
  try {
    if (!lang) {
      activeTranslation.value = null
      activeLang.value = ''
      if (readOnlyEditor && report.value.content_doc?.version === 2) {
        readOnlyEditor.commands.setContent(report.value.content_doc.tiptap)
      }
    } else {
      const t = await getTranslation(reportId, lang)
      activeTranslation.value = t
      activeLang.value = lang
      // Stale translation -> show the ORIGINAL document, never the drifted one.
      const doc = t.outdated ? report.value.content_doc : t.content_doc
      if (readOnlyEditor && doc?.version === 2) {
        readOnlyEditor.commands.setContent(doc.tiptap)
      }
    }
    requestAnimationFrame(() => { bodyVersion.value += 1 })
  } catch (err) {
    // The switch did not happen, so say so and put the picker back where
    // the content actually is. Leaving `activeLang` on the old value while
    // the <select> shows the new one is how TRANS-01 failed: a Portuguese
    // picker above an English title, and an error nobody looked at.
    error.value = err.status === 429
      ? 'Too many requests just now — try that language again in a moment.'
      : err.message
    if (typeof console !== 'undefined') {
      console.warn(`[report] language switch to ${lang} failed`, err)
    }
    activeLang.value = activeLang.value || ''
  }
}

onMounted(async () => {
  try {
    report.value = await getReport(reportId)
    if (report.value.nuts_region) {
      fetchNutsRegions()
        .then((d) => {
          const m = {}
          for (const r of d?.regions || []) m[r.code] = r.name
          regionNames.value = m
        })
        .catch(() => { /* region name resolution is optional */ })
    }
    // Fetch the author's public profile for the byline + author card
    // (non-blocking — the article renders without waiting on it).
    if (report.value.created_by) {
      getUserProfile(report.value.created_by)
        .then((p) => { author.value = p })
        .catch(() => { /* author card just won't render */ })
    }
    // v2 stories use a read-only TipTap editor for rendering
    // (supports widget nodes).
    if (report.value.content_doc?.version === 2) {
      isV2.value = true
      readOnlyEditor = new Editor({
        editable: false,
        extensions: [
          StarterKit, Image,
          // Same protocol allow-list as the editor (security review
          // finding #9). Pinning so href schemes in rendered stories
          // can't drift past http/https/mailto if Tiptap relaxes
          // its defaults in a future minor.
          Link.configure({ protocols: ['http', 'https', 'mailto'] }),
          Underline,
          Table, TableRow, TableCell, TableHeader,
          WidgetNode,
          // EntityMention is editable: false-aware — chips render
          // identically in read mode but the inline `×` button hides
          // (see EntityMentionView).
          EntityMention,
        ],
        content: report.value.content_doc.tiptap,
      })
    }
    // Open in the reader's UI language when that translation exists;
    // fall back to the original otherwise.
    const preferred = defaultTranslationFor(
      uiLang.value, report.value.language || 'en', report.value.translations)
    if (preferred) await switchLanguage(preferred)
    // Defer one tick so the body element exists in the DOM before
    // ChapterRail's `onMounted` runs. The rail reads h2/h3 nodes
    // synchronously; without the bump it would see an empty body.
    requestAnimationFrame(() => { bodyVersion.value += 1 })
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  if (readOnlyEditor) readOnlyEditor.destroy()
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

/**
 * Detect if content is markdown (vs. HTML).
 * Content from TipTap starts with <p>, <h1>, etc. Markdown starts with plain text.
 */
function isMarkdown(content) {
  if (!content) return false
  const trimmed = content.trim()
  // If it starts with an HTML tag, it's likely HTML from TipTap
  if (/^<[a-z][\s\S]*>/i.test(trimmed)) return false
  // If it has markdown indicators, treat as markdown
  if (/^#{1,6}\s|^\*\*|^- |^\d+\.\s|^\|.*\|/m.test(trimmed)) return true
  // If it has no HTML tags at all, treat as markdown
  if (!/<[a-z][\s\S]*?>/i.test(trimmed)) return true
  return false
}

/**
 * Unescape HTML entities that marked.parse() introduces inside code blocks.
 */
function unescapeHtml(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
}

/**
 * Parse section content for widget blocks and return an array of
 * { type: 'html'|'widget', content|config }.
 *
 * Widget syntax: ```widget\n{JSON}\n```
 *
 * After marked.parse(), this becomes:
 *   <pre><code class="language-widget">{HTML-escaped JSON}\n</code></pre>
 *
 * We match both the raw markdown form (TipTap HTML mode) and the
 * marked-rendered form (markdown mode).
 */
function parseSectionContent(content) {
  if (!content) return []

  let html = content
  if (isMarkdown(content)) {
    html = marked.parse(content)
  }

  // Match both forms:
  // 1. Raw markdown:  ```widget\n{...}\n```
  // 2. marked HTML:   <pre><code class="language-widget">{...}\n</code></pre>
  const regex = /(?:<pre><code class="language-widget">)([\s\S]*?)(?:<\/code><\/pre>)|```widget\n([\s\S]*?)\n```/g

  const parts = []
  let lastIndex = 0
  let match

  while ((match = regex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'html', content: html.slice(lastIndex, match.index) })
    }
    const raw = (match[1] || match[2] || '').trim()
    try {
      const config = JSON.parse(unescapeHtml(raw))
      parts.push({ type: 'widget', config })
    } catch {
      parts.push({ type: 'html', content: match[0] })
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < html.length) {
    parts.push({ type: 'html', content: html.slice(lastIndex) })
  }
  return parts.length ? parts : [{ type: 'html', content: html }]
}
</script>

<template>
  <div class="report-view" data-testid="story-view">
    <!-- Loading -->
    <div v-if="loading" class="loading-msg">{{ $t('app.loading_story') }}</div>

    <!-- Error -->
    <div v-else-if="error" class="error-msg" data-testid="story-error">{{ error }}</div>

    <!-- Story content -->
    <template v-else-if="report">
      <div class="report-header">
        <router-link to="/" class="back-link" data-testid="back-to-feed">
          {{ $t('nav.back_stories') }}
        </router-link>
        <router-link
          v-if="hasToken"
          :to="`/stories/${reportId}/edit`"
          class="edit-btn"
          data-testid="edit-story-btn"
        >{{ $t('report.edit') }}</router-link>
      </div>

      <h1 class="report-title" data-testid="story-title">{{ displayTitle }}</h1>

      <div class="report-meta" data-testid="story-meta">
        <span v-if="author && author.name" class="report-byline">
          {{ $t('article.by') }}
          <RouterLink
            :to="`/users/${report.created_by}`"
            class="report-author-link"
            data-testid="story-author-link"
          >{{ author.name }}</RouterLink>
        </span>
        <span v-if="report.created_at">&middot; {{ formatDate(report.created_at) }}</span>
        <span class="reading-time" data-testid="story-reading-time">&middot; {{ $t('report.reading_time', { n: readingMinutes }) }}</span>
        <span
          class="visibility-badge"
          :class="`badge-${report.visibility || 'private'}`"
        >
          {{ report.visibility ? $t(`app.${report.visibility}`) : $t('app.private') }}
        </span>
        <span v-if="regionName" class="region-chip" data-testid="story-region">
          <span aria-hidden="true">📍</span> {{ regionName }}
        </span>
      </div>

      <TranslationBar
        :language="report.language || 'en'"
        :translations="report.translations || []"
        :current="activeLang"
        @switch="switchLanguage"
      />

      <!-- The chosen translation is out of date, so the original text is
           rendered instead. Say so plainly rather than showing stale facts. -->
      <p
        v-if="translationStale"
        class="stale-translation"
        data-testid="stale-translation-notice"
        role="status"
      >
        {{ $t('translations.stale_fallback', { lang: activeLang.toUpperCase() }) }}
      </p>

      <p v-if="displayAbstract" class="report-abstract" data-testid="story-abstract">
        {{ displayAbstract }}
      </p>

      <!-- Two-column layout: chapter rail + story body. Rail
           hides under 1024px (see ChapterRail.vue). -->
      <div class="story-layout">
        <div ref="bodyRef" class="story-body-col" data-testid="story-body">
          <!-- v2: TipTap JSON rendered via read-only editor (supports widget nodes) -->
          <div v-if="isV2" class="report-body" data-testid="report-section-0">
            <EditorContent v-if="readOnlyEditor" :editor="readOnlyEditor" class="report-tiptap" />
          </div>

          <!-- v1: Legacy section-based rendering -->
          <div
            v-for="(sec, idx) in (report.sections || [])"
            v-else
            :key="sec.id || idx"
            class="report-section"
            :data-testid="`report-section-${idx}`"
          >
            <template v-for="(part, pi) in parseSectionContent(sec.content)" :key="pi">
              <!-- eslint-disable-next-line vue/no-v-html -- content sanitized via DOMPurify in sanitizeHtml (src/utils/sanitize.js) -->
              <div v-if="part.type === 'html'" class="section-html" v-html="sanitizeHtml(part.content)" />
              <WidgetRenderer v-else-if="part.type === 'widget'" :config="part.config" />
            </template>
          </div>

          <!-- Story footer: clap (flower) lives below the body so a
               reader who actually finished reading is the one who
               taps it. Only rendered for publicly-clappable
               visibilities; private + group stories don't show it. -->
          <div
            v-if="reportId && (report.visibility === 'public_open' || report.visibility === 'public_auth')"
            class="story-footer"
            data-testid="story-footer"
          >
            <FlowerButton :report-id="reportId" />
          </div>

          <AuthorCard
            v-if="author && author.name && report.created_by"
            :author="author"
            :user-id="report.created_by"
          />
        </div>

        <ChapterRail :body-ref="bodyRef" :version="bodyVersion" />
      </div>

      <!-- Side panel listens for `entity-mention-click` from any chip
           and resolves the IRI on demand. Mounted at the view level
           so chips inside any inner component (editor, widget) can
           open it. -->
      <EntitySidePanel />
    </template>
  </div>
</template>

<style scoped>
.region-chip { opacity: 0.8; }

.report-view {
  max-width: 1080px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

/* Two-column layout: story body fills the remaining width, chapter
   rail sits to the right (collapses under 1024px — see ChapterRail). */
.story-layout {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}
.story-body-col {
  flex: 1;
  min-width: 0; /* prevent flex item from blowing past max-width */
  max-width: 800px;
}

.loading-msg,
.error-msg {
  text-align: center;
  padding: 2rem 0;
  font-size: 0.85rem;
}

.loading-msg { color: var(--muted); }
.error-msg { color: #dc2626; }

.report-header {
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

.edit-btn {
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--accent);
  color: var(--accent);
  text-decoration: none;
  font-size: 0.8rem;
  border-radius: 4px;
}

.report-title {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 0.5rem;
  line-height: 1.2;
}

.report-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--muted);
  margin-bottom: 1rem;
}

.visibility-badge {
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-public_open { background: #d1fae5; color: #065f46; }
.badge-public_auth { background: #dbeafe; color: #1e40af; }
.badge-group { background: #dbeafe; color: #1e40af; }
.badge-private { background: #f3f4f6; color: #6b7280; }
/* Legacy values kept so historical reports still render a styled pill. */
.badge-public { background: #d1fae5; color: #065f46; }
.badge-shared { background: #dbeafe; color: #1e40af; }

.report-abstract {
  font-size: 0.95rem;
  color: var(--muted);
  line-height: 1.6;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

.report-body { margin-bottom: 1.5rem; }
.report-tiptap { font-size: 0.9rem; line-height: 1.7; color: var(--text); }

/* Footer sits below the body so the clap reads as "I finished
   reading and want to thank the author" rather than a metadata
   chip. Centred and visually separated from the running text. */
.story-footer {
  display: flex;
  justify-content: center;
  padding-top: 1.5rem;
  margin-top: 1.5rem;
  border-top: 1px solid var(--border);
}
.report-tiptap :deep(.tiptap) { outline: none; }
.report-tiptap :deep(.tiptap h1) { font-size: 1.4rem; font-weight: 700; margin: 1rem 0 0.5rem; }
.report-tiptap :deep(.tiptap h2) { font-size: 1.2rem; font-weight: 600; margin: 1rem 0 0.5rem; }
.report-tiptap :deep(.tiptap h3) { font-size: 1.05rem; font-weight: 600; margin: 0.75rem 0; }
.report-tiptap :deep(.tiptap img) { max-width: 100%; height: auto; border-radius: 4px; }
.report-tiptap :deep(.tiptap table) { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
.report-tiptap :deep(.tiptap th), .report-tiptap :deep(.tiptap td) { border: 1px solid var(--border); padding: 0.4rem 0.6rem; font-size: 0.85rem; }
.report-tiptap :deep(.tiptap th) { background: var(--bg); font-weight: 600; }
.report-tiptap :deep(.tiptap blockquote) { border-left: 3px solid var(--accent); padding-left: 0.75rem; color: var(--muted); }
.report-tiptap :deep(.tiptap a) { color: var(--accent); text-decoration: underline; }

.report-section {
  margin-bottom: 1.5rem;
}

.section-html {
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--text);
}

.section-html :deep(h1) { font-size: 1.4rem; font-weight: 700; margin: 1rem 0 0.5rem; }
.section-html :deep(h2) { font-size: 1.2rem; font-weight: 600; margin: 1rem 0 0.5rem; }
.section-html :deep(h3) { font-size: 1.05rem; font-weight: 600; margin: 0.75rem 0 0.4rem; }
.section-html :deep(ul),
.section-html :deep(ol) { padding-left: 1.5rem; margin: 0.5rem 0; }
.section-html :deep(code) { background: var(--bg); padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.85em; }
.section-html :deep(pre) { background: var(--bg); padding: 0.75rem; border-radius: 4px; overflow-x: auto; }
.section-html :deep(a) { color: var(--accent); }
.section-html :deep(blockquote) { border-left: 3px solid var(--border); padding-left: 1rem; color: var(--muted); margin: 0.5rem 0; }
</style>

<style scoped>
/* Same amber vocabulary as the picker's outdated badge, at notice weight. */
.stale-translation {
  margin: 0.5rem 0 0.9rem;
  padding: 0.55rem 0.8rem;
  border: 1px solid #f59e0b;
  border-left-width: 4px;
  border-radius: 6px;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.87rem;
}
:global(html.dark) .stale-translation {
  background: #451a03;
  color: #fbbf24;
  border-color: #b45309;
}
</style>
