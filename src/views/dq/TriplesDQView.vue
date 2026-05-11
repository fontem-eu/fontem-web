<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import StatCard from '../../components/charts/StatCard.vue'
import HorizontalBarChart from '../../components/charts/HorizontalBarChart.vue'

onMounted(() => { document.title = 'Triple Store — Fontem' })

const data = ref(null)
const loading = ref(true)
const error = ref(null)
const selectedIri = ref(null)

onMounted(async () => {
  try {
    const r = await fetch('/api/data-quality/triples')
    if (r.ok) {
      data.value = await r.json()
      // Default the drill-down to the largest graph so the page
      // shows real content without a click.
      if (data.value.graphs?.length) selectedIri.value = data.value.graphs[0].iri
    } else {
      error.value = `HTTP ${r.status}`
    }
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
})

const totalTriples = computed(() => data.value?.total_triples ?? 0)
const graphCount = computed(() => data.value?.graphs?.length ?? 0)
const available = computed(() => data.value?.available ?? false)

const graphBars = computed(() =>
  (data.value?.graphs || []).map((g) => ({ label: g.label, value: g.triples })),
)

const selected = computed(
  () => data.value?.graphs?.find((g) => g.iri === selectedIri.value) || null,
)

const predicateBars = computed(() =>
  (selected.value?.top_predicates || []).map((p) => ({
    label: shortenIri(p.predicate),
    value: p.n,
  })),
)

const classBars = computed(() =>
  (selected.value?.classes || []).map((c) => ({
    label: shortenIri(c.class),
    value: c.n,
  })),
)

// Trim known prefixes so the bar labels stay readable. Falls back to
// the local part of the IRI when nothing matches.
const PREFIXES = [
  ['http://data.fontem.eu/ontology#', 'fontem:'],
  ['http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'rdf:'],
  ['http://www.w3.org/2000/01/rdf-schema#', 'rdfs:'],
  ['http://www.w3.org/2002/07/owl#', 'owl:'],
  ['http://www.w3.org/2004/02/skos/core#', 'skos:'],
  ['http://www.w3.org/2001/XMLSchema#', 'xsd:'],
  ['https://schema.org/', 'schema:'],
  ['http://data.europa.eu/a4g/ontology#', 'epo:'],
]

function shortenIri(iri) {
  if (!iri) return ''
  for (const [base, prefix] of PREFIXES) {
    if (iri.startsWith(base)) return prefix + iri.slice(base.length)
  }
  const lastSlash = Math.max(iri.lastIndexOf('/'), iri.lastIndexOf('#'))
  return lastSlash >= 0 ? iri.slice(lastSlash + 1) : iri
}

const generatedAt = computed(() => {
  if (!data.value?.generated_at) return null
  try {
    return new Date(data.value.generated_at).toLocaleString()
  } catch {
    return data.value.generated_at
  }
})
</script>

<template>
  <div class="dq" data-testid="triples-dq">
    <header class="dq-hdr">
      <div>
        <router-link to="/data-quality" class="dq-back">&larr; Data Quality</router-link>
        <h1>Triple store</h1>
        <p class="dq-sub">
          RDF inventory in the Virtuoso store —
          totals, per-named-graph counts, and the class/predicate
          shape of each graph. Sourced by SPARQL against
          <code>http://data.fontem.eu/graph/*</code>.
        </p>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="loading" class="dq-loading">Loading…</div>

    <div
      v-else-if="error"
      class="dq-error"
      data-testid="triples-dq-error"
    >
      Could not load triple-store stats: {{ error }}
    </div>

    <div
      v-else-if="!available"
      class="dq-empty"
      data-testid="triples-dq-unconfigured"
    >
      <h2>Virtuoso not configured in this environment</h2>
      <p>
        This environment has no RDF store wired up — the sanctions,
        filings, and other Phase&nbsp;2 RDF graphs only exist where
        <code>VIRTUOSO_SPARQL_URL</code> is set on the gmr-api
        deployment. Check the staging or prod dashboard for live numbers.
      </p>
    </div>

    <template v-else>
      <div class="dq-stats">
        <StatCard
          :value="totalTriples.toLocaleString()"
          label="Total triples"
          data-testid="triples-total"
        />
        <StatCard
          :value="graphCount.toLocaleString()"
          label="Named graphs"
          data-testid="triples-graph-count"
        />
        <StatCard
          v-if="generatedAt"
          :value="generatedAt"
          label="Snapshot taken"
        />
      </div>

      <section class="dq-section" data-testid="triples-per-graph">
        <h2>Triples per named graph</h2>
        <p class="dq-hint">
          Click a graph to inspect its class and predicate breakdown.
        </p>
        <ul class="graph-list">
          <li
            v-for="g in data.graphs"
            :key="g.iri"
            class="graph-row"
            :class="{ active: g.iri === selectedIri }"
            :data-testid="`triples-graph-row-${g.label}`"
            tabindex="0"
            role="button"
            @click="selectedIri = g.iri"
            @keydown.enter="selectedIri = g.iri"
          >
            <span class="graph-row-label">{{ g.label }}</span>
            <span class="graph-row-count">{{ g.triples.toLocaleString() }}</span>
          </li>
        </ul>
        <details class="dq-collapsible">
          <summary>Chart view</summary>
          <HorizontalBarChart :data="graphBars" :max-bars="20" />
        </details>
      </section>

      <section
        v-if="selected"
        :key="selected.iri"
        class="dq-section"
        data-testid="triples-graph-detail"
      >
        <h2>
          {{ selected.label }}
          <span class="graph-iri-suffix">— {{ selected.iri }}</span>
        </h2>

        <div class="dq-twocol">
          <div>
            <h3>Top classes <span class="dq-count">({{ selected.classes.length }})</span></h3>
            <HorizontalBarChart
              v-if="classBars.length"
              :data="classBars"
              :max-bars="15"
            />
            <p v-else class="dq-empty-inline">
              No <code>rdf:type</code> assertions in this graph.
            </p>
          </div>
          <div>
            <h3>Top predicates <span class="dq-count">({{ selected.top_predicates.length }})</span></h3>
            <HorizontalBarChart
              v-if="predicateBars.length"
              :data="predicateBars"
              :max-bars="15"
            />
            <p v-else class="dq-empty-inline">
              No triples in this graph.
            </p>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dq { max-width: 1100px; margin: 0 auto; padding: 0 1rem 4rem; }
.dq-hdr {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.5rem 0 1rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1.5rem;
}
.dq-hdr h1 { font-size: 1.3rem; font-weight: 700; margin: 0.3rem 0 0; }
.dq-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.dq-sub { font-size: 0.82rem; color: var(--muted); margin-top: 0.15rem; max-width: 70ch; }
.dq-loading { text-align: center; padding: 3rem; color: var(--muted); }
.dq-error {
  background: var(--bg-alt, #fef2f2);
  color: #991b1b;
  padding: 1rem;
  border-radius: 4px;
}
.dq-empty {
  padding: 2rem;
  text-align: center;
  color: var(--muted);
  border: 1px dashed var(--border);
  border-radius: 4px;
}
.dq-empty h2 { font-size: 1rem; margin-bottom: 0.5rem; color: var(--fg); }
.dq-empty-inline { color: var(--muted); font-style: italic; }
.dq-stats { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.dq-section { margin-bottom: 2rem; }
.dq-section h2 {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.4rem;
}
.dq-section h3 {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
}
.dq-hint { font-size: 0.78rem; color: var(--muted); margin-bottom: 0.75rem; }
.dq-count { color: var(--muted); font-weight: 400; font-size: 0.8rem; }
.dq-twocol { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
@media (max-width: 720px) { .dq-twocol { grid-template-columns: 1fr; } }

.graph-list {
  list-style: none;
  padding: 0;
  margin: 0 0 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.graph-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0.6rem;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.85rem;
  background: var(--bg-alt, #f9fafb);
  outline: none;
}
.graph-row:hover, .graph-row:focus {
  background: var(--bg-hover, #eef2ff);
}
.graph-row.active {
  background: var(--accent, #2563eb);
  color: white;
}
.graph-row-label { font-family: ui-monospace, monospace; font-size: 0.78rem; }
.graph-row-count { font-variant-numeric: tabular-nums; }

.dq-collapsible summary {
  cursor: pointer;
  font-size: 0.82rem;
  color: var(--muted);
  margin: 0.5rem 0;
}
.graph-iri-suffix {
  font-weight: 400;
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
  color: var(--muted);
  word-break: break-all;
}
</style>
