<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { marked } from 'marked'
import WidgetRenderer from '../widgets/WidgetRenderer.vue'
import { getReport } from '../api/community.js'
import { sanitizeHtml } from '../utils/sanitize.js'

marked.setOptions({ breaks: true, gfm: true })

const route = useRoute()
const reportId = route.params.id

const report = ref(null)
const loading = ref(true)
const error = ref(null)

const hasToken = computed(() => !!localStorage.getItem('gmr-token'))

onMounted(async () => {
  try {
    report.value = await getReport(reportId)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
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
 * Parse section content for widget blocks (```widget\n{...}\n```)
 * and return an array of { type: 'html'|'widget', content|config }.
 * Supports both HTML (from TipTap) and markdown content.
 */
function parseSectionContent(content) {
  if (!content) return []

  // Convert markdown to HTML if needed
  let html = content
  if (isMarkdown(content)) {
    html = marked.parse(content)
  }

  const parts = []
  // Match widget blocks in various HTML wrappings
  const regex = /(?:<pre><code>)?```widget\n([\s\S]*?)\n```(?:<\/code><\/pre>)?/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'html', content: html.slice(lastIndex, match.index) })
    }
    try {
      const config = JSON.parse(match[1])
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
  <div class="report-view" data-testid="report-view">
    <!-- Loading -->
    <div v-if="loading" class="loading-msg">Loading report...</div>

    <!-- Error -->
    <div v-else-if="error" class="error-msg" data-testid="report-error">{{ error }}</div>

    <!-- Report content -->
    <template v-else-if="report">
      <div class="report-header">
        <router-link to="/reports" class="back-link" data-testid="back-to-reports">
          &larr; Reports
        </router-link>
        <router-link
          v-if="hasToken"
          :to="`/reports/${reportId}/edit`"
          class="edit-btn"
          data-testid="edit-report-btn"
        >
          Edit
        </router-link>
      </div>

      <h1 class="report-title" data-testid="report-title">{{ report.title }}</h1>

      <div class="report-meta" data-testid="report-meta">
        <span v-if="report.author">{{ report.author.name || report.author }}</span>
        <span v-if="report.created_at">&middot; {{ formatDate(report.created_at) }}</span>
        <span
          class="visibility-badge"
          :class="`badge-${report.visibility || 'private'}`"
        >
          {{ report.visibility || 'private' }}
        </span>
      </div>

      <p v-if="report.abstract" class="report-abstract" data-testid="report-abstract">
        {{ report.abstract }}
      </p>

      <!-- Sections -->
      <div
        v-for="(sec, idx) in (report.sections || [])"
        :key="sec.id || idx"
        class="report-section"
        :data-testid="`report-section-${idx}`"
      >
        <template v-for="(part, pi) in parseSectionContent(sec.content)" :key="pi">
          <div v-if="part.type === 'html'" class="section-html" v-html="sanitizeHtml(part.content)" />
          <WidgetRenderer v-else-if="part.type === 'widget'" :config="part.config" />
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.report-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
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

.badge-public { background: #d1fae5; color: #065f46; }
.badge-shared { background: #dbeafe; color: #1e40af; }
.badge-private { background: #f3f4f6; color: #6b7280; }

.report-abstract {
  font-size: 0.95rem;
  color: var(--muted);
  line-height: 1.6;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

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
