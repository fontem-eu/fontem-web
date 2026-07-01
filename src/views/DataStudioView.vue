<script setup>
/**
 * Data Studio — where analysts define queries (Cypher / SQL / SPARQL) against
 * Fontem's stores, see the results as a table, and (later) combine + plot them.
 * v1: a toolbar with a "New query" action that opens a read-only query panel.
 * All execution is read-only + capped server-side.
 */
import { ref, computed, onMounted } from 'vue'

const ENGINES = [
  { key: 'cypher', label: 'Cypher', store: 'Neo4j graph', path: '/api/query/cypher',
    sample: 'MATCH (c:Company)-[:AWARDED_TO]-(ct:Contract)\nRETURN c.name AS company, count(ct) AS contracts\nORDER BY contracts DESC LIMIT 20' },
  { key: 'sql', label: 'SQL', store: 'stats / Eurostat', path: '/api/query/sql',
    sample: "SELECT geo_code, year, value\nFROM observation\nWHERE dataset = 'crim_off_cat'\nLIMIT 50" },
  { key: 'sparql', label: 'SPARQL', store: 'Virtuoso RDF', path: '/api/sparql',
    sample: 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 20' },
]

onMounted(() => { document.title = 'Data Studio — Fontem' })

const panelOpen = ref(false)
const lang = ref('cypher')
const query = ref('')
const loading = ref(false)
const error = ref(null)
const result = ref(null) // { columns, rows, truncated }

const engine = computed(() => ENGINES.find((e) => e.key === lang.value))

function newQuery() {
  panelOpen.value = true
  error.value = null; result.value = null
  query.value = engine.value.sample
}
function pickLang(k) {
  lang.value = k
  if (!query.value.trim() || ENGINES.some((e) => e.sample === query.value)) query.value = engine.value.sample
}

async function run() {
  if (!query.value.trim()) return
  loading.value = true; error.value = null; result.value = null
  try {
    const res = await fetch(engine.value.path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query.value }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`)
    if (lang.value === 'sparql') {
      const cols = body.head?.vars || []
      const rows = (body.results?.bindings || []).map((b) => cols.map((c) => b[c]?.value ?? ''))
      result.value = { columns: cols, rows, truncated: false }
    } else {
      result.value = { columns: body.columns || [], rows: body.rows || [], truncated: !!body.truncated }
    }
  } catch (e) { error.value = e.message } finally { loading.value = false }
}
</script>

<template>
  <div class="studio" data-testid="data-studio">
    <!-- Toolbar -->
    <div class="studio-toolbar" data-testid="studio-toolbar">
      <h1 class="studio-title">Data Studio</h1>
      <div class="studio-actions">
        <button type="button" class="studio-btn studio-btn--primary" data-testid="studio-new-query" @click="newQuery">
          + New query
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!panelOpen" class="studio-empty" data-testid="studio-empty">
      <p>Define a query against the graph, the stats store, or the RDF triples — then run it to see the results.</p>
      <p class="studio-empty-hint">Combining queries and plotting them comes next; for now, explore.</p>
    </div>

    <!-- Query panel -->
    <div v-else class="studio-panel" data-testid="studio-panel">
      <div class="studio-langs" role="tablist">
        <button
          v-for="e in ENGINES" :key="e.key" type="button" role="tab"
          class="studio-lang" :class="{ active: lang === e.key }"
          :data-testid="'studio-lang-' + e.key" @click="pickLang(e.key)"
        >{{ e.label }}<span class="studio-lang-store">{{ e.store }}</span></button>
      </div>

      <textarea
        v-model="query" class="studio-editor" data-testid="studio-editor" spellcheck="false"
        :placeholder="engine.sample" rows="6"
      />

      <div class="studio-run-row">
        <button type="button" class="studio-btn studio-btn--primary" data-testid="studio-run" :disabled="loading || !query.trim()" @click="run">
          {{ loading ? 'Running…' : 'Run' }}
        </button>
        <span class="studio-run-note">Read-only · max 1000 rows · 8s timeout</span>
      </div>

      <div v-if="error" class="studio-error" data-testid="studio-error">{{ error }}</div>

      <div v-if="result" class="studio-results" data-testid="studio-results">
        <div class="studio-results-meta">
          {{ result.rows.length }} row{{ result.rows.length === 1 ? '' : 's' }}
          <span v-if="result.truncated" class="studio-trunc">(capped at 1000)</span>
        </div>
        <div v-if="result.columns.length" class="studio-table-wrap">
          <table class="studio-table">
            <thead><tr><th v-for="c in result.columns" :key="c">{{ c }}</th></tr></thead>
            <tbody>
              <tr v-for="(row, i) in result.rows" :key="i">
                <td v-for="(cell, j) in row" :key="j">{{ cell }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="studio-empty-result">Query ran, no columns returned.</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.studio { max-width: 72rem; margin: 0 auto; padding: 0 1rem 4rem; }
.studio-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid var(--border); position: sticky; top: var(--bezel-h, 3.25rem); background: var(--bg); z-index: 5; }
.studio-title { font-size: 1.2rem; font-weight: 700; margin: 0; }
.studio-btn { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 8px; padding: 0.45rem 0.9rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
.studio-btn--primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.studio-btn:disabled { opacity: 0.5; cursor: default; }
.studio-empty { text-align: center; color: var(--muted); padding: 3rem 1rem; }
.studio-empty-hint { font-size: 0.82rem; opacity: 0.8; }
.studio-panel { padding: 1rem 0; }
.studio-langs { display: flex; gap: 0.5rem; margin-bottom: 0.6rem; flex-wrap: wrap; }
.studio-lang { display: flex; flex-direction: column; align-items: flex-start; border: 1px solid var(--border); background: var(--surface); color: var(--muted); border-radius: 8px; padding: 0.4rem 0.7rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; line-height: 1.2; }
.studio-lang.active { border-color: var(--accent); color: var(--text); background: color-mix(in srgb, var(--accent) 12%, var(--surface)); }
.studio-lang-store { font-size: 0.68rem; font-weight: 400; opacity: 0.7; }
.studio-editor { width: 100%; box-sizing: border-box; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85rem; border: 1px solid var(--border); border-radius: 8px; padding: 0.7rem; background: var(--surface); color: var(--text); resize: vertical; }
.studio-run-row { display: flex; align-items: center; gap: 0.8rem; margin: 0.6rem 0; }
.studio-run-note { font-size: 0.75rem; color: var(--muted); }
.studio-error { color: #dc2626; font-size: 0.85rem; padding: 0.6rem 0.8rem; border: 1px solid #f2c0c0; border-radius: 8px; background: #fdf3f3; white-space: pre-wrap; }
.studio-results-meta { font-size: 0.8rem; color: var(--muted); margin: 0.8rem 0 0.4rem; }
.studio-trunc { color: #d97706; }
.studio-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
.studio-table { border-collapse: collapse; width: 100%; font-size: 0.82rem; }
.studio-table th, .studio-table td { text-align: left; padding: 0.4rem 0.7rem; border-bottom: 1px solid var(--border); white-space: nowrap; }
.studio-table th { background: var(--bezel); font-weight: 600; position: sticky; top: 0; }
.studio-empty-result { color: var(--muted); font-size: 0.85rem; padding: 0.8rem; }
</style>
