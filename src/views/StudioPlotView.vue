<script setup>
/**
 * Data Studio — combine & plot, saved as a first-class project artifact.
 *
 * New plot (/studio/p/:pid/plot): pick queries from the project, combine them
 * client-side in DuckDB-WASM, chart the result, and Save — the plot is stored on
 * the project (its recipe: denormalized source queries + transform + chart).
 * Edit plot (/studio/p/:pid/plot/:plotId): re-runs the stored recipe; tweak the
 * transform/chart and Save. Either can be pocketed into a report (live recipe).
 */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ChartSpec from '../components/charts/ChartSpec.vue'
import StudioMap from '../components/StudioMap.vue'
import { useStudio } from '../composables/useStudio.js'
import { runSource } from '../composables/studioEngines.js'
import { useDuckDB } from '../composables/useDuckDB.js'
import { buildChartProps } from '../composables/studioPlot.js'
import { detectNuts } from '../composables/nutsDetect.js'
import QueryEditor from '../components/QueryEditor.vue'
import { usePocket } from '../composables/usePocket.js'

const CHARTS = [{ key: 'bar_h', label: 'Bar' }, { key: 'ts_line', label: 'Line' }, { key: 'stat', label: 'Stat' }, { key: 'atlas_map', label: 'Map' }]
const route = useRoute()
const router = useRouter()
const studio = useStudio()
const { runTransform } = useDuckDB()
const { save: pocketSave } = usePocket()

const project = ref(null)
const canEdit = computed(() => project.value?.my_access?.can_edit !== false)
const ready = ref(false)
const editMode = computed(() => !!route.params.plotId)

const plotName = ref('Untitled plot')
const selection = ref([])          // new mode: selected query ids (ordered)
const storedSources = ref([])      // edit mode: recipe sources from the saved plot
const transformSql = ref('')
const combine = reactive({ result: null, error: null, loading: false })
const plot = reactive({ chart: 'bar_h', x: '', y: '', level: 0 })
const saved = ref(false)
const pocketed = ref(false)
const qCols = reactive({})       // new mode: query id -> columns
const editCols = reactive({})    // edit mode: source name -> columns
const autoFilled = ref('')       // last auto-generated transform (detects user edits)

// Cache the last combine result in the browser so a saved plot renders on open
// without re-clicking; the combine only re-runs live when the user asks.
const runKey = () => (route.params.plotId ? `fontem-studio-run:${route.params.plotId}` : null)
function saveRun(id) {
  const k = id ? `fontem-studio-run:${id}` : runKey()
  if (!k || !combine.result) return
  try { localStorage.setItem(k, JSON.stringify(combine.result)) } catch { /* quota */ }
}
function loadCachedRun() {
  const k = runKey()
  if (!k) return
  try { const raw = localStorage.getItem(k); if (raw) combine.result = JSON.parse(raw) } catch { /* ignore */ }
}

async function hydrate() {
  ready.value = false
  await studio.ensureLoaded()
  const pid = route.params.projectId
  project.value = await studio.ensureProject(pid)
  if (!project.value) { router.replace('/studio'); return }
  if (editMode.value) {
    const pl = studio.getPlot(pid, route.params.plotId)
    if (!pl) { router.replace(`/studio/p/${pid}`); return }
    const spec = pl.spec || {}
    plotName.value = pl.name
    storedSources.value = (spec.sources || []).map((s) => ({ ...s }))
    transformSql.value = spec.transform || ''
    Object.keys(editCols).forEach((k) => delete editCols[k])
    storedSources.value.forEach(async (src) => {
      try { const r = await runSource(src.lang, src.query); editCols[src.name] = r.columns || [] } catch { editCols[src.name] = [] }
    })
    plot.chart = spec.chart || 'bar_h'; plot.x = spec.x || ''; plot.y = spec.y || ''; plot.level = spec.level || 0
  } else {
    plotName.value = 'Untitled plot'
    selection.value = []; transformSql.value = ''; autoFilled.value = ''
    Object.keys(qCols).forEach((k) => delete qCols[k])
    plot.chart = 'bar_h'; plot.x = ''; plot.y = ''
  }
  combine.result = null; combine.error = null
  if (editMode.value) loadCachedRun()  // render the saved plot immediately
  ready.value = true
}
onMounted(hydrate)
watch(() => route.params.plotId, hydrate)

function toggle(id) {
  const i = selection.value.indexOf(id)
  if (i >= 0) selection.value.splice(i, 1)
  else { selection.value.push(id); loadCols(id) }
  syncAutoTransform()
}
const aliasOf = (id) => { const i = selection.value.indexOf(id); return i >= 0 ? `q${i + 1}` : '' }

