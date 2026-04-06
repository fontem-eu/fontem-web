<script setup>
import { ref, onMounted } from 'vue'

const services = [
  {
    category: 'Platform',
    items: [
      { name: 'GMR Web', url: 'https://gmr.void42.net', health: '/api/health', icon: 'globe', desc: 'Frontend SPA' },
      { name: 'GMR API', url: 'http://gmr.void42.internal', health: 'http://gmr-api.gmr.svc.cluster.local/health', icon: 'database', desc: 'Graph API (Neo4j)' },
      { name: 'Community API', url: null, health: 'http://gmr-community-api.gmr.svc.cluster.local:8001/health', icon: 'users', desc: 'Reports, issues, auth' },
    ],
  },
  {
    category: 'CI/CD & Quality',
    items: [
      { name: 'ArgoCD', url: 'http://argocd.void42.internal', health: null, icon: 'refresh', desc: 'GitOps deployments' },
      { name: 'SonarQube', url: 'http://sonarqube.void42.internal', health: 'http://sonarqube.sonarqube.svc.cluster.local:9000/api/system/status', icon: 'shield', desc: 'Code quality & coverage' },
      { name: 'Gitea', url: 'http://contribute.void42.internal', health: null, icon: 'git', desc: 'Source code' },
    ],
  },
  {
    category: 'Security & Monitoring',
    items: [
      { name: 'Dependency-Track', url: 'http://dtrack.void42.internal', health: 'http://dependency-track.dependency-track.svc.cluster.local:8080/api/version', icon: 'package', desc: 'SBOM & CVE tracking' },
      { name: 'Uptime Kuma', url: 'http://status.void42.internal', health: 'http://uptime-kuma.uptime-kuma.svc.cluster.local:3001/api/entry-page', icon: 'activity', desc: 'Service monitoring' },
      { name: 'Grafana', url: 'http://monitor.void42.internal', health: null, icon: 'bar-chart', desc: 'Metrics & dashboards' },
    ],
  },
]

const repos = [
  { name: 'edgar-gmr-etl', desc: 'Graph API + ETL pipelines', lang: 'Python', sonar: 'edgar-gmr-etl' },
  { name: 'gmr-community-api', desc: 'Community API (reports, issues)', lang: 'Python', sonar: 'gmr-community-api' },
  { name: 'gmr-web', desc: 'Frontend SPA (Vue 3)', lang: 'JavaScript', sonar: 'gmr-web' },
  { name: 'esef-data-fetcher', desc: 'EU ESEF financial data fetcher', lang: 'Python', sonar: 'esef-data-fetcher' },
  { name: 'eforms-parser', desc: 'EU eForms procurement parser', lang: 'Python', sonar: 'eforms-parser' },
  { name: 'usa-stock-price-fetcher', desc: 'US stock price fetcher', lang: 'Python', sonar: 'usa-stock-price-fetcher' },
  { name: 'edgar-data-fetcher', desc: 'EDGAR bulk data fetcher', lang: 'Python', sonar: 'edgar-data-fetcher' },
]

const healthStatus = ref({})

onMounted(async () => {
  document.title = 'Developer Portal — GMR'
  for (const cat of services) {
    for (const svc of cat.items) {
      if (svc.health) {
        checkHealth(svc.name, svc.health)
      }
    }
  }
})

async function checkHealth(name, url) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
    healthStatus.value[name] = resp.ok ? 'up' : 'down'
  } catch {
    healthStatus.value[name] = 'down'
  }
}
</script>

