import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import HomeView from './views/HomeView.vue'
import DataQualityView from './views/DataQualityView.vue'
import CompanyProfileView from './views/CompanyProfileView.vue'
import EntityResolutionView from './views/EntityResolutionView.vue'
import AdminView from './views/AdminView.vue'
import ArchitectureView from './views/ArchitectureView.vue'
import CoverageView from './views/CoverageView.vue'
import { useAnalytics } from './composables/useAnalytics.js'
import './assets/main.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },

    // Admin area (static prefix — no dynamic segments at root level)
    { path: '/admin', component: AdminView },
    { path: '/admin/data-quality', component: DataQualityView },
    { path: '/admin/entity-resolution', component: EntityResolutionView },
    { path: '/admin/architecture', component: ArchitectureView },
    { path: '/admin/coverage', component: CoverageView },
    // /admin/plan is served as static HTML by nginx (not Vue)

    // Company views — prefixed with /c/ to avoid catch-all conflicts
    { path: '/company/:gmr_id', component: CompanyProfileView },
    { path: '/c/:ticker', redirect: (to) => `/c/${to.params.ticker}/profile` },
    { path: '/c/:ticker/:view', component: HomeView },

    // Legacy: bare /:ticker redirects to /c/:ticker (backward compat)
    // Only matches if nothing above matched — this is the last route
    { path: '/:ticker', redirect: (to) => `/c/${to.params.ticker}/profile` },
  ],
})

// Track a page view on every navigation (replaces Umami's auto-track script)
const { page } = useAnalytics()
router.afterEach((to) => { page(to.fullPath) })

createApp(App).use(router).mount('#app')