// Fetch a source query's columns so the transform editor can complete q1.<field>.
async function loadCols(id) {
  if (qCols[id]) return
  const q = (project.value?.queries || []).find((x) => x.id === id)
  if (!q) return
  try { const r = await runSource(q.lang, q.query); qCols[id] = r.columns || [] } catch { qCols[id] = [] }
  syncAutoTransform()
}

// Synthetic SQL schema of the selected sources (alias -> columns) for autocomplete.
const transformSchema = computed(() => {
  const tables = editMode.value
    ? storedSources.value.map((sc) => ({ name: sc.name, columns: (editCols[sc.name] || []).map((c) => ({ name: c })) }))
    : selection.value.map((id, i) => ({ name: `q${i + 1}`, columns: (qCols[id] || []).map((c) => ({ name: c })) }))
  return { lang: 'sql', tables }
})

// Default transform when the user hasn't written/edited one: SELECT * FROM the
// selected aliases, joined on a shared column when the sources have one.
function defaultTransform() {
  const sels = selection.value
  if (!sels.length) return ''
  if (sels.length === 1) return `SELECT *\nFROM q1`
  const cols0 = qCols[sels[0]] || []
  const shared = cols0.find((c) => sels.every((id) => (qCols[id] || []).includes(c)))
  let sql = `SELECT *\nFROM q1`
  for (let i = 1; i < sels.length; i += 1) {
    const a = `q${i + 1}`
    sql += shared
      ? `\nJOIN ${a} ON q1.${shared} = ${a}.${shared}`
      : `\nJOIN ${a} ON q1.column = ${a}.column  -- edit the join keys`
  }
  return sql
}
function syncAutoTransform() {
  if (editMode.value) return
  if (transformSql.value === '' || transformSql.value === autoFilled.value) {
    const def = defaultTransform()
    transformSql.value = def
    autoFilled.value = def
  }
}

// The recipe sources to combine: stored (edit) or aliased picks (new).
const activeSources = computed(() => {
  if (editMode.value) return storedSources.value
  return selection.value
    .map((id, i) => {
      const q = (project.value?.queries || []).find((x) => x.id === id)
      return q ? { name: `q${i + 1}`, lang: q.lang, query: q.query } : null
    })
    .filter(Boolean)
})

async function runCombine() {
  combine.loading = true; combine.error = null; combine.result = null
  try {
    const sources = activeSources.value
    if (!sources.length) throw new Error('Pick at least one query to combine')
    const inputs = []
    for (const s of sources) {
      const r = await runSource(s.lang, s.query)
      inputs.push({ name: s.name, columns: r.columns, rows: r.rows })
    }
    const sql = transformSql.value.trim() || `SELECT * FROM ${inputs[0].name}`
    combine.result = await runTransform(inputs, sql)
    const cols = combine.result.columns
    if (!plot.x || !cols.includes(plot.x)) plot.x = cols[0] || ''
    if (!plot.y || !cols.includes(plot.y)) plot.y = cols.find((c) => c !== plot.x) || cols[0] || ''
    saveRun()
  } catch (e) { combine.error = e.message } finally { combine.loading = false }
}

// Pre-fill the map's geo/value/level from the result's value shapes when the
// user picks the Map chart type (they can override via the selects).
function applyMapDetection() {
  if (!combine.result) return
  const d = detectNuts(combine.result.columns, combine.result.rows)
  if (d) { plot.x = d.geoCol; plot.y = d.valueCol; plot.level = d.level }
}
watch(() => plot.chart, (c) => { if (c === 'atlas_map') applyMapDetection() })

const chartProps = computed(() => buildChartProps(combine.result, plot))
const currentSpec = () => ({
  sources: activeSources.value.map((s) => ({ name: s.name, lang: s.lang, query: s.query })),
  transform: transformSql.value,
  chart: plot.chart, x: plot.x, y: plot.y, level: plot.level,
})

async function savePlot() {
  if (!canEdit.value) return
  const pid = route.params.projectId
  const name = plotName.value.trim() || 'Untitled plot'
  if (editMode.value) {
    await studio.updatePlot(pid, route.params.plotId, { name, spec: currentSpec() })
    saveRun(route.params.plotId)
  } else {
    const pl = await studio.createPlot(pid, { name, spec: currentSpec() })
    saveRun(pl.id)   // cache the run under the new id so it renders on next open
    router.replace(`/studio/p/${pid}/plot/${pl.id}`)
  }
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}

