<script setup>
/**
 * Data Studio — single-query editor (server-backed). Pick a language, write the
 * query, run it against the read-only proxy, and preview the result table.
 * The recipe autosaves to its project. Inline name + two-click delete (no
 * browser dialogs).
 */
import { ref, reactive, watch, computed, nextTick, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStudio } from '../composables/useStudio.js'
import { ENGINES, engine, runSource } from '../composables/studioEngines.js'
import QueryEditor from '../components/QueryEditor.vue'
import SchemaPanel from '../components/SchemaPanel.vue'

const route = useRoute()
const router = useRouter()
const studio = useStudio()

const draft = reactive({ name: '', lang: 'cypher', query: '' })
const run = reactive({ result: null, error: null, loading: false })
const project = ref(null)
const query = ref(null)
const ready = ref(false)
const confirmDelete = ref(false)
const showSchema = ref(true)
const canEdit = computed(() => project.value?.my_access?.can_edit !== false)

async function hydrate() {
  ready.value = false
  await studio.ensureLoaded()
  const { projectId, queryId } = route.params
  project.value = await studio.ensureProject(projectId)
  query.value = studio.getQuery(projectId, queryId)
  if (!project.value) { router.replace('/studio'); return }
  if (!query.value) { router.replace(`/studio/p/${projectId}`); return }
  draft.name = query.value.name
  draft.lang = query.value.lang
  draft.query = query.value.query
  run.result = null; run.error = null; run.loading = false
  await nextTick() // let the hydrate-driven draft watch flush before enabling autosave
  ready.value = true
}
onMounted(hydrate)
watch(() => route.params.queryId, hydrate)

let saveTimer = null
function persist() {
  if (!canEdit.value) return
  studio.updateQuery(route.params.projectId, route.params.queryId,
    { name: draft.name.trim() || 'Untitled', lang: draft.lang, query: draft.query })
}
watch(draft, () => {
  if (!ready.value) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(persist, 500)
})
onBeforeUnmount(() => clearTimeout(saveTimer))

const activeEngine = computed(() => engine(draft.lang))
function pickLang(k) {
  const prev = engine(draft.lang)
  draft.lang = k
  if (!draft.query.trim() || draft.query === prev.sample) draft.query = engine(k).sample
}

async function execute() {
  if (!draft.query.trim() || run.loading) return
  run.loading = true; run.error = null; run.result = null
  clearTimeout(saveTimer); persist()
  try {
    run.result = await runSource(draft.lang, draft.query)
  } catch (e) { run.error = e.message } finally { run.loading = false }
}

async function duplicate() {
  const copy = await studio.duplicateQuery(route.params.projectId, route.params.queryId)
  if (copy) router.push(`/studio/p/${route.params.projectId}/q/${copy.id}`)
}
async function remove() {
  if (!confirmDelete.value) { confirmDelete.value = true; setTimeout(() => { confirmDelete.value = false }, 3000); return }
  const pid = route.params.projectId
  await studio.deleteQuery(pid, route.params.queryId)
  router.replace(`/studio/p/${pid}`)
}
</script>

<template>
  <div v-if="ready && query" class="qview" data-testid="studio-query-view">
    <nav class="crumbs">
      <router-link to="/studio">{{ $t('studio_query.studio') }}</router-link>
      <span class="sep">/</span>
      <router-link :to="`/studio/p/${route.params.projectId}`">{{ project?.name }}</router-link>
    </nav>

    <div class="qhead">
      <input v-model="draft.name" class="qname" data-testid="query-name" spellcheck="false" :aria-label="$t('studio_query.query_name')" :readonly="!canEdit" />
      <div class="qactions">
        <button v-if="canEdit" type="button" class="sbtn" data-testid="query-duplicate" @click="duplicate">{{ $t('studio_query.duplicate') }}</button>
        <button v-if="canEdit" type="button" class="sbtn sbtn--danger" data-testid="query-delete" @click="remove">{{ confirmDelete ? $t('studio_query.confirm_delete') : $t('studio_query.delete') }}</button>
      </div>
    </div>

    <div class="qlangs" role="tablist" :aria-label="$t('studio_query.query_language')">
      <button
        v-for="e in ENGINES" :key="e.key" type="button" class="lang"
        :class="{ active: draft.lang === e.key }" :data-testid="'query-lang-' + e.key"
        @click="pickLang(e.key)"
      >{{ e.label }}</button>
      <span class="qstore">→ {{ activeEngine.store }}</span>
      <button type="button" class="sbtn schema-toggle" data-testid="schema-toggle" @click="showSchema = !showSchema">{{ showSchema ? $t('studio_query.hide_schema') : $t('studio_query.schema') }}</button>
    </div>

    <div class="qbody">
      <div class="qedit">
        <QueryEditor v-model="draft.query" :lang="draft.lang" :placeholder="$t('studio_query.write_your_query_shortcut')" @run="execute" />

        <div class="qrun">
          <button type="button" class="sbtn sbtn--primary" data-testid="query-run" :disabled="run.loading || !draft.query.trim()" @click="execute">
            {{ run.loading ? $t('studio_query.running') : $t('studio_query.run_query') }}
          </button>
          <span class="qhint">Ctrl/Cmd+Enter</span>
          <span v-if="run.result" class="qmeta" data-testid="query-meta">{{ run.result.rows.length }} {{ $t('studio_query.rows') }} · {{ run.result.columns.length }} {{ $t('studio_query.cols') }}</span>
          <span v-if="run.error" class="qerr" data-testid="query-error">{{ run.error }}</span>
        </div>

        <div v-if="run.result" class="qresult" data-testid="query-result">
      <div v-if="!run.result.rows.length" class="qempty">{{ $t('studio_query.query_ran_no_rows') }}</div>
      <div v-else class="twrap">
        <table class="ttable">
          <thead><tr><th v-for="c in run.result.columns" :key="c">{{ c }}</th></tr></thead>
          <tbody>
            <tr v-for="(row, i) in run.result.rows.slice(0, 100)" :key="i">
              <td v-for="(cell, j) in row" :key="j">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="run.result.rows.length > 100" class="qtrunc">{{ $t('studio_query.showing_first_100_of') }} {{ run.result.rows.length }} {{ $t('studio_query.rows_2') }}</div>
      </div>
    </div>
      </div>
      <SchemaPanel v-if="showSchema" :lang="draft.lang" class="qschema" />
    </div>
  </div>
  <p v-else class="qloading" data-testid="query-loading">{{ $t('studio_query.loading') }}</p>