<template>
  <div class="portal">
    <header class="portal-header">
      <router-link to="/admin" class="portal-back">&larr; Admin</router-link>
      <h1>Developer Portal</h1>
      <p class="portal-sub">All tools and services in one place</p>
    </header>

    <!-- Service cards by category -->
    <div v-for="cat in services" :key="cat.category" class="portal-section">
      <h2>{{ cat.category }}</h2>
      <div class="portal-grid">
        <a
          v-for="svc in cat.items"
          :key="svc.name"
          :href="svc.url"
          target="_blank"
          rel="noopener noreferrer"
          class="portal-card"
          :class="{ 'portal-card--no-link': !svc.url }"
        >
          <div class="card-header">
            <span class="card-name">{{ svc.name }}</span>
            <span
              v-if="svc.health"
              class="card-dot"
              :class="'dot-' + (healthStatus[svc.name] || 'checking')"
              :title="healthStatus[svc.name] || 'checking...'"
            ></span>
          </div>
          <p class="card-desc">{{ svc.desc }}</p>
          <span v-if="svc.url" class="card-link">Open &rarr;</span>
        </a>
      </div>
    </div>

    <!-- Repositories -->
    <div class="portal-section">
      <h2>Repositories</h2>
      <div class="repo-table-wrap">
        <table class="repo-table">
          <thead>
            <tr>
              <th>Repository</th>
              <th>Description</th>
              <th>Language</th>
              <th>Links</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in repos" :key="r.name">
              <td class="repo-name">{{ r.name }}</td>
              <td class="repo-desc">{{ r.desc }}</td>
              <td><span class="lang-badge" :class="'lang-' + r.lang.toLowerCase()">{{ r.lang }}</span></td>
              <td class="repo-links">
                <a :href="'http://contribute.void42.internal/golden/' + r.name" target="_blank" rel="noopener noreferrer">Code</a>
                <a :href="'http://sonarqube.void42.internal/dashboard?id=' + r.sonar" target="_blank" rel="noopener noreferrer">SonarQube</a>
                <a :href="'http://dtrack.void42.internal/projects/' + r.name" target="_blank" rel="noopener noreferrer">SBOM</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Quick commands -->
    <div class="portal-section">
      <h2>Quick Commands</h2>
      <div class="commands">
        <div class="cmd"><code>make test</code><span>Run tests with coverage</span></div>
        <div class="cmd"><code>make analyze</code><span>Test + upload to SonarQube</span></div>
        <div class="cmd"><code>make audit</code><span>Security audit + dependency report</span></div>
        <div class="cmd"><code>make sbom</code><span>Generate SBOM + upload to Dependency-Track</span></div>
        <div class="cmd"><code>make build release</code><span>Build + push Docker image</span></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.portal { max-width: 1000px; margin: 0 auto; padding: 0 1rem 4rem; }
.portal-header { padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.portal-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0.3rem 0 0; color: var(--text); }
.portal-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.portal-sub { font-size: 0.82rem; color: var(--muted); margin-top: 0.2rem; }

.portal-section { margin-bottom: 2rem; }
h2 { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 0 0 0.75rem; }

.portal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; }

.portal-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1rem;
  background: var(--surface);
  text-decoration: none;
  transition: border-color 0.15s;
  display: flex;
  flex-direction: column;
}
.portal-card:hover { border-color: var(--accent); }
.portal-card--no-link { cursor: default; }

.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem; }
.card-name { font-size: 0.9rem; font-weight: 600; color: var(--text); }

.card-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.dot-up { background: #22c55e; }
.dot-down { background: #ef4444; }
.dot-checking { background: var(--border); animation: pulse 1.5s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

.card-desc { font-size: 0.75rem; color: var(--muted); line-height: 1.4; margin: 0; flex: 1; }
.card-link { font-size: 0.7rem; color: var(--accent); margin-top: 0.5rem; font-weight: 600; }

.repo-table-wrap { overflow-x: auto; }
.repo-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.repo-table th { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 2px solid var(--border); font-weight: 600; color: var(--muted); font-size: 0.7rem; text-transform: uppercase; }
.repo-table td { padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--border); color: var(--text); }
.repo-name { font-weight: 600; font-family: monospace; font-size: 0.75rem; }
.repo-desc { color: var(--muted); }
.repo-links { display: flex; gap: 0.5rem; }
.repo-links a { font-size: 0.7rem; color: var(--accent); text-decoration: none; font-weight: 500; }
.repo-links a:hover { text-decoration: underline; }

.lang-badge { font-size: 0.65rem; font-weight: 600; padding: 0.1rem 0.4rem; border-radius: 3px; }
.lang-python { background: #dbeafe; color: #1d4ed8; }
.lang-javascript { background: #fef3c7; color: #92400e; }

.commands { display: flex; flex-direction: column; gap: 0.4rem; }
.cmd { display: flex; align-items: center; gap: 1rem; padding: 0.4rem 0; }
.cmd code { font-size: 0.8rem; font-weight: 600; color: var(--accent); background: var(--surface); padding: 0.2rem 0.5rem; border-radius: 3px; border: 1px solid var(--border); white-space: nowrap; min-width: 180px; }
.cmd span { font-size: 0.75rem; color: var(--muted); }
</style>