function pocket() {
  pocketSave('pipeline', {
    data_params: { sources: currentSpec().sources, transform: transformSql.value },
    ui_params: { chart: plot.chart, x: plot.x, y: plot.y, level: plot.level },
  }, `${plotName.value || 'Studio'} · ${plot.y || 'plot'}`)
  pocketed.value = true
  setTimeout(() => { pocketed.value = false }, 2000)
}
</script>

<template>
  <div v-if="ready && project" class="plotview" data-testid="studio-plot-view">
    <nav class="crumbs">
      <router-link to="/studio">Studio</router-link><span class="sep">/</span>
      <router-link :to="`/studio/p/${project.id}`">{{ project.name }}</router-link>
    </nav>

    <div class="phead">
      <input v-model="plotName" class="pname" data-testid="plot-name" spellcheck="false" aria-label="Plot name" :readonly="!canEdit" />
      <div class="pactions">
        <button v-if="canEdit" type="button" class="sbtn sbtn--primary" data-testid="plot-save" :disabled="!activeSources.length" @click="savePlot">{{ saved ? 'Saved ✓' : 'Save plot' }}</button>
        <button type="button" class="sbtn" data-testid="plot-pocket" :disabled="!combine.result" @click="pocket">{{ pocketed ? 'Pocketed ✓' : 'Pocket' }}</button>
      </div>
    </div>

    <!-- New: pick project queries. Edit: show the saved recipe's sources. -->
    <section class="grp">
      <h2 class="grp-title">1 · Sources</h2>
      <template v-if="!editMode">
        <p v-if="!project.queries.length" class="empty">This project has no queries yet.</p>
        <ul v-else class="picks">
          <li v-for="q in project.queries" :key="q.id">
            <label class="pick" data-testid="plot-query-toggle">
              <input type="checkbox" :checked="selection.includes(q.id)" @change="toggle(q.id)" />
              <span class="pick-name">{{ q.name }}</span>
              <code v-if="aliasOf(q.id)" class="pick-alias">{{ aliasOf(q.id) }}</code>
            </label>
          </li>
        </ul>
      </template>
      <ul v-else class="picks">
        <li v-for="s in storedSources" :key="s.name" class="pick pick--static" data-testid="plot-source">
          <code class="pick-alias">{{ s.name }}</code>
          <span class="pick-name">{{ s.lang }}</span>
          <code class="qsnip">{{ (s.query || '').split('\n')[0].slice(0, 60) }}</code>
        </li>
      </ul>
    </section>

    <section class="grp">
      <h2 class="grp-title">2 · Combine <span class="hint">— DuckDB SQL over {{ activeSources.map((s) => s.name).join(', ') || 'your sources' }} (runs in your browser)</span></h2>
      <QueryEditor v-model="transformSql" lang="sql" :schema="transformSchema" data-testid="plot-transform-sql" placeholder="SELECT q1.country, q1.value AS a, q2.value AS b FROM q1 JOIN q2 ON q1.country = q2.country" @run="runCombine" />
      <div class="row">
        <button type="button" class="sbtn sbtn--primary" data-testid="plot-combine" :disabled="combine.loading || !activeSources.length" @click="runCombine">
          {{ combine.loading ? 'Combining…' : 'Run & combine' }}
        </button>
        <span v-if="combine.result" class="meta">{{ combine.result.rows.length }} rows</span>
        <span v-if="combine.error" class="err" data-testid="plot-error">{{ combine.error }}</span>
      </div>
      <div v-if="combine.result" class="twrap" data-testid="plot-result">
        <table class="ttable">
          <thead><tr><th v-for="c in combine.result.columns" :key="c">{{ c }}</th></tr></thead>
          <tbody><tr v-for="(r, i) in combine.result.rows.slice(0, 50)" :key="i"><td v-for="(cell, j) in r" :key="j">{{ cell }}</td></tr></tbody>
        </table>
      </div>
    </section>

    <section v-if="combine.result" class="grp" data-testid="studio-plot">
      <h2 class="grp-title">3 · Plot</h2>
      <div class="pcontrols">
        <label>Chart <select v-model="plot.chart" data-testid="plot-chart"><option v-for="c in CHARTS" :key="c.key" :value="c.key">{{ c.label }}</option></select></label>
        <template v-if="plot.chart === 'atlas_map'">
          <label>NUTS column <select v-model="plot.x" data-testid="plot-geo"><option v-for="c in combine.result.columns" :key="c" :value="c">{{ c }}</option></select></label>
          <label>Value <select v-model="plot.y" data-testid="plot-value"><option v-for="c in combine.result.columns" :key="c" :value="c">{{ c }}</option></select></label>
          <label>Level <select v-model.number="plot.level" data-testid="plot-level"><option v-for="l in [0, 1, 2, 3]" :key="l" :value="l">NUTS {{ l }}</option></select></label>
        </template>
        <template v-else>
          <label>X <select v-model="plot.x" data-testid="plot-x"><option v-for="c in combine.result.columns" :key="c" :value="c">{{ c }}</option></select></label>
          <label>Y <select v-model="plot.y" data-testid="plot-y"><option v-for="c in combine.result.columns" :key="c" :value="c">{{ c }}</option></select></label>
        </template>
      </div>
      <StudioMap v-if="plot.chart === 'atlas_map'" :rows="combine.result.rows" :columns="combine.result.columns" :geo-col="plot.x" :value-col="plot.y" :level="plot.level" />
      <div v-else-if="chartProps" class="pchart"><ChartSpec :chart="plot.chart" :chart-props="chartProps" /></div>
    </section>
  </div>
  <p v-else class="ploading" data-testid="plot-loading">Loading…</p>