</template>

<style scoped>
.qview { max-width: 60rem; margin: 0 auto; padding: 0.5rem 1rem 4rem; }
.qloading { max-width: 60rem; margin: 2rem auto; padding: 0 1rem; color: var(--muted); }
.crumbs { font-size: 0.8rem; color: var(--muted); padding: 0.6rem 0; }
.crumbs a { color: var(--muted); text-decoration: none; }
.crumbs a:hover { color: var(--text); text-decoration: underline; }
.sep { margin: 0 0.4rem; }
.qhead { display: flex; align-items: center; gap: 1rem; justify-content: space-between; flex-wrap: wrap; }
.qname { font-size: 1.15rem; font-weight: 700; border: 1px solid transparent; border-radius: 8px; padding: 0.3rem 0.5rem; background: transparent; color: var(--text); flex: 1; min-width: 12rem; }
.qname:hover { border-color: var(--border); }
.qname:focus { border-color: var(--accent); outline: none; background: var(--bg); }
.qactions { display: flex; gap: 0.4rem; }
.qlangs { display: flex; align-items: center; gap: 0.4rem; margin: 0.7rem 0; flex-wrap: wrap; }
.lang { border: 1px solid var(--border); background: var(--bg); color: var(--muted); border-radius: 6px; padding: 0.3rem 0.7rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
.lang.active { border-color: var(--accent); color: var(--text); background: color-mix(in srgb, var(--accent) 12%, var(--bg)); }
.qstore { font-size: 0.76rem; color: var(--muted); font-family: ui-monospace, monospace; }
.editor { width: 100%; box-sizing: border-box; font-family: ui-monospace, monospace; font-size: 0.85rem; border: 1px solid var(--border); border-radius: 8px; padding: 0.7rem; background: var(--bg); color: var(--text); resize: vertical; }
.qbody { display: grid; grid-template-columns: 1fr; gap: 1rem; margin-top: 0.3rem; }
@media (min-width: 900px) { .qbody { grid-template-columns: minmax(0, 1fr) 16rem; align-items: start; } }
.qedit { min-width: 0; }
.qschema { min-width: 0; }
.schema-toggle { margin-left: auto; }
.qhint { font-size: 0.7rem; color: var(--muted); font-family: ui-monospace, monospace; }
.qrun { display: flex; align-items: center; gap: 0.8rem; margin-top: 0.7rem; flex-wrap: wrap; }
.qmeta { font-size: 0.78rem; color: var(--muted); font-family: ui-monospace, monospace; }
.qerr { font-size: 0.82rem; color: #dc2626; }
.qresult { margin-top: 1rem; }
.qempty { color: var(--muted); font-size: 0.85rem; padding: 0.8rem; border: 1px dashed var(--border); border-radius: 8px; }
.twrap { overflow: auto; max-height: 26rem; border: 1px solid var(--border); border-radius: 8px; }
.ttable { border-collapse: collapse; width: 100%; font-size: 0.8rem; }
.ttable th, .ttable td { text-align: left; padding: 0.35rem 0.6rem; border-bottom: 1px solid var(--border); white-space: nowrap; }
.ttable th { background: var(--bezel); position: sticky; top: 0; font-weight: 600; }
.qtrunc { font-size: 0.74rem; color: var(--muted); padding: 0.4rem 0.6rem; }
.sbtn { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 8px; padding: 0.4rem 0.85rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
.sbtn--primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.sbtn--danger { color: #dc2626; }
.sbtn:disabled { opacity: 0.5; cursor: default; }
</style>
