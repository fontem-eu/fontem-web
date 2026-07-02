<script setup>
/**
 * Data Studio — combine & plot. Pick queries from the project, run them, and
 * COMBINE their results with a DuckDB SQL transform that runs client-side
 * (DuckDB-WASM, browser sandbox). Selected queries get short aliases (q1, q2…)
 * to reference in the transform. Chart the result and pocket it as a live
 * pipeline recipe — no data stored.
 */
import { ref, reactive, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ChartSpec from '../components/charts/ChartSpec.vue'
import { useStudio } from '../composables/useStudio.js'
import { runSource } from '../composables/studioEngines.js'
import { useDuckDB } from '../composables/useDuckDB.js'
import { buildChartProps } from '../composables/studioPlot.js'
import { usePocket } from '../composables/usePocket.js'

const CHARTS = [{ key: 'bar_h', label: 'Bar' }, { key: 'ts_line', label: 'Line' }, { key: 'stat', label: 'Stat' }]
const route = useRoute()
const router = useRouter()
const studio = useStudio()
const { runTransform } = useDuckDB()
const { save: pocketSave } = usePocket()

const project = ref(null)
function hydrate() {
  project.value = studio.getProject(route.params.projectId)
  if (!project.value) router.replace('/studio')
}
hydrate()
watch(() => route.params.projectId, hydrate)

const selection = ref([]) // query ids, in selection order
const selected = computed(() => selection.value
  .map((id, idx) => ({ alias: `q${idx + 1}`, q: (project.value?.queries || []).find((x) => x.id === id) }))
  .filter((x) => x.q))

function toggle(id) {
  const i = selection.value.indexOf(id)
  if (i >= 0) selection.value.splice(i, 1)
  else selection.value.push(id)
}
function aliasOf(id) {
  const i = selection.value.indexOf(id)
  return i >= 0 ? `q${i + 1}` : ''
}

const transformSql = ref('')
const combine = reactive({ result: null, error: null, loading: false })
const plot = reactive({ chart: 'bar_h', x: '', y: '' })
const lastSources = ref([])

async function runCombine() {
  combine.loading = true; combine.error = null; combine.result = null
  try {
    const sel = selected.value
    if (!sel.length) throw new Error('Select at least one query to combine')
    const inputs = []; const sources = []
    for (const { alias, q } of sel) {
      const r = await runSource(q.lang, q.query)
      inputs.push({ name: alias, columns: r.columns, rows: r.rows })
      sources.push({ name: alias, lang: q.lang, query: q.query })
    }
    lastSources.value = sources
    const sql = transformSql.value.trim() || `SELECT * FROM ${inputs[0].name}`
    combine.result = await runTransform(inputs, sql)
    const cols = combine.result.columns
    if (!plot.x || !cols.includes(plot.x)) plot.x = cols[0] || ''
    if (!plot.y || !cols.includes(plot.y)) plot.y = cols.find((c) => c !== plot.x) || cols[0] || ''
  } catch (e) { combine.error = e.message } finally { combine.loading = false }
}

const chartProps = computed(() => buildChartProps(combine.result, plot))
const pocketed = ref(false)
function pocket() {
  pocketSave('pipeline', {
    data_params: { sources: lastSources.value, transform: transformSql.value },
    ui_params: { chart: plot.chart, x: plot.x, y: plot.y },
  }, `${project.value?.name || 'Studio'} · ${plot.y || 'plot'}`)
  pocketed.value = true
  setTimeout(() => { pocketed.value = false }, 2500)
}
</script>

<template>
  <div v-if="project" class="plotview" data-testid="studio-plot-view">
    <nav class="crumbs">
      <router-link to="/studio">Studio</router-link><span class="sep">/</span>
      <router-link :to="`/studio/p/${project.id}`">{{ project.name }}</router-link>
    </nav>
    <h1 class="ptitle">Combine &amp; plot</h1>

    <section class="grp">
      <h2 class="grp-title">1 · Pick queries</h2>
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
    </section>

    <section class="grp">
      <h2 class="grp-title">2 · Combine <span class="hint">— DuckDB SQL over {{ selected.map((s) => s.alias).join(', ') || 'your selected queries' }} (runs in your browser)</span></h2>
      <textarea
v-model="transformSql" class="editor" data-testid="plot-transform-sql" rows="4" spellcheck="false"
        placeholder="SELECT q1.country, q1.value AS a, q2.value AS b&#10;FROM q1 JOIN q2 ON q1.country = q2.country" />
      <div class="row">
        <button type="button" class="sbtn sbtn--primary" data-testid="plot-combine" :disabled="combine.loading || !selected.length" @click="runCombine">
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
        <label>X <select v-model="plot.x" data-testid="plot-x"><option v-for="c in combine.result.columns" :key="c" :value="c">{{ c }}</option></select></label>
        <label>Y <select v-model="plot.y" data-testid="plot-y"><option v-for="c in combine.result.columns" :key="c" :value="c">{{ c }}</option></select></label>
      </div>
      <div v-if="chartProps" class="pchart"><ChartSpec :chart="plot.chart" :chart-props="chartProps" /></div>
      <div class="row"><button type="button" class="sbtn sbtn--primary" data-testid="plot-pocket" @click="pocket">{{ pocketed ? 'Pocketed ✓' : 'Pocket this plot' }}</button></div>
    </section>
  </div>
</template>

<style scoped>
.plotview { max-width: 60rem; margin: 0 auto; padding: 0.5rem 1rem 4rem; }
.crumbs { font-size: 0.8rem; color: var(--muted); padding: 0.6rem 0; }
.crumbs a { color: var(--muted); text-decoration: none; }
.crumbs a:hover { color: var(--text); text-decoration: underline; }
.sep { margin: 0 0.4rem; }
.ptitle { font-size: 1.3rem; font-weight: 800; margin: 0 0 0.5rem; }
.grp { margin: 1.4rem 0; }
.grp-title { font-size: 1rem; font-weight: 700; margin: 0 0 0.6rem; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; }
.hint { font-weight: 400; font-size: 0.78rem; color: var(--muted); }
.empty { color: var(--muted); font-size: 0.88rem; }
.picks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.pick { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.5rem; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; }
.pick-name { font-size: 0.88rem; }
.pick-alias { margin-left: auto; font-size: 0.74rem; font-weight: 700; color: var(--accent); font-family: ui-monospace, monospace; }
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
