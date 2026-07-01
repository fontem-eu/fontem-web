<script setup>
/**
 * Data Studio — the data-lab MVP. Define several read-only source queries
 * (Cypher / SQL / SPARQL, fetched from Fontem's proxies), COMBINE them with a
 * DuckDB SQL transform that runs client-side (DuckDB-WASM, browser sandbox), and
 * plot the result. Everything is a re-runnable recipe: no data is stored.
 */
import { ref, reactive, computed } from 'vue'
import ChartSpec from '../components/charts/ChartSpec.vue'
import { useDuckDB } from '../composables/useDuckDB.js'
import { buildChartProps } from '../composables/studioPlot.js'
import { usePocket } from '../composables/usePocket.js'

const ENGINES = [
  { key: 'cypher', label: 'Cypher', store: 'Neo4j graph', path: '/api/query/cypher',
    sample: 'MATCH (c:Company)-[:AWARDED_TO]-(ct:Contract)\nRETURN c.name AS company, count(ct) AS contracts\nORDER BY contracts DESC LIMIT 20' },
  { key: 'sql', label: 'SQL', store: 'stats / Eurostat', path: '/api/query/sql',
    sample: "SELECT geo_code AS country, value\nFROM observation\nWHERE dataset = 'crim_off_cat'\nLIMIT 50" },
  { key: 'sparql', label: 'SPARQL', store: 'Virtuoso RDF', path: '/api/sparql',
    sample: 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 20' },
]
const CHARTS = [
  { key: 'bar_h', label: 'Bar' },
  { key: 'ts_line', label: 'Line' },
  { key: 'stat', label: 'Stat' },
]
const { runTransform } = useDuckDB()

let _id = 0
function blankSource(name) {
  return reactive({ id: ++_id, name: name || `q${_id}`, lang: 'cypher', query: ENGINES[0].sample,
    result: null, error: null, loading: false })
}
const sources = ref([blankSource('q1')])
const transformSql = ref('')
const transform = reactive({ result: null, error: null, loading: false })
const plot = reactive({ chart: 'bar_h', x: '', y: '' })

function addSource() { sources.value.push(blankSource()) }
function removeSource(id) { sources.value = sources.value.filter((s) => s.id !== id) }
function pickLang(s, k) {
  s.lang = k
  if (!s.query.trim() || ENGINES.some((e) => e.sample === s.query)) s.query = ENGINES.find((e) => e.key === k).sample
}

async function runSource(s) {
  if (!s.query.trim()) return
  s.loading = true; s.error = null; s.result = null
  try {
    const eng = ENGINES.find((e) => e.key === s.lang)
    const res = await fetch(eng.path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: s.query }) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`)
    if (s.lang === 'sparql') {
      const cols = body.head?.vars || []
      s.result = { columns: cols, rows: (body.results?.bindings || []).map((b) => cols.map((c) => b[c]?.value ?? null)) }
    } else {
      s.result = { columns: body.columns || [], rows: body.rows || [] }
    }
  } catch (e) { s.error = e.message } finally { s.loading = false }
}

const readySources = computed(() => sources.value.filter((s) => s.result))

async function runTransformStep() {
  transform.loading = true; transform.error = null; transform.result = null
  try {
    const inputs = readySources.value.map((s) => ({ name: s.name, columns: s.result.columns, rows: s.result.rows }))
    if (!inputs.length) throw new Error('Run at least one source query first')
    const sql = transformSql.value.trim() || `SELECT * FROM "${inputs[0].name}"`
    transform.result = await runTransform(inputs, sql)
    const cols = transform.result.columns
    if (!plot.x || !cols.includes(plot.x)) plot.x = cols[0] || ''
    if (!plot.y || !cols.includes(plot.y)) plot.y = cols.find((c) => c !== plot.x) || cols[0] || ''
  } catch (e) { transform.error = e.message } finally { transform.loading = false }
}

const chartProps = computed(() => buildChartProps(transform.result, plot))

const { save: pocketSave } = usePocket()
const pocketed = ref(false)
function pocket() {
  const recipe = {
    data_params: { sources: sources.value.map((s) => ({ name: s.name, lang: s.lang, query: s.query })), transform: transformSql.value },
    ui_params: { chart: plot.chart, x: plot.x, y: plot.y },
  }
  pocketSave('pipeline', recipe, `Studio · ${plot.y || 'plot'}`)
  pocketed.value = true
  setTimeout(() => { pocketed.value = false }, 2500)
}
</script>

<template>
  <div class="studio" data-testid="data-studio">
    <div class="studio-toolbar">
      <h1 class="studio-title">Data Studio</h1>
      <button type="button" class="sbtn sbtn--primary" data-testid="studio-add-source" @click="addSource">+ Query</button>
    </div>

    <!-- Source cells -->
    <section class="scells">
      <div v-for="s in sources" :key="s.id" class="scell" data-testid="studio-source">
        <div class="scell-head">
          <input v-model="s.name" class="scell-name" data-testid="source-name" spellcheck="false" />
          <div class="scell-langs">
            <button v-for="e in ENGINES" :key="e.key" type="button" class="lang" :class="{ active: s.lang === e.key }" :data-testid="'source-lang-' + e.key" @click="pickLang(s, e.key)">{{ e.label }}</button>
          </div>
          <button v-if="sources.length > 1" type="button" class="scell-x" aria-label="Remove" @click="removeSource(s.id)">×</button>
        </div>
        <textarea v-model="s.query" class="editor" data-testid="source-query" rows="4" spellcheck="false" />
        <div class="scell-run">
          <button type="button" class="sbtn" data-testid="source-run" :disabled="s.loading" @click="runSource(s)">{{ s.loading ? 'Running…' : 'Run query' }}</button>
          <span v-if="s.result" class="scell-meta">{{ s.result.rows.length }} rows · [{{ s.result.columns.join(', ') }}]</span>
          <span v-if="s.error" class="scell-err">{{ s.error }}</span>
        </div>
      </div>
    </section>

    <!-- Transform -->
    <section class="tsect">
      <h2 class="ttitle">Combine <span class="thint">— DuckDB SQL over {{ readySources.map((s) => s.name).join(', ') || 'your queries' }} (runs in your browser)</span></h2>
      <textarea
v-model="transformSql" class="editor" data-testid="transform-sql" rows="4" spellcheck="false"
        placeholder="SELECT a.country, a.value AS rape, m.value AS migration&#10;FROM q1 a JOIN q2 m ON a.country = m.country" />
      <div class="scell-run">
        <button type="button" class="sbtn sbtn--primary" data-testid="transform-run" :disabled="transform.loading || !readySources.length" @click="runTransformStep">{{ transform.loading ? 'Combining…' : 'Combine' }}</button>
        <span v-if="transform.result" class="scell-meta">{{ transform.result.rows.length }} rows</span>
        <span v-if="transform.error" class="scell-err">{{ transform.error }}</span>
      </div>

      <div v-if="transform.result" class="tresult" data-testid="transform-result">
        <div class="twrap">
          <table class="ttable">
            <thead><tr><th v-for="c in transform.result.columns" :key="c">{{ c }}</th></tr></thead>
            <tbody><tr v-for="(row, i) in transform.result.rows.slice(0, 50)" :key="i"><td v-for="(cell, j) in row" :key="j">{{ cell }}</td></tr></tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Plot -->
    <section v-if="transform.result" class="psect" data-testid="studio-plot">
      <h2 class="ttitle">Plot</h2>
      <div class="pcontrols">
        <label>Chart <select v-model="plot.chart" data-testid="plot-chart"><option v-for="c in CHARTS" :key="c.key" :value="c.key">{{ c.label }}</option></select></label>
        <label>X <select v-model="plot.x" data-testid="plot-x"><option v-for="c in transform.result.columns" :key="c" :value="c">{{ c }}</option></select></label>
        <label>Y <select v-model="plot.y" data-testid="plot-y"><option v-for="c in transform.result.columns" :key="c" :value="c">{{ c }}</option></select></label>
      </div>
      <div v-if="chartProps" class="pchart"><ChartSpec :chart="plot.chart" :chart-props="chartProps" /></div>
      <div class="prow"><button type="button" class="sbtn sbtn--primary" data-testid="studio-pocket" @click="pocket">{{ pocketed ? 'Pocketed ✓' : 'Pocket this plot' }}</button></div>
    </section>
  </div>
</template>

<style scoped>
.studio { max-width: 60rem; margin: 0 auto; padding: 0 1rem 4rem; }
.studio-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid var(--border); position: sticky; top: var(--bezel-h, 3.25rem); background: var(--bg); z-index: 5; }
.studio-title { font-size: 1.2rem; font-weight: 700; margin: 0; }
.sbtn { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 8px; padding: 0.4rem 0.85rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
.sbtn--primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.sbtn:disabled { opacity: 0.5; cursor: default; }
.scells { display: flex; flex-direction: column; gap: 0.8rem; margin: 1rem 0; }
.scell { border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem; background: var(--surface); }
.scell-head { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
.scell-name { font-weight: 600; font-family: ui-monospace, monospace; font-size: 0.85rem; border: 1px solid var(--border); border-radius: 6px; padding: 0.25rem 0.5rem; width: 6rem; background: var(--bg); color: var(--text); }
.scell-langs { display: flex; gap: 0.3rem; }
.lang { border: 1px solid var(--border); background: var(--bg); color: var(--muted); border-radius: 6px; padding: 0.25rem 0.55rem; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
.lang.active { border-color: var(--accent); color: var(--text); background: color-mix(in srgb, var(--accent) 12%, var(--bg)); }
.scell-x { margin-left: auto; border: 0; background: transparent; color: var(--muted); font-size: 1.1rem; cursor: pointer; line-height: 1; }
.editor { width: 100%; box-sizing: border-box; font-family: ui-monospace, monospace; font-size: 0.83rem; border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem; background: var(--bg); color: var(--text); resize: vertical; }
.scell-run { display: flex; align-items: center; gap: 0.7rem; margin-top: 0.5rem; flex-wrap: wrap; }
.scell-meta { font-size: 0.76rem; color: var(--muted); font-family: ui-monospace, monospace; }
.scell-err { font-size: 0.8rem; color: #dc2626; }
.tsect, .psect { margin-top: 1.6rem; }
.ttitle { font-size: 1rem; font-weight: 700; margin: 0 0 0.5rem; }
.thint { font-weight: 400; font-size: 0.78rem; color: var(--muted); }
.tresult { margin-top: 0.7rem; }
.twrap { overflow: auto; max-height: 18rem; border: 1px solid var(--border); border-radius: 8px; }
.ttable { border-collapse: collapse; width: 100%; font-size: 0.8rem; }
.ttable th, .ttable td { text-align: left; padding: 0.35rem 0.6rem; border-bottom: 1px solid var(--border); white-space: nowrap; }
.ttable th { background: var(--bezel); position: sticky; top: 0; font-weight: 600; }
.pcontrols { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.8rem; font-size: 0.82rem; }
.pcontrols select { margin-left: 0.3rem; border: 1px solid var(--border); border-radius: 6px; padding: 0.2rem 0.4rem; background: var(--bg); color: var(--text); }
.pchart { border: 1px solid var(--border); border-radius: 10px; padding: 1rem; }
</style>
