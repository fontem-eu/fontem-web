<script setup>
import { onMounted, ref, computed } from 'vue'

onMounted(() => { document.title = 'SPARQL — Fontem' })

// ── Examples ────────────────────────────────────────────────────
// These run against /api/sparql today. The first one is the default
// query the textarea ships with so the user can hit Run on landing
// without having to write SPARQL from scratch.
const EXAMPLES = [
  {
    title: 'sparql.triple_store_inventory',
    description: 'sparql.sanity_check_store_data',
    query:
`SELECT ?g (COUNT(*) AS ?triples) WHERE {
  GRAPH ?g { ?s ?p ?o }
  FILTER(STRSTARTS(STR(?g), "http://data.fontem.eu/graph/"))
}
GROUP BY ?g
ORDER BY DESC(?triples)`,
  },
  {
    title: 'sparql.sample_sanctioned_entities',
    description: 'sparql.replace_limit_hint',
    query:
`PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX schema: <https://schema.org/>

SELECT ?entity ?name WHERE {
  GRAPH <http://data.fontem.eu/graph/sanctions> {
    ?entity rdf:type schema:Organization ;
            schema:name ?name .
  }
} LIMIT 5`,
  },
  {
    title: 'sparql.top_authorities_by_awarded_value',
    description: 'sparql.shape_compatible_procurement_graph',
    query:
`PREFIX schema: <https://schema.org/>
PREFIX epo: <http://data.europa.eu/a4g/ontology#>

SELECT ?authority ?name (SUM(?amount) AS ?total) WHERE {
  ?contract a epo:Contract ;
            epo:awardedBy ?authority ;
            schema:amount ?amount .
  ?authority schema:name ?name .
}
GROUP BY ?authority ?name
ORDER BY DESC(?total)
LIMIT 20`,
  },
]

// ── Editor state ────────────────────────────────────────────────
const query = ref(EXAMPLES[0].query)
const running = ref(false)
const results = ref(null)   // { head: { vars }, results: { bindings } }
const error = ref(null)
const elapsedMs = ref(null)

async function runQuery() {
  if (running.value) return
  running.value = true
  error.value = null
  results.value = null
  const startedAt = performance.now()
  try {
    const res = await fetch('/api/sparql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query.value }),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      // FastAPI shape: `{ detail: "..." }` for HTTPException; fall
      // back to the generic status if the proxy itself fell over
      // before re-encoding.
      const message = body?.detail || `HTTP ${res.status} ${res.statusText}`
      throw new Error(message)
    }
    results.value = body
  } catch (e) {
    error.value = e.message
  } finally {
    elapsedMs.value = Math.round(performance.now() - startedAt)
    running.value = false
  }
}

function loadExample(ex) {
  query.value = ex.query
}

function clearEditor() {
  query.value = ''
  results.value = null
  error.value = null
  elapsedMs.value = null
}

// Cmd/Ctrl+Enter in the textarea fires Run — the standard SPARQL
// editor shortcut, expected by anyone coming from YASGUI.
function onEditorKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    runQuery()
  }
}

// ── Results derived state ───────────────────────────────────────
const headVars = computed(() => results.value?.head?.vars || [])
const resultRows = computed(() => results.value?.results?.bindings || [])

function cellText(row, varName) {
  const cell = row[varName]
  if (cell == null) return ''
  return cell.value ?? ''
}

function cellIsIri(row, varName) {
  return row[varName]?.type === 'uri'
}
</script>

