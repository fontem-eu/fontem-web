<script setup>
import { onMounted } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

onMounted(() => { document.title = 'Admin — Fontem' })

const tools = [
  { path: '/admin/entity-resolution', title: 'admin.entity_resolution', desc: 'admin.review_and_merge_duplicate_company_nodes' },
  { path: '/admin/value-review', title: 'admin.value_review', desc: 'admin.value_review_desc' },
  { path: '/issues', title: 'admin.issues', desc: 'admin.issues_desc' },
  { path: '/admin/moderation', title: 'admin.moderation', desc: 'admin.review_flagged_content_resolve_disputes_view_log' },
  { path: '/admin/feed-queries', title: 'feeds.named_queries', desc: 'feeds.named_queries_intro' },
  { path: '/admin/query-groups', title: 'feeds.query_groups', desc: 'feeds.query_groups_intro' },
  { path: 'http://docs.void42.internal/shelves/architecture', title: 'admin.architecture', desc: 'admin.system_diagrams_infrastructure_data_model_apis_etl', external: true },
  { path: 'http://docs.void42.internal/books/testing', title: 'admin.testing', desc: 'admin.e2e_coverage_matrix_and_production_smoke_test', external: true },
  { path: 'http://docs.void42.internal/books/developer-guide', title: 'admin.developer_guide', desc: 'admin.service_directory_repositories_and_quick_commands', external: true },
]
</script>

<template>
  <div class="adm">
    <header class="adm-header">
      <div>
        <router-link to="/" class="adm-back">{{ $t('nav.back_home') }}</router-link>
        <h1>{{ $t('app.admin') }}</h1>
        <p class="adm-sub">{{ $t('admin.operational_tools_architecture_docs_and_') }}</p>
      </div>
      <ThemeToggle />
    </header>
    <div class="adm-grid">
      <template v-for="t in tools" :key="t.path">
        <a v-if="t.external" :href="t.path" class="adm-card">
          <h2>{{ $t(t.title) }}</h2>
          <p>{{ $t(t.desc) }}</p>
        </a>
        <router-link v-else :to="t.path" class="adm-card">
          <h2>{{ $t(t.title) }}</h2>
          <p>{{ $t(t.desc) }}</p>
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
