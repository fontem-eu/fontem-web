import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import HomeView from './views/HomeView.vue'
import DataQualityView from './views/DataQualityView.vue'
import CompanyProfileView from './views/CompanyProfileView.vue'
import EntityResolutionView from './views/EntityResolutionView.vue'
import AdminView from './views/AdminView.vue'
import DataQualityHubView from './views/DataQualityHubView.vue'
import ContractsDQView from './views/dq/ContractsDQView.vue'
import GleifDQView from './views/dq/GleifDQView.vue'
import EdgarDQView from './views/dq/EdgarDQView.vue'
import EsefDQView from './views/dq/EsefDQView.vue'
import LobbyingDQView from './views/dq/LobbyingDQView.vue'
import DirectorsDQView from './views/dq/DirectorsDQView.vue'
import TradeEdgesDQView from './views/dq/TradeEdgesDQView.vue'
import DedupDQView from './views/dq/DedupDQView.vue'
import SanctionsDQView from './views/dq/SanctionsDQView.vue'
import FirdsDQView from './views/dq/FirdsDQView.vue'
import BeneficialOwnershipDQView from './views/dq/BeneficialOwnershipDQView.vue'
import CdpDQView from './views/dq/CdpDQView.vue'
import ReportListView from './views/ReportListView.vue'
import ReportView from './views/ReportView.vue'
import ReportEditorView from './views/ReportEditorView.vue'
import IssuesView from './views/IssuesView.vue'
import IssueDetailView from './views/IssueDetailView.vue'
import ModerationView from './views/ModerationView.vue'
import LoginView from './views/LoginView.vue'
import ActivityView from './views/ActivityView.vue'
import AIUsageView from './views/AIUsageView.vue'
import { useAnalytics } from './composables/useAnalytics.js'
import './assets/main.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },

    // Admin area (static prefix — no dynamic segments at root level)
    { path: '/admin', component: AdminView },
    { path: '/admin/data-quality', component: DataQualityHubView },
    { path: '/admin/data-quality/overview', component: DataQualityView },
    { path: '/admin/data-quality/contracts', component: ContractsDQView },
    { path: '/admin/data-quality/gleif', component: GleifDQView },
    { path: '/admin/data-quality/edgar', component: EdgarDQView },
    { path: '/admin/data-quality/esef', component: EsefDQView },
    { path: '/admin/data-quality/lobbying', component: LobbyingDQView },
    { path: '/admin/data-quality/directors', component: DirectorsDQView },
    { path: '/admin/data-quality/trade-edges', component: TradeEdgesDQView },
    { path: '/admin/data-quality/dedup', component: DedupDQView },
    { path: '/admin/data-quality/sanctions', component: SanctionsDQView },
    { path: '/admin/data-quality/firds', component: FirdsDQView },
    { path: '/admin/data-quality/beneficial-ownership', component: BeneficialOwnershipDQView },
    { path: '/admin/data-quality/cdp', component: CdpDQView },
    { path: '/admin/entity-resolution', component: EntityResolutionView },
    { path: '/admin/moderation', component: ModerationView },

    // Auth
    { path: '/login', component: LoginView },

    // User
    { path: '/activity', component: ActivityView },
    { path: '/ai-usage', component: AIUsageView },

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

// Auth guard: redirect to login if visiting a protected route without a token
const AUTH_REQUIRED = ['/reports', '/issues', '/activity', '/ai-usage', '/admin']
router.beforeEach((to) => {
  const needsAuth = AUTH_REQUIRED.some((prefix) => to.path.startsWith(prefix))
  if (needsAuth && !localStorage.getItem('gmr-token')) {
    return '/login'
  }
})

// Track a page view on every navigation (replaces Umami's auto-track script)
const { page } = useAnalytics()
router.afterEach((to) => { page(to.fullPath) })

createApp(App).use(router).mount('#app')
