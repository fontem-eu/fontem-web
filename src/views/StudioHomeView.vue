<script setup>
/**
 * Data Studio — home. Lists the user's data projects (server-backed) or an
 * empty state, and creates new ones (created immediately, renamed inline in the
 * project view — no browser prompts).
 */
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStudio } from '../composables/useStudio.js'

const router = useRouter()
const studio = useStudio()
onMounted(() => studio.ensureLoaded())

async function newProject() {
  const p = await studio.createProject('Untitled project')
  router.push(`/studio/p/${p.id}?new=1`)
}
</script>

<template>
  <div class="home" data-testid="studio-home">
    <div class="home-head">
      <div>
        <h1 class="home-title">Data Studio</h1>
        <p class="home-sub">Pull data with read-only queries, combine it in your browser, and chart it.</p>
      </div>
      <button type="button" class="sbtn sbtn--primary" data-testid="studio-new-project" @click="newProject">+ New project</button>
    </div>

    <p v-if="studio.loading.value && !studio.loaded.value" class="muted" data-testid="studio-loading">Loading your projects…</p>
    <p v-else-if="studio.error.value" class="err">{{ studio.error.value }}</p>
    <p v-else-if="!studio.projects.value.length" class="empty" data-testid="studio-empty">
      No data projects yet. Create your first one to get started.
    </p>
    <ul v-else class="plist">
      <li v-for="p in studio.projects.value" :key="p.id">
        <router-link :to="`/studio/p/${p.id}`" class="pcard" data-testid="studio-project-card">
          <span class="pcard-name">{{ p.name }}</span>
          <span class="pcard-meta">{{ p.queries.length }} {{ p.queries.length === 1 ? 'query' : 'queries' }} · {{ p.plots.length }} {{ p.plots.length === 1 ? 'plot' : 'plots' }}</span>
        </router-link>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.home { max-width: 60rem; margin: 0 auto; padding: 1rem 1rem 4rem; }
.home-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.home-title { font-size: 1.4rem; font-weight: 800; margin: 0; }
.home-sub { color: var(--muted); font-size: 0.9rem; margin: 0.3rem 0 0; max-width: 34rem; }
.muted { color: var(--muted); font-size: 0.9rem; margin-top: 1.5rem; }
.err { color: #dc2626; font-size: 0.9rem; margin-top: 1.5rem; }
.empty { color: var(--muted); font-size: 0.9rem; margin-top: 2rem; padding: 1.2rem; border: 1px dashed var(--border); border-radius: 10px; text-align: center; }
.plist { list-style: none; margin: 1.5rem 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: 0.7rem; }
.pcard { display: flex; flex-direction: column; gap: 0.3rem; padding: 1rem; border: 1px solid var(--border); border-radius: 10px; text-decoration: none; color: var(--text); background: var(--surface); }
.pcard:hover { border-color: var(--accent); }
.pcard-name { font-weight: 700; font-size: 1rem; }
.pcard-meta { font-size: 0.76rem; color: var(--muted); }
.sbtn { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 8px; padding: 0.45rem 0.9rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
.sbtn--primary { background: var(--accent); color: #fff; border-color: var(--accent); }
</style>