<template>
  <div class="sparql-page" data-testid="sparql">
    <header class="sparql-hdr">
      <h1>{{ $t('sparql.sparql_endpoint') }}</h1>
      <p class="sparql-sub">{{ $t('sparql.intro') }}</p>
    </header>

    <!-- Live endpoint details — documentation users can copy into
         curl / Python / OpenRefine. -->
    <section class="sparql-meta" :aria-label="$t('sparql.endpoint')" data-testid="sparql-meta">
      <dl>
        <dt>{{ $t('sparql.endpoint_url') }}</dt>
        <dd><code data-testid="sparql-endpoint-url">https://www.fontem.eu/api/sparql</code></dd>
        <dt>{{ $t('sparql.method') }}</dt>
        <dd><code>{{ $t('sparql.post') }}</code> with <code>application/json</code> body <code>{"query": "…"}</code>. <code>{{ $t('sparql.get_apisparql') }}</code> {{ $t('sparql.discoverable_json') }}</dd>
        <dt>{{ $t('sparql.response') }}</dt>
        <dd>{{ $t('sparql.sparql_11_json_results_envelope') }}<code>{head, results: {bindings}}</code>.</dd>
        <dt>{{ $t('sparql.limits') }}</dt>
        <dd>{{ $t('sparql.query_cap_note') }}</dd>
      </dl>
    </section>

    <!-- ── Live query editor ─────────────────────────────────── -->
    <section class="sparql-editor-section" data-testid="sparql-editor-section">
      <div class="sparql-editor-header">
        <h2>{{ $t('sparql.try_a_query') }}</h2>
        <span class="sparql-shortcut" aria-hidden="true">{{ $t('sparql.run_shortcut') }}</span>
      </div>
      <textarea
        v-model="query"
        class="sparql-editor"
        data-testid="sparql-editor"
        spellcheck="false"
        rows="10"
        :disabled="running"
        @keydown="onEditorKeydown"
      ></textarea>
      <div class="sparql-actions">
        <button
          type="button"
          class="sparql-run-btn"
          data-testid="sparql-run"
          :disabled="running || !query.trim()"
          @click="runQuery"
        >{{ running ? $t('app.running_progress') : $t('app.run_query') }}</button>
        <button
          type="button"
          class="sparql-clear-btn"
          data-testid="sparql-clear"
          :disabled="running"
          @click="clearEditor"
        >{{ $t('app.clear') }}</button>
        <span v-if="elapsedMs != null && !running" class="sparql-elapsed" data-testid="sparql-elapsed">
          {{ resultRows.length }} {{ $t('sparql.row') }}{{ resultRows.length === 1 ? '' : 's' }} in {{ elapsedMs }} ms
        </span>
      </div>

      <!-- ── Output ─────────────────────────────────────────── -->
      <div v-if="error" class="sparql-error" data-testid="sparql-error">
        <strong>{{ $t('sparql.query_failed') }}</strong> {{ error }}
      </div>

      <div
        v-else-if="results && headVars.length"
        class="sparql-results-wrap"
        data-testid="sparql-results"
      >
        <table class="sparql-results-table">
          <thead>
            <tr>
              <th v-for="v in headVars" :key="v">{{ v }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in resultRows" :key="i">
              <td v-for="v in headVars" :key="v">
                <a
                  v-if="cellIsIri(row, v)"
                  :href="cellText(row, v)"
                  target="_blank"
                  rel="noopener"
                  class="sparql-iri"
                >{{ cellText(row, v) }}</a>
                <template v-else>{{ cellText(row, v) }}</template>
              </td>
            </tr>
            <tr v-if="!resultRows.length">
              <td :colspan="headVars.length" class="sparql-empty">{{ $t('sparql.no_rows') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-else-if="results"
        class="sparql-results-empty"
        data-testid="sparql-results-empty"
      >{{ $t('sparql.query_returned_no_projected_columns') }}</div>
    </section>

    <!-- ── Example queries — clicking any of them loads the
         query into the editor so the user can edit + run. -->
    <section class="sparql-examples" :aria-label="$t('sparql.example_queries')">
      <h2>{{ $t('sparql.example_queries') }}</h2>
      <p class="sparql-hint">
        {{ $t('sparql.click') }} <em>{{ $t('sparql.use_this_query') }}</em> {{ $t('sparql.drop_query_into_editor_hint') }}
        <a href="https://schema.org/">schema.org</a>
        {{ $t('sparql.with_the_eu') }}
        <a href="https://data.europa.eu/snb/procurement/">{{ $t('sparql.eprocurement_ontology') }}</a>
        {{ $t('sparql.where_schemaorg_has_gaps') }}
      </p>
      <article
        v-for="(ex, i) in EXAMPLES"
        :key="i"
        class="sparql-example"
      >
        <div class="sparql-example-header">
          <h3>{{ $t(ex.title) }}</h3>
          <button
            type="button"
            class="sparql-example-load"
            :data-testid="`sparql-example-load-${i}`"
            @click="loadExample(ex)"
          >{{ $t('sparql.use_this_query') }} →</button>
        </div>
        <p v-if="ex.description" class="sparql-example-desc">{{ $t(ex.description) }}</p>
        <pre><code>{{ ex.query }}</code></pre>
      </article>
    </section>
  </div>
</template>

<style scoped>
.sparql-page {
  max-width: 64rem;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
  color: var(--text);
}
.sparql-hdr h1 { font-size: 1.6rem; font-weight: 700; margin: 0 0 0.25rem; }
.sparql-sub { font-size: 0.9rem; color: var(--muted); margin: 0 0 1.75rem; line-height: 1.55; }

.sparql-meta { border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.25rem; background: var(--surface); margin-bottom: 2rem; }
.sparql-meta dl { display: grid; grid-template-columns: 8rem 1fr; gap: 0.4rem 1rem; margin: 0; font-size: 0.85rem; }
.sparql-meta dt { color: var(--muted); font-weight: 600; }
.sparql-meta dd { margin: 0; color: var(--text); }
.sparql-meta code { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 0.82rem; background: var(--bg); padding: 0.1rem 0.35rem; border-radius: 3px; }

/* ── Editor ───────────────────────────────────────────── */
.sparql-editor-section { margin-bottom: 2rem; }
.sparql-editor-header { display: flex; align-items: baseline; justify-content: space-between; margin: 0 0 0.5rem; }
.sparql-editor-header h2 { font-size: 1.05rem; font-weight: 700; margin: 0; }
.sparql-shortcut { font-size: 0.75rem; color: var(--muted); }
.sparql-editor {
  width: 100%;
  min-height: 14rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  tab-size: 2;
  resize: vertical;
  box-sizing: border-box;
}
.sparql-editor:focus { outline: 2px solid var(--accent); outline-offset: 0; border-color: var(--accent); }
.sparql-editor:disabled { opacity: 0.6; cursor: progress; }
.sparql-actions { display: flex; align-items: center; gap: 0.6rem; margin: 0.75rem 0 1rem; }
.sparql-run-btn { padding: 0.5rem 1rem; border: 0; border-radius: 6px; background: var(--accent, #0a66c2); color: #fff; font-weight: 600; font-size: 0.85rem; cursor: pointer; }
.sparql-run-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sparql-clear-btn { padding: 0.5rem 0.85rem; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--muted); font-size: 0.85rem; cursor: pointer; }
.sparql-clear-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sparql-elapsed { font-size: 0.78rem; color: var(--muted); margin-left: auto; }

.sparql-error { padding: 0.75rem 1rem; border-radius: 6px; background: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220, 38, 38, 0.25); color: #b91c1c; font-size: 0.85rem; }
.sparql-results-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
.sparql-results-table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
.sparql-results-table th { text-align: left; padding: 0.5rem 0.75rem; background: var(--bg); color: var(--muted); font-weight: 600; border-bottom: 1px solid var(--border); font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
.sparql-results-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); vertical-align: top; font-family: ui-monospace, 'SF Mono', Menlo, monospace; word-break: break-word; }
.sparql-results-table tr:last-child td { border-bottom: none; }
.sparql-iri { color: var(--accent); text-decoration: none; }
.sparql-iri:hover { text-decoration: underline; }
.sparql-empty { color: var(--muted); padding: 1rem; text-align: center; }
.sparql-results-empty { padding: 1rem; border: 1px dashed var(--border); border-radius: 8px; color: var(--muted); font-size: 0.85rem; text-align: center; }

/* ── Examples ─────────────────────────────────────────── */
.sparql-examples h2 { font-size: 1.05rem; font-weight: 700; margin: 0 0 0.4rem; }
.sparql-hint { font-size: 0.82rem; color: var(--muted); margin: 0 0 1.5rem; line-height: 1.55; }
.sparql-example { border-left: 2px solid var(--accent, #0a66c2); padding-left: 1rem; margin-bottom: 1.75rem; }
.sparql-example-header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; margin: 0 0 0.25rem; }
.sparql-example-header h3 { font-size: 0.95rem; font-weight: 600; margin: 0; }
.sparql-example-load { padding: 0.25rem 0.6rem; border: 1px solid var(--border); border-radius: 5px; background: var(--surface); color: var(--accent); font-size: 0.75rem; font-weight: 500; cursor: pointer; }
.sparql-example-load:hover { border-color: var(--accent); }
.sparql-example-desc { font-size: 0.78rem; color: var(--muted); margin: 0 0 0.5rem; }
.sparql-example pre { margin: 0; padding: 0.75rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; overflow-x: auto; font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 0.78rem; line-height: 1.5; }
</style>
