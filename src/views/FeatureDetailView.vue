<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import ThemeToggle from '../components/ThemeToggle.vue'
import { features, categories, statusColors } from '../data/roadmap-features.js'

const route = useRoute()

const feature = computed(() => features.find((f) => f.id === route.params.id))
const featureIndex = computed(() => features.findIndex((f) => f.id === route.params.id))
const prevFeature = computed(() => featureIndex.value > 0 ? features[featureIndex.value - 1] : null)
const nextFeature = computed(() => featureIndex.value < features.length - 1 ? features[featureIndex.value + 1] : null)

function setTitle() {
  const f = feature.value
  document.title = f ? `${f.title} — Roadmap — GMR` : 'Feature Not Found — GMR'
}

onMounted(setTitle)
watch(() => route.params.id, setTitle)
</script>

<template>
  <div class="fd">
    <nav class="fd-nav">
      <div class="fd-nav__header">
        <router-link to="/admin/roadmap" class="fd-back">&larr; Roadmap</router-link>
        <h2>Features</h2>
      </div>

      <div class="fd-nav__section">
        <router-link
          v-for="f in features"
          :key="f.id"
          :to="`/admin/roadmap/${f.id}`"
          class="fd-nav__link"
          :class="{ active: route.params.id === f.id }"
        >
          <span class="fd-nav__dot" :style="{ background: statusColors[f.status]?.bg }"></span>
          {{ f.title }}
        </router-link>
      </div>
    </nav>

    <main v-if="feature" class="fd-main">
      <div class="fd-header">
        <div>
          <div class="fd-header__top">
            <span class="fd-cat">{{ categories[feature.category]?.label }}</span>
            <span
              class="fd-status"
              :style="{ background: statusColors[feature.status]?.bg, color: statusColors[feature.status]?.text }"
            >{{ feature.status }}</span>
          </div>
          <h1>{{ feature.title }}</h1>
        </div>
        <ThemeToggle />
      </div>

      <!-- Meta bar -->
      <div class="fd-meta">
        <div v-if="feature.source" class="fd-meta__item">
          <span class="fd-meta__label">Source</span>
          <a v-if="feature.sourceUrl" :href="feature.sourceUrl" target="_blank" rel="noopener">{{ feature.source }}</a>
          <span v-else>{{ feature.source }}</span>
        </div>
        <div v-if="feature.format" class="fd-meta__item">
          <span class="fd-meta__label">Format</span>
          <span>{{ feature.format }}</span>
        </div>
        <div v-if="feature.coverage" class="fd-meta__item">
          <span class="fd-meta__label">Coverage</span>
          <span>{{ feature.coverage }}</span>
        </div>
        <div v-if="feature.effort" class="fd-meta__item">
          <span class="fd-meta__label">Effort</span>
          <span>{{ feature.effort }}</span>
        </div>
      </div>

      <!-- Impact callout -->
      <div class="fd-impact">
        <strong>Impact:</strong> {{ feature.impact }}
      </div>

      <!-- Full description (rendered as HTML from markdown-ish content) -->
      <div class="fd-body" v-html="renderDescription(feature.description)"></div>

      <!-- Prev/Next navigation -->
      <div class="fd-pager">
        <router-link v-if="prevFeature" :to="`/admin/roadmap/${prevFeature.id}`" class="fd-pager__link">
          &larr; {{ prevFeature.title }}
        </router-link>
        <span v-else></span>
        <router-link v-if="nextFeature" :to="`/admin/roadmap/${nextFeature.id}`" class="fd-pager__link">
          {{ nextFeature.title }} &rarr;
        </router-link>
      </div>
    </main>

    <main v-else class="fd-main">
      <div class="fd-header">
        <h1>Feature not found</h1>
        <ThemeToggle />
      </div>
      <p>
        No feature with ID "{{ route.params.id }}".
        <router-link to="/admin/roadmap">Back to roadmap</router-link>
      </p>
    </main>
  </div>
</template>

<script>
// Lightweight markdown-ish renderer for feature descriptions.
// Supports: ## headings, ### headings, ```code blocks```, **bold**,
// `inline code`, [links](url), |tables|, and paragraphs.
function renderDescription(md) {
  if (!md) return ''
  const lines = md.split('\n')
  let html = ''
  let inCode = false
  let inTable = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Code blocks
    if (trimmed.startsWith('```')) {
      if (inCode) {
        html += '</code></pre>'
        inCode = false
      } else {
        html += '<pre class="fd-code"><code>'
        inCode = true
      }
      continue
    }
    if (inCode) {
      html += escapeHtml(line) + '\n'
      continue
    }

    // Close table if leaving table rows
    if (inTable && !trimmed.startsWith('|')) {
      html += '</tbody></table>'
      inTable = false
    }

    // Empty line
    if (!trimmed) {
      html += '</p><p>'
      continue
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      html += `<h4>${inline(trimmed.slice(4))}</h4>`
      continue
    }
    if (trimmed.startsWith('## ')) {
      html += `<h3>${inline(trimmed.slice(3))}</h3>`
      continue
    }

    // Table
    if (trimmed.startsWith('|')) {
      const cells = trimmed.split('|').filter(Boolean).map((c) => c.trim())
      // Skip separator rows
      if (cells.every((c) => /^[-:]+$/.test(c))) continue
      if (!inTable) {
        html += '<table class="fd-table"><thead><tr>'
        cells.forEach((c) => { html += `<th>${inline(c)}</th>` })
        html += '</tr></thead><tbody>'
        inTable = true
      } else {
        html += '<tr>'
        cells.forEach((c) => { html += `<td>${inline(c)}</td>` })
        html += '</tr>'
      }
      continue
    }

    // Regular paragraph line
    html += inline(trimmed) + ' '
  }

  if (inCode) html += '</code></pre>'
  if (inTable) html += '</tbody></table>'

  return `<p>${html}</p>`
    .replace(/<p><\/p>/g, '')
    .replace(/<p>\s*<h/g, '<h')
    .replace(/<\/h(\d)>\s*<\/p>/g, '</h$1>')
    .replace(/<p>\s*<pre/g, '<pre')
    .replace(/<\/pre>\s*<\/p>/g, '</pre>')
    .replace(/<p>\s*<table/g, '<table')
    .replace(/<\/table>\s*<\/p>/g, '</table>')
}

