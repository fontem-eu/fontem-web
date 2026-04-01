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
    { path: '/admin', component: AdminView },
    { path: '/admin/data-quality', component: DataQualityView },
    { path: '/admin/entity-resolution', component: EntityResolutionView },
    { path: '/admin/architecture', component: ArchitectureView },
    { path: '/admin/coverage', component: CoverageView },
    { path: '/company/:gmr_id', component: CompanyProfileView },
    { path: '/:ticker', redirect: (to) => `/${to.params.ticker}/profile` },
    { path: '/:ticker/:view', component: HomeView },
  ],
})

// Track a page view on every navigation (replaces Umami's auto-track script)
const { page } = useAnalytics()
router.afterEach((to) => { page(to.fullPath) })

createApp(App).use(router).mount('#app')
