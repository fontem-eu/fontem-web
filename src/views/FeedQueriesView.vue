<script setup>
/**
 * Admin: the named-query catalogue.
 *
 * A named query is an editorially-curated query that a feed subscription will
 * point at. This screen is where one is authored, run against the real stores,
 * and given a recorded verdict on whether it satisfies the feed contract.
 *
 * The verdict is the point of the screen. Preview shows rows; validation
 * stores a per-check pass/fail with a reason, plus what the run cost. Only
 * a query that passes can be published, because a published one gets executed
 * on a schedule for every subscriber.
 *
 * Check reasons come from the server in English. They are diagnostics for the
 * handful of admins who author queries, not visitor-facing copy, so they are
 * shown verbatim rather than being forced through i18n.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import QueryEditor from '../components/QueryEditor.vue'
import {
  listNamedQueries, getNamedQuery, createNamedQuery, updateNamedQuery,
  deleteNamedQuery, validateNamedQuery, previewNamedQuery,
} from '../api/community.js'

const { t } = useI18n()

const ENGINES = ['sql', 'cypher', 'sparql']
// Mirrors src/services/feed_contract.py WAIVABLE. Everything else is
// structural — a feed with no stable id is a re-notification bug, and no
// amount of explanation changes that.
const WAIVABLE = ['binds_nuts', 'binds_since']

const queries = ref([])
const selected = ref(null)
const draft = ref(null)
const preview = ref(null)
const loading = ref(true)
const busy = ref('')
const error = ref(null)

const dirty = computed(() => {
  if (!selected.value || !draft.value) return false
  return ['name', 'slug', 'description', 'lang', 'query']
    .some((k) => draft.value[k] !== selected.value[k])
    || JSON.stringify(draft.value.waivers) !== JSON.stringify(selected.value.waivers || {})
})

const report = computed(() => selected.value?.contract_report || null)
const failing = computed(
  () => (report.value?.checks || []).filter((c) => !c.passed && !c.waived),
)
const canPublish = computed(
  () => selected.value?.contract_ok && selected.value?.status !== 'published',
)

onMounted(async () => {
  document.title = 'Named queries — Fontem'
  await load()
})

async function load(keepId) {
  loading.value = true
  error.value = null
  try {
    queries.value = await listNamedQueries()
    const id = keepId || selected.value?.id
    if (id) await select(id)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function select(id) {
  error.value = null
  preview.value = null
  try {
    selected.value = await getNamedQuery(id)
    draft.value = { ...selected.value, waivers: { ...(selected.value.waivers || {}) } }
  } catch (err) {
    error.value = err.message
  }
}

function startNew() {
  selected.value = null
  preview.value = null
  draft.value = {
    id: null, slug: '', name: '', description: '', lang: 'sql',
    query: '', waivers: {}, status: 'draft', contract_ok: false, groups: [],
  }
}

async function run(action, fn) {
  busy.value = action
  error.value = null
  try {
    return await fn()
  } catch (err) {
    error.value = err.message
    return null
  } finally {
    busy.value = ''
  }
}

async function save() {
  const body = {
    slug: draft.value.slug,
    name: draft.value.name,
    description: draft.value.description,
    lang: draft.value.lang,
    query: draft.value.query,
    waivers: draft.value.waivers,
  }
  const saved = await run('save', () => (draft.value.id
    ? updateNamedQuery(draft.value.id, body)
    : createNamedQuery(body)))
  if (saved) await load(saved.id)
}

async function doPreview() {
  preview.value = await run('preview', () => previewNamedQuery({
    lang: draft.value.lang,
    query: draft.value.query,
    waivers: draft.value.waivers,
  }))
}

async function doValidate() {
  const updated = await run('validate', () => validateNamedQuery(selected.value.id))
  if (updated) await load(updated.id)
}

async function setStatus(status) {
  const updated = await run('status', () => updateNamedQuery(selected.value.id, { status }))
  if (updated) await load(updated.id)
}

async function remove() {
  if (!globalThis.confirm(t('feeds.confirm_delete_query'))) return
  const ok = await run('delete', async () => { await deleteNamedQuery(selected.value.id); return true })
  if (ok) {
    selected.value = null
    draft.value = null
    await load(null)
  }
}

function waiverFor(id) {
  return draft.value.waivers[id] || ''
}

function setWaiver(id, value) {
  if (value.trim()) draft.value.waivers[id] = value
  else delete draft.value.waivers[id]
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleString() : '—'
}
</script>

<template>
  <div class="fq">
    <header class="fq-header">
      <div>
        <router-link to="/admin" class="fq-back">{{ $t('nav.back_admin') }}</router-link>
        <h1>{{ $t('feeds.named_queries') }}</h1>
        <p class="fq-sub">{{ $t('feeds.named_queries_intro') }}</p>
      </div>
      <button class="fq-btn fq-primary" data-testid="new-query" @click="startNew">
        {{ $t('feeds.new_query') }}
      </button>
    </header>

    <p v-if="error" class="fq-error" data-testid="error">{{ error }}</p>
    <p v-if="loading" class="fq-muted">{{ $t('app.loading') }}</p>

    <div class="fq-body">
      <!-- catalogue -->
      <ul class="fq-list" data-testid="query-list">
        <li v-for="q in queries" :key="q.id">
          <button
            class="fq-item" :class="{ 'is-active': selected && selected.id === q.id }"
            @click="select(q.id)"
          >
            <span class="fq-item-name">{{ q.name || q.slug }}</span>
            <span class="fq-chips">
              <span class="fq-chip" :class="`is-${q.status}`">{{ q.status }}</span>
              <span v-if="q.contract_ok" class="fq-chip is-ok" :title="$t('feeds.subscribable')">✓</span>
            </span>
            <code class="fq-item-slug">{{ q.slug }}</code>
          </button>
        </li>
        <li v-if="!loading && !queries.length" class="fq-muted fq-empty">
          {{ $t('feeds.no_queries') }}
        </li>
      </ul>

      <!-- editor -->
      <section v-if="draft" class="fq-editor" data-testid="editor">
        <div class="fq-row">
          <label class="fq-field">
            <span>{{ $t('feeds.name') }}</span>
            <input v-model="draft.name" type="text" data-testid="field-name" />
          </label>
          <label class="fq-field">
            <span>{{ $t('feeds.slug') }}</span>
            <input v-model="draft.slug" type="text" data-testid="field-slug" />
          </label>
          <label class="fq-field fq-narrow">
            <span>{{ $t('feeds.engine') }}</span>
            <select v-model="draft.lang" data-testid="field-lang">
              <option v-for="e in ENGINES" :key="e" :value="e">{{ e }}</option>
            </select>
          </label>
        </div>

        <label class="fq-field">
          <span>{{ $t('feeds.description') }}</span>
          <textarea v-model="draft.description" rows="2" data-testid="field-description" />
        </label>

        <label class="fq-field">
          <span>{{ $t('feeds.query') }}</span>
          <QueryEditor v-model="draft.query" :lang="draft.lang" />
        </label>
        <p class="fq-hint">{{ $t('feeds.binds_hint') }}</p>

        <div class="fq-actions">
          <button
class="fq-btn fq-primary" :disabled="busy === 'save'" data-testid="save"
                  @click="save">
            {{ draft.id ? $t('app.save') : $t('feeds.create') }}
          </button>
          <button
class="fq-btn" :disabled="busy === 'preview' || !draft.query"
                  data-testid="preview" @click="doPreview">
            {{ $t('feeds.preview') }}
          </button>
          <button
v-if="selected" class="fq-btn" :disabled="busy === 'validate' || dirty"
                  data-testid="validate" @click="doValidate">
            {{ $t('feeds.validate') }}
          </button>
          <button
v-if="canPublish" class="fq-btn fq-good" data-testid="publish"
                  @click="setStatus('published')">
            {{ $t('feeds.publish') }}
          </button>
          <button
v-if="selected && selected.status === 'published'" class="fq-btn"
                  data-testid="retire" @click="setStatus('retired')">
            {{ $t('feeds.retire') }}
          </button>
          <button v-if="selected" class="fq-btn fq-danger" data-testid="delete" @click="remove">
            {{ $t('feeds.delete') }}
          </button>
        </div>
        <p v-if="dirty" class="fq-hint" data-testid="dirty-hint">
          {{ $t('feeds.save_before_validating') }}
        </p>

        <!-- contract verdict -->
        <section v-if="report" class="fq-panel" data-testid="contract">
          <h2>
            {{ $t('feeds.contract') }}
            <span class="fq-chip" :class="report.subscribable ? 'is-ok' : 'is-bad'">
              {{ report.subscribable ? $t('feeds.subscribable') : $t('feeds.not_subscribable') }}
            </span>
          </h2>
          <p class="fq-muted fq-cost" data-testid="cost">
            {{ $t('feeds.cost', { ms: report.duration_ms, rows: report.row_count }) }}
            · {{ fmtDate(selected && selected.validated_at) }}
          </p>
          <ul class="fq-checks">
            <li
v-for="c in report.checks" :key="c.id"
                :class="{ 'is-fail': !c.passed && !c.waived, 'is-waived': c.waived }">
              <code>{{ c.id }}</code>
              <span>{{ c.reason }}</span>
            </li>
          </ul>
          <div v-if="failing.some((c) => WAIVABLE.includes(c.id))" class="fq-waivers">
            <h3>{{ $t('feeds.waivers') }}</h3>
            <p class="fq-muted">{{ $t('feeds.waivers_hint') }}</p>
            <label
v-for="c in failing.filter((x) => WAIVABLE.includes(x.id))" :key="c.id"
                   class="fq-field">
              <span><code>{{ c.id }}</code></span>
              <input
                type="text" :value="waiverFor(c.id)" :data-testid="`waiver-${c.id}`"
                :placeholder="$t('feeds.waiver_placeholder')"
                @input="setWaiver(c.id, $event.target.value)"
              />
            </label>
          </div>
        </section>

        <!-- preview -->
        <section v-if="preview" class="fq-panel" data-testid="preview-panel">
          <h2>{{ $t('feeds.preview') }}</h2>
          <p v-if="preview.error" class="fq-error">{{ preview.error }}</p>
          <template v-else>
            <p class="fq-muted fq-cost">
              {{ $t('feeds.cost', { ms: preview.duration_ms, rows: preview.row_count }) }}
              <span v-if="preview.truncated"> · {{ $t('feeds.truncated') }}</span>
            </p>
            <div class="fq-scroll">
              <table class="fq-table">
                <thead>
                  <tr><th v-for="c in preview.columns" :key="c">{{ c }}</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(row, i) in preview.rows" :key="i">
                    <td v-for="(cell, j) in row" :key="j">{{ cell }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </section>

        <p v-if="selected && selected.groups && selected.groups.length" class="fq-muted">
          {{ $t('feeds.in_groups') }}
          <span v-for="g in selected.groups" :key="g.id" class="fq-chip">{{ g.name }}</span>
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.fq { max-width: 1200px; margin: 0 auto; padding: 0 1rem 4rem; }
.fq-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.fq-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0.3rem 0 0; }
.fq-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.fq-sub, .fq-hint { font-size: 0.85rem; color: var(--muted); margin-top: 0.3rem; }
.fq-muted { color: var(--muted); font-size: 0.85rem; }
.fq-error { color: var(--danger, #c0392b); font-size: 0.85rem; margin: 0.5rem 0; }
.fq-body { display: grid; grid-template-columns: minmax(220px, 300px) 1fr; gap: 1.5rem; align-items: start; }
@media (max-width: 800px) { .fq-body { grid-template-columns: 1fr; } }
.fq-list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.fq-empty { padding: 0.9rem; }
.fq-item { display: grid; gap: 0.15rem; width: 100%; text-align: left; padding: 0.7rem 0.9rem; background: none; border: none; border-bottom: 1px solid var(--border); cursor: pointer; color: inherit; }
.fq-item:hover { background: color-mix(in srgb, var(--accent) 7%, transparent); }
.fq-item.is-active { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.fq-item-name { font-weight: 600; font-size: 0.9rem; }
.fq-item-slug { font-size: 0.75rem; color: var(--muted); }
.fq-chips { display: flex; gap: 0.3rem; }
.fq-chip { font-size: 0.7rem; padding: 0.05rem 0.4rem; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); }
.fq-chip.is-published { border-color: var(--accent); color: var(--accent); }
.fq-chip.is-ok { border-color: #2e7d32; color: #2e7d32; }
.fq-chip.is-bad { border-color: #c0392b; color: #c0392b; }
.fq-editor { display: grid; gap: 0.9rem; }
.fq-row { display: flex; gap: 0.8rem; flex-wrap: wrap; }
.fq-field { display: grid; gap: 0.25rem; font-size: 0.8rem; color: var(--muted); flex: 1 1 200px; }
.fq-field.fq-narrow { flex: 0 0 130px; }
.fq-field input, .fq-field select, .fq-field textarea { font: inherit; font-size: 0.9rem; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.45rem 0.6rem; }
.fq-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.fq-btn { font: inherit; font-size: 0.85rem; padding: 0.45rem 0.9rem; border-radius: 8px; border: 1px solid var(--border); background: var(--surface, #f6f8fa); color: inherit; cursor: pointer; }
.fq-btn:disabled { opacity: 0.5; cursor: default; }
.fq-primary { border-color: var(--accent); color: var(--accent); }
.fq-good { border-color: #2e7d32; color: #2e7d32; }
.fq-danger { border-color: #c0392b; color: #c0392b; }
.fq-panel { border: 1px solid var(--border); border-radius: 10px; padding: 0.9rem 1rem; }
.fq-panel h2 { font-size: 1rem; margin: 0 0 0.4rem; display: flex; align-items: center; gap: 0.5rem; }
.fq-panel h3 { font-size: 0.85rem; margin: 0.8rem 0 0.3rem; }
.fq-cost { margin-bottom: 0.6rem; }
.fq-checks { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.25rem; }
.fq-checks li { display: grid; grid-template-columns: 11rem 1fr; gap: 0.6rem; font-size: 0.8rem; align-items: baseline; }
.fq-checks li code { color: var(--muted); }
.fq-checks li.is-fail span { color: #c0392b; }
.fq-checks li.is-waived span { color: var(--muted); font-style: italic; }
.fq-waivers { margin-top: 0.6rem; display: grid; gap: 0.4rem; }
.fq-scroll { overflow-x: auto; }
.fq-table { border-collapse: collapse; font-size: 0.8rem; width: 100%; }
.fq-table th, .fq-table td { border: 1px solid var(--border); padding: 0.3rem 0.5rem; text-align: left; white-space: nowrap; }
.fq-table th { color: var(--muted); font-weight: 600; }
</style>
