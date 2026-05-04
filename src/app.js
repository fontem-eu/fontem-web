/**
 * Shared app factory — used by both the client (src/main.js) and the
 * SSR hook (pages/+onRenderHtml.js).  Keep it side-effect-free at
 * module scope: anything that touches `window`, `document`, or
 * `localStorage` MUST live inside function bodies or lifecycle hooks,
 * otherwise the Node render will crash at import time.
 */
import { createSSRApp, createApp as createCSRApp } from 'vue'
import {
  createRouter,
  createWebHistory,
  createMemoryHistory,
} from 'vue-router'

import { requiresAuth } from './router/authGate.js'

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
import ConnectednessDQView from './views/dq/ConnectednessDQView.vue'
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
import SparqlView from './views/SparqlView.vue'
import DonateView from './views/DonateView.vue'
import AtlasView from './views/AtlasView.vue'

import './assets/main.css'

const ROUTES = [
  { path: '/', component: HomeView },

  // Admin area — auth-guarded (see AUTH_REQUIRED below).
  { path: '/admin', component: AdminView },
  { path: '/admin/entity-resolution', component: EntityResolutionView },
  { path: '/admin/moderation', component: ModerationView },

  // Data quality — public.
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
  { path: '/data-quality/connectedness', component: ConnectednessDQView },
  { path: '/admin/data-quality/:page*', redirect: (to) => `/data-quality/${to.params.page || ''}` },

  // Auth
  { path: '/login', component: LoginView },

  // Legal
  { path: '/privacy', component: PrivacyView },

  // Donations — public
  { path: '/donate', component: DonateView },
  { path: '/support', redirect: '/donate' },

  // SPARQL — public graph query surface
  { path: '/sparql', component: SparqlView },

  // Geo explorer
  { path: '/geo', component: GeoView },

  // User
  { path: '/activity', component: ActivityView },
  { path: '/ai-usage', component: AIUsageView },

  // Issues
  { path: '/issues', component: IssuesView },
  { path: '/issues/:id', component: IssueDetailView },

  // Feed (public data stories)
  { path: '/feed', component: FeedView },

  // Atlas — interactive map of the curated Eurostat datasets
  { path: '/atlas', component: AtlasView },

  // Data stories — canonical paths. Legacy /reports* paths redirect
  // for one release so external links and bookmarks keep working.
  { path: '/my-stories', component: MyReportsView },
  { path: '/stories', redirect: '/my-stories' },
  { path: '/stories/:id', component: ReportView },
  { path: '/stories/:id/edit', component: ReportEditorView },
  { path: '/my-reports', redirect: '/my-stories' },
  { path: '/reports', redirect: '/my-stories' },
  { path: '/reports/:id', redirect: (to) => `/stories/${to.params.id}` },
  { path: '/reports/:id/edit', redirect: (to) => `/stories/${to.params.id}/edit` },

  // Company views
  { path: '/company/:gmr_id', component: CompanyProfileView },
  { path: '/c/:ticker', redirect: (to) => `/c/${to.params.ticker}/profile` },
  { path: '/c/:ticker/:view', component: HomeView },

  // 404 — must be last
  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
]

// Auth-gate predicate lives in src/router/authGate.js so unit tests
// can exercise it without dragging the full Vue/component graph in.

/**
 * Build a router.  On the server we use an in-memory history so we can
 * `router.push(url)` without touching the DOM; on the client we use
 * web history for proper back/forward behaviour.
 */
export function createFontemRouter(ssr = false) {
  const router = createRouter({
    history: ssr ? createMemoryHistory() : createWebHistory(),
    routes: ROUTES,
  })

  router.beforeEach((to) => {
    // localStorage doesn't exist during SSR — skip the guard on the
    // server and let the client redirect after hydration if needed.
    if (typeof localStorage === 'undefined') return
    if (requiresAuth(to.path) && !localStorage.getItem('gmr-token')) return '/login'
  })

  return router
}

/**
 * Build a Vue app.  Used on the client with ``ssr=false`` for standalone
 * mount, and with ``ssr=true`` for hydration after SSR.
 */
export function createFontemApp(ssr = false) {
  const app = ssr ? createSSRApp(App) : createCSRApp(App)
  const router = createFontemRouter(ssr)
  app.use(router)
  return { app, router }
}
