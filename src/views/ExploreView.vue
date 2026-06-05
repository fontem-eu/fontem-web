<script setup>
/**
 * Explore — top-level hub for browse-by-source destinations.
 *
 * Replaces direct nav-bar access to /data-quality with a curated
 * landing page so the platform's pipeline / data-quality / graph
 * surfaces sit together in one place. Each card is a router-link
 * to an existing destination — this view doesn't own any data, it
 * just groups the existing entry points.
 */
import { RouterLink } from 'vue-router'

const SECTIONS = [
  {
    key: 'data-quality',
    title: 'Data Quality',
    description: 'Coverage + freshness dashboards for every ingest source — TED contracts, EDGAR filings, GLEIF entities, ESEF iXBRL reports, lobbying registers, sanctions, FIRDS, CDP, NUTS regions.',
    cta: 'Open the Data Quality hub',
    to: '/data-quality',
    testid: 'explore-card-data-quality',
  },
  {
    key: 'sparql',
    title: 'SPARQL Endpoint',
    description: 'Query the knowledge graph directly with SPARQL. Same datasets that drive the rest of the platform, exposed as triples.',
    cta: 'Open SPARQL playground',
    to: '/sparql',
    testid: 'explore-card-sparql',
  },
  {
    key: 'geo',
    title: 'Geographic Explorer',
    description: 'Browse companies + procurement by NUTS region and country. Useful starting point when you want to see who operates where before drilling into individual entities.',
    cta: 'Open Geo Explorer',
    to: '/geo',
    testid: 'explore-card-geo',
  },
]
</script>

<template>
  <div class="explore" data-testid="explore-view">
    <header class="explore-header">
      <h1>{{ $t('explore.explore') }}</h1>
      <p>
        Browse the platform's source-of-truth dashboards and direct-query
        surfaces. Pick a card to dig into the data behind the stories.
      </p>
    </header>

    <div class="explore-grid" data-testid="explore-grid">
      <RouterLink
        v-for="s in SECTIONS"
        :key="s.key"
        :to="s.to"
        :data-testid="s.testid"
        class="explore-card"
      >
        <h2>{{ s.title }}</h2>
        <p>{{ s.description }}</p>
        <span class="explore-cta">{{ s.cta }} →</span>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.explore {
  max-width: 60rem;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

.explore-header h1 {
  margin: 0 0 0.25rem;
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text);
}

.explore-header p {
  margin: 0 0 1.5rem;
  color: var(--muted);
  font-size: 0.85rem;
  max-width: 40rem;
}

.explore-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: 1rem;
}

.explore-card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 1.25rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  text-decoration: none;
  transition: border-color 0.15s, transform 0.15s;
}

.explore-card:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}

.explore-card h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.explore-card p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.45;
}

.explore-cta {
  margin-top: auto;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--accent);
}
</style>
