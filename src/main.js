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
import RoadmapView from './views/RoadmapView.vue'
import FeatureDetailView from './views/FeatureDetailView.vue'
import PlanView from './views/PlanView.vue'
import ReportListView from './views/ReportListView.vue'
import ReportView from './views/ReportView.vue'
import ReportEditorView from './views/ReportEditorView.vue'
import IssuesView from './views/IssuesView.vue'
import IssueDetailView from './views/IssueDetailView.vue'
import ModerationView from './views/ModerationView.vue'
import LoginView from './views/LoginView.vue'
import ActivityView from './views/ActivityView.vue'
import DevPortalView from './views/DevPortalView.vue'
import SmokeTestsView from './views/SmokeTestsView.vue'
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
    { path: '/admin/roadmap', component: RoadmapView },
    { path: '/admin/roadmap/:id', component: FeatureDetailView },
    { path: '/admin/plan', component: PlanView },
    { path: '/admin/moderation', component: ModerationView },
    { path: '/admin/dev', component: DevPortalView },
    { path: '/admin/smoke-tests', component: SmokeTestsView },

    // Auth
    { path: '/login', component: LoginView },

    // User
    { path: '/activity', component: ActivityView },

    // Issues
    { path: '/issues', component: IssuesView },
    { path: '/issues/:id', component: IssueDetailView },

    // Reports
    { path: '/reports', component: ReportListView },
    { path: '/reports/:id', component: ReportView },
    { path: '/reports/:id/edit', component: ReportEditorView },

    // Company views — all under /c/ or /company/ prefix
    { path: '/company/:gmr_id', component: CompanyProfileView },
    { path: '/c/:ticker', redirect: (to) => `/c/${to.params.ticker}/profile` },
    { path: '/c/:ticker/:view', component: HomeView },
  ],
})

// Track a page view on every navigation (replaces Umami's auto-track script)
const { page } = useAnalytics()
router.afterEach((to) => { page(to.fullPath) })

createApp(App).use(router).mount('#app')
