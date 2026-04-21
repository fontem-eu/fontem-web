<script setup>
import { onMounted } from 'vue'

onMounted(() => { document.title = 'SPARQL — Fontem' })

/**
 * Example queries that showcase Fontem-specific concepts. These run
 * against the SPARQL endpoint once neosemantics is installed in the
 * Neo4j pod. Until then this page ships with the queries pre-written
 * so researchers know what's coming and can plan their integrations.
 */
const EXAMPLES = [
  {
    title: 'All companies that received EU procurement awards',
    query:
`PREFIX schema: <https://schema.org/>
PREFIX epo: <http://data.europa.eu/a4g/ontology#>

SELECT ?company ?name ?totalEur WHERE {
  ?contract a epo:Contract ;
            epo:awardedTo ?company ;
            schema:amount ?amount .
  ?company schema:name ?name .
  BIND (xsd:decimal(?amount) AS ?totalEur)
}
ORDER BY DESC(?totalEur)
LIMIT 100`,
  },
  {
    title: 'Lobbyists representing sanctioned entities',
    query:
`PREFIX schema: <https://schema.org/>
PREFIX fontem: <https://fontem.eu/ontology#>

SELECT ?lobbyist ?lobbyistName ?company ?companyName WHERE {
  ?company a fontem:SanctionedEntity ;
           schema:name ?companyName .
  ?lobbyist fontem:represents ?company ;
            schema:name ?lobbyistName .
}`,
  },
  {
    title: 'Top 20 contracting authorities by total awarded value',
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
</script>

<template>
  <div class="sparql-page" data-testid="sparql">
    <header class="sparql-hdr">
      <h1>SPARQL endpoint</h1>
      <p class="sparql-sub">
        Query the Fontem knowledge graph directly. Companies, contracts,
        authorities, lobbyists, sanctions — all linked. Use from
        OpenRefine, a notebook, a research pipeline, or your own tooling.
      </p>
    </header>

    <!-- Live endpoint details -->
    <section class="sparql-meta" aria-label="Endpoint">
      <dl>
        <dt>Endpoint URL</dt>
        <dd><code>https://fontem.eu/api/sparql</code></dd>
        <dt>Method</dt>
        <dd><code>POST</code> with <code>application/sparql-query</code> body, or <code>GET ?query=…</code></dd>
        <dt>Accept</dt>
        <dd><code>application/sparql-results+json</code>, <code>text/csv</code>, <code>text/turtle</code></dd>
        <dt>Rate limit</dt>
        <dd>10 queries/min anonymous, 60/min with an API key</dd>
        <dt>Status</dt>
        <dd>
          <strong>Scaffolding in place, graph adapter not yet live.</strong>
          We're finalising the neosemantics install on the production
          Neo4j pod. The endpoint returns <code>501</code> until that lands.
          <a href="https://fontem.eu/.well-known/void.ttl">VoID metadata</a>
          will describe the dataset once it's queryable.
        </dd>
      </dl>
    </section>

    <!-- Example queries so researchers can see the shape today -->
    <section class="sparql-examples" aria-label="Example queries">
      <h2>Example queries</h2>
      <p class="sparql-hint">
        Copy-paste into your SPARQL client. The vocabulary mixes
        <a href="https://schema.org/">schema.org</a> with the EU
        <a href="https://data.europa.eu/snb/procurement/">eProcurement ontology</a>
        where schema.org has gaps.
      </p>
      <article
        v-for="(ex, i) in EXAMPLES"
        :key="i"
        class="sparql-example"
      >
        <h3>{{ ex.title }}</h3>
        <pre><code>{{ ex.query }}</code></pre>
      </article>
    </section>
  </div>
</template>

<style scoped>
.sparql-page {
  max-width: 56rem;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
  color: var(--text);
}
.sparql-hdr h1 {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
}
.sparql-sub {
  font-size: 0.9rem;
  color: var(--muted);
  margin: 0 0 2rem;
  line-height: 1.55;
}
.sparql-meta {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  background: var(--surface);
  margin-bottom: 2rem;
}
.sparql-meta dl {
  display: grid;
  grid-template-columns: 10rem 1fr;
  gap: 0.4rem 1rem;
  margin: 0;
  font-size: 0.85rem;
}
.sparql-meta dt { color: var(--muted); font-weight: 600; }
.sparql-meta dd { margin: 0; color: var(--text); }
.sparql-meta code {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 0.82rem;
  background: var(--bg);
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
}
.sparql-examples h2 {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0 0 0.4rem;
}
.sparql-hint {
  font-size: 0.82rem;
  color: var(--muted);
  margin: 0 0 1.5rem;
  line-height: 1.55;
}
.sparql-example {
  border-left: 2px solid var(--brand-primary);
  padding-left: 1rem;
  margin-bottom: 1.75rem;
}
.sparql-example h3 {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
}
.sparql-example pre {
  margin: 0;
  padding: 0.75rem 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow-x: auto;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 0.78rem;
  line-height: 1.5;
}
</style>
