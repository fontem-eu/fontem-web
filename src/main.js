import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import HomeView from './views/HomeView.vue'
import CompanyProfileView from './views/CompanyProfileView.vue'
import EntityResolutionView from './views/EntityResolutionView.vue'
import AdminView from './views/AdminView.vue'
import DataQualityHubView from './views/DataQualityHubView.vue'
import ContractsDQView from './views/dq/ContractsDQView.vue'
import GleifDQView from './views/dq/GleifDQView.vue'
import EdgarDQView from './views/dq/EdgarDQView.vue'
import EsefDQView from './views/dq/EsefDQView.vue'
import LobbyingDQView from './views/dq/LobbyingDQView.vue'
import TradeEdgesDQView from './views/dq/TradeEdgesDQView.vue'
import DedupDQView from './views/dq/DedupDQView.vue'
import SanctionsDQView from './views/dq/SanctionsDQView.vue'
import FirdsDQView from './views/dq/FirdsDQView.vue'
import CdpDQView from './views/dq/CdpDQView.vue'
import NutsDQView from './views/dq/NutsDQView.vue'
import EuKnowledgeGraphDQView from './views/dq/EuKnowledgeGraphDQView.vue'
import OverviewDQView from './views/dq/OverviewDQView.vue'
import FeedView from './views/FeedView.vue'
import MyReportsView from './views/MyReportsView.vue'
import ReportView from './views/ReportView.vue'
import ReportEditorView from './views/ReportEditorView.vue'
import IssuesView from './views/IssuesView.vue'
import IssueDetailView from './views/IssueDetailView.vue'
import ModerationView from './views/ModerationView.vue'
import LoginView from './views/LoginView.vue'
import PrivacyView from './views/PrivacyView.vue'
import ActivityView from './views/ActivityView.vue'
import AIUsageView from './views/AIUsageView.vue'
import NotFoundView from './views/NotFoundView.vue'
import GeoView from './views/GeoView.vue'
import { useAnalytics } from './composables/useAnalytics.js'
import './assets/main.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },

    // Admin area — auth-guarded (see AUTH_REQUIRED below).
    { path: '/admin', component: AdminView },
    { path: '/admin/entity-resolution', component: EntityResolutionView },
    { path: '/admin/moderation', component: ModerationView },

    // Data quality — public (the platform's transparency surface).
    // Anyone can browse coverage, freshness, and source breakdowns.
    { path: '/data-quality', component: DataQualityHubView },
    { path: '/data-quality/overview', component: OverviewDQView },
    { path: '/data-quality/contracts', component: ContractsDQView },
    { path: '/data-quality/gleif', component: GleifDQView },
    { path: '/data-quality/edgar', component: EdgarDQView },
    { path: '/data-quality/esef', component: EsefDQView },
    { path: '/data-quality/lobbying', component: LobbyingDQView },
    { path: '/data-quality/trade-edges', component: TradeEdgesDQView },
    { path: '/data-quality/dedup', component: DedupDQView },
    { path: '/data-quality/sanctions', component: SanctionsDQView },
    { path: '/data-quality/firds', component: FirdsDQView },
    { path: '/data-quality/cdp', component: CdpDQView },
    { path: '/data-quality/nuts', component: NutsDQView },
    { path: '/data-quality/eu-knowledge-graph', component: EuKnowledgeGraphDQView },
    // Legacy /admin/data-quality/* paths redirect to /data-quality/* for bookmarks.
    { path: '/admin/data-quality/:page*', redirect: (to) => `/data-quality/${to.params.page || ''}` },

    // Auth
    { path: '/login', component: LoginView },

    // Legal
    { path: '/privacy', component: PrivacyView },

    // Geo explorer
    { path: '/geo', component: GeoView },

    // User
    { path: '/activity', component: ActivityView },
    { path: '/ai-usage', component: AIUsageView },

    // Issues
    { path: '/issues', component: IssuesView },
    { path: '/issues/:id', component: IssueDetailView },

    // Feed (public reports — signed-in users)
    { path: '/feed', component: FeedView },

    // Reports
    { path: '/my-reports', component: MyReportsView },
    { path: '/reports', redirect: '/my-reports' },
    { path: '/reports/:id', component: ReportView },
    { path: '/reports/:id/edit', component: ReportEditorView },

    // Company views — all under /c/ or /company/ prefix
    { path: '/company/:gmr_id', component: CompanyProfileView },
    { path: '/c/:ticker', redirect: (to) => `/c/${to.params.ticker}/profile` },
    { path: '/c/:ticker/:view', component: HomeView },

    // 404 — must be last
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
  ],
})

// Auth guard: redirect to login if visiting a protected route without a token
// /feed is intentionally public — the platform's transparency stance is
// that anyone can browse reports, logged in or not. Auth is only required
// for the user's own workspace (/my-reports, /issues, /activity) and the
// legacy /reports alias.
const AUTH_REQUIRED = ['/my-reports', '/reports', '/issues', '/activity', '/ai-usage', '/admin']
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
