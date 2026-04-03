<script setup>
import { onMounted } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

onMounted(() => { document.title = 'Admin — GMR' })

const tools = [
  { path: '/admin/data-quality', title: 'Data Quality', desc: 'Graph stats, entity resolution metrics, data freshness, country coverage.' },
  { path: '/admin/entity-resolution', title: 'Entity Resolution', desc: 'Review and merge duplicate company nodes (git-merge-style UI).' },
  { path: '/admin/architecture', title: 'Architecture', desc: 'System diagrams: data flow, interfaces, Neo4j schema, request lifecycle.' },
  { path: '/admin/coverage', title: 'E2E Coverage', desc: 'Requirements × e2e test matrix. 30 requirements, 175+ tests, generated at build time.' },
  { path: '/admin/roadmap', title: 'Mission & Roadmap', desc: 'Platform mission, vision for 2027, and proposed features with data sources.' },
  { path: '/admin/plan', title: 'Implementation Plan', desc: 'Auth, collaborative reports, embeddable visualizations, community curation, moderation, and security test plan.' },
]
</script>

<template>
  <div class="adm">
    <header class="adm-header">
      <div>
        <router-link to="/" class="adm-back">&larr; Home</router-link>
        <h1>Admin</h1>
        <p class="adm-sub">Operational tools, architecture docs, and platform health</p>
      </div>
      <ThemeToggle />
    </header>
    <div class="adm-grid">
      <template v-for="t in tools" :key="t.path">
        <a v-if="t.external" :href="t.path" class="adm-card">
          <h2>{{ t.title }}</h2>
          <p>{{ t.desc }}</p>
        </a>
        <router-link v-else :to="t.path" class="adm-card">
          <h2>{{ t.title }}</h2>
          <p>{{ t.desc }}</p>
        </router-link>
      </template>
    </div>
  </div>
</template>

<style scoped>
.adm { max-width: 900px; margin: 0 auto; padding: 0 1rem 4rem; }
.adm-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.adm-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0.3rem 0 0; }
.adm-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.adm-sub { font-size: 0.85rem; color: var(--muted); margin-top: 0.2rem; }
.adm-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; }
.adm-card { display: block; padding: 1.25rem; background: var(--surface, #f6f8fa); border: 1px solid var(--border); border-radius: 10px; text-decoration: none; color: inherit; transition: border-color 0.15s; }
.adm-card:hover { border-color: var(--accent); }
.adm-card h2 { font-size: 1rem; font-weight: 700; margin-bottom: 0.4rem; color: var(--accent); }
.adm-card p { font-size: 0.85rem; color: var(--muted); margin: 0; }
</style>