</template>

<style scoped>
.plotview { max-width: 60rem; margin: 0 auto; padding: 0.5rem 1rem 4rem; }
.ploading { max-width: 60rem; margin: 2rem auto; padding: 0 1rem; color: var(--muted); }
.crumbs { font-size: 0.8rem; color: var(--muted); padding: 0.6rem 0; }
.crumbs a { color: var(--muted); text-decoration: none; }
.crumbs a:hover { color: var(--text); text-decoration: underline; }
.sep { margin: 0 0.4rem; }
.phead { display: flex; align-items: center; gap: 1rem; justify-content: space-between; flex-wrap: wrap; margin-bottom: 0.5rem; }
.pname { font-size: 1.3rem; font-weight: 800; border: 1px solid transparent; border-radius: 8px; padding: 0.3rem 0.5rem; background: transparent; color: var(--text); flex: 1; min-width: 12rem; }
.pname:hover { border-color: var(--border); }
.pname:focus { border-color: var(--accent); outline: none; background: var(--bg); }
.pactions { display: flex; gap: 0.4rem; }
.grp { margin: 1.4rem 0; }
.grp-title { font-size: 1rem; font-weight: 700; margin: 0 0 0.6rem; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; }
.hint { font-weight: 400; font-size: 0.78rem; color: var(--muted); }
.empty { color: var(--muted); font-size: 0.88rem; }
.picks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.pick { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.5rem; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; }
.pick--static { cursor: default; }
.pick-name { font-size: 0.88rem; }
.pick-alias { font-size: 0.74rem; font-weight: 700; color: var(--accent); font-family: ui-monospace, monospace; }
.pick:not(.pick--static) .pick-alias { margin-left: auto; }
.qsnip { color: var(--muted); font-size: 0.74rem; font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.editor { width: 100%; box-sizing: border-box; font-family: ui-monospace, monospace; font-size: 0.83rem; border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem; background: var(--bg); color: var(--text); resize: vertical; }
.row { display: flex; align-items: center; gap: 0.8rem; margin-top: 0.6rem; flex-wrap: wrap; }
.meta { font-size: 0.78rem; color: var(--muted); font-family: ui-monospace, monospace; }
.err { font-size: 0.82rem; color: #dc2626; }
.twrap { overflow: auto; max-height: 18rem; border: 1px solid var(--border); border-radius: 8px; margin-top: 0.7rem; }
.ttable { border-collapse: collapse; width: 100%; font-size: 0.8rem; }
.ttable th, .ttable td { text-align: left; padding: 0.35rem 0.6rem; border-bottom: 1px solid var(--border); white-space: nowrap; }
.ttable th { background: var(--bezel); position: sticky; top: 0; font-weight: 600; }
.pcontrols { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.8rem; font-size: 0.82rem; }
.pcontrols select { margin-left: 0.3rem; border: 1px solid var(--border); border-radius: 6px; padding: 0.2rem 0.4rem; background: var(--bg); color: var(--text); }
.pchart { border: 1px solid var(--border); border-radius: 10px; padding: 1rem; }
.sbtn { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 8px; padding: 0.4rem 0.85rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
.sbtn--primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.sbtn:disabled { opacity: 0.5; cursor: default; }
</style>