function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default { methods: { renderDescription } }
</script>

<style scoped>
.fd { display: flex; min-height: 100vh; }

/* ── Nav ──────────────────────────────── */
.fd-nav { width: 250px; flex-shrink: 0; padding: 1.5rem 0.75rem; border-right: 1px solid var(--border); background: var(--surface); position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.fd-nav__header { margin-bottom: 1rem; padding: 0 0.5rem; }
.fd-nav__header h2 { font-size: 1rem; font-weight: 700; margin-top: 0.25rem; }
.fd-back { font-size: 0.78rem; color: var(--accent); text-decoration: none; }
.fd-nav__section { display: flex; flex-direction: column; gap: 1px; }
.fd-nav__link { display: flex; align-items: center; gap: 5px; padding: 4px 8px; font-size: 0.72rem; color: var(--muted); text-decoration: none; border-radius: 3px; line-height: 1.3; }
.fd-nav__link:hover { color: var(--text); background: var(--bg); }
.fd-nav__link.active, .fd-nav__link.router-link-active { color: var(--accent); font-weight: 600; background: var(--bg); }
.fd-nav__dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

/* ── Main ─────────────────────────────── */
.fd-main { flex: 1; max-width: 780px; padding: 1.5rem 2rem 4rem; }
.fd-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
.fd-header h1 { font-size: 1.3rem; font-weight: 800; margin-top: 6px; }
.fd-header__top { display: flex; gap: 8px; align-items: center; margin-bottom: 2px; }
.fd-cat { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); font-weight: 600; }
.fd-status { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; padding: 2px 8px; border-radius: 10px; }

/* Meta */
.fd-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin-bottom: 1rem; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; font-size: 0.8rem; }
.fd-meta__item { display: flex; gap: 6px; }
.fd-meta__label { font-weight: 600; color: var(--muted); white-space: nowrap; }
.fd-meta a { color: var(--accent); text-decoration: none; }
.fd-meta a:hover { text-decoration: underline; }

/* Impact */
.fd-impact { font-size: 0.84rem; line-height: 1.5; padding: 10px 14px; background: var(--surface); border-left: 3px solid var(--accent); border-radius: 0 6px 6px 0; margin-bottom: 1.5rem; }

/* Body (rendered markdown) */
.fd-body { font-size: 0.85rem; line-height: 1.65; color: var(--text); }
.fd-body :deep(h3) { font-size: 1.05rem; font-weight: 700; margin: 1.5rem 0 0.6rem; padding-bottom: 0.25rem; border-bottom: 1px solid var(--border); }
.fd-body :deep(h4) { font-size: 0.9rem; font-weight: 600; margin: 1.2rem 0 0.4rem; }
.fd-body :deep(p) { margin-bottom: 0.6rem; }
.fd-body :deep(strong) { font-weight: 600; }
.fd-body :deep(code) { font-size: 0.8em; background: var(--surface); border: 1px solid var(--border); padding: 1px 4px; border-radius: 3px; font-family: 'SFMono-Regular', Consolas, monospace; }
.fd-body :deep(a) { color: var(--accent); text-decoration: none; }
.fd-body :deep(a:hover) { text-decoration: underline; }
.fd-body :deep(.fd-code) { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 12px 16px; overflow-x: auto; margin: 8px 0 12px; font-size: 0.78rem; line-height: 1.5; }
.fd-body :deep(.fd-code code) { background: none; border: none; padding: 0; }
.fd-body :deep(.fd-table) { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 0.8rem; }
.fd-body :deep(.fd-table th) { background: var(--surface); text-align: left; padding: 6px 10px; border: 1px solid var(--border); font-weight: 600; }
.fd-body :deep(.fd-table td) { padding: 5px 10px; border: 1px solid var(--border); }

/* Pager */
.fd-pager { display: flex; justify-content: space-between; margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid var(--border); }
.fd-pager__link { font-size: 0.82rem; color: var(--accent); text-decoration: none; }
.fd-pager__link:hover { text-decoration: underline; }

@media (max-width: 768px) {
  .fd { flex-direction: column; }
  .fd-nav { width: 100%; height: auto; position: static; border-right: none; border-bottom: 1px solid var(--border); }
  .fd-nav__section { flex-direction: row; flex-wrap: wrap; gap: 2px; }
  .fd-main { padding: 1rem; }
  .fd-meta { grid-template-columns: 1fr; }
}
</style>
