/**
 * Shared app factory — used by both the client (src/main.js) and the
 * SSR hook (pages/+onRenderHtml.js).  Keep it side-effect-free at
 * module scope: anything that touches `window`, `document`, or
 * `localStorage` MUST live inside function bodies or lifecycle hooks,
 * otherwise the Node render will crash at import time.
 */
import { isAuthed } from './api/session.js'
import { createSSRApp, createApp as createCSRApp } from 'vue'
import {
  createRouter,
  createWebHistory,
  createMemoryHistory,
} from 'vue-router'

import { requiresAuth } from './router/authGate.js'
import { createFontemI18n } from './i18n.js'

import App from './App.vue'
import HomeView from './views/HomeView.vue'
import AboutView from './views/AboutView.vue'
import CompanyProfileView from './views/CompanyProfileView.vue'
import ContractDetailView from './views/ContractDetailView.vue'
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
import TriplesDQView from './views/dq/TriplesDQView.vue'
import EtlRunsDQView from './views/dq/EtlRunsDQView.vue'
import ProcurementThemeView from './views/themes/ProcurementThemeView.vue'
import ThemeScaffoldView from './views/themes/ThemeScaffoldView.vue'
import FeedView from './views/FeedView.vue'
import MyReportsView from './views/MyReportsView.vue'
import InvestigationsView from './views/InvestigationsView.vue'
import InvestigationDetailView from './views/InvestigationDetailView.vue'
import DossierView from './views/DossierView.vue'
import ReportView from './views/ReportView.vue'
import ReportEditorView from './views/ReportEditorView.vue'
import IssuesView from './views/IssuesView.vue'
import IssueDetailView from './views/IssueDetailView.vue'
import ModerationView from './views/ModerationView.vue'
import LoginView from './views/LoginView.vue'
import VerifyEmailView from './views/VerifyEmailView.vue'
import ForgotPasswordView from './views/ForgotPasswordView.vue'
import ResetPasswordView from './views/ResetPasswordView.vue'
import PrivacyView from './views/PrivacyView.vue'
import ActivityView from './views/ActivityView.vue'
import AIUsageView from './views/AIUsageView.vue'
import AccountView from './views/AccountView.vue'
import StudioHomeView from './views/StudioHomeView.vue'
import StudioProjectView from './views/StudioProjectView.vue'
import StudioQueryView from './views/StudioQueryView.vue'
import StudioPlotView from './views/StudioPlotView.vue'
import NotFoundView from './views/NotFoundView.vue'
import GeoView from './views/GeoView.vue'
import SparqlView from './views/SparqlView.vue'
import DonateView from './views/DonateView.vue'
import AtlasView from './views/AtlasView.vue'
import PublicSpendingView from './views/PublicSpendingView.vue'
import ExploreView from './views/ExploreView.vue'

import './assets/main.css'

const ROUTES = [
  // Landing — Feed (public data stories list). The previous "Home"
  // (carousel + chips + how-it-works + 45s tour) moved to /about
  // and is reachable from the footer link.
  { path: '/', component: FeedView },

  // About — the marketing/onboarding page that used to live at `/`.
  { path: '/about', component: AboutView },

  // Legacy aliases: existing bookmarks land on the right page.
  { path: '/feed', redirect: '/' },
  { path: '/atlas', redirect: '/map' },
  { path: '/public-spending', redirect: '/spending' },

  // Admin area — auth-guarded (see AUTH_REQUIRED below).
  { path: '/admin', component: AdminView },
  { path: '/admin/entity-resolution', component: EntityResolutionView },
  { path: '/admin/moderation', component: ModerationView },

  // Explore — top-level hub that groups the data-quality, SPARQL,
  // and geo destinations under a single nav entry. Replaces direct
  // nav-bar access to /data-quality.
  { path: '/explore', component: ExploreView },

  // Data quality — public. Reachable from the Explore hub above
  // and from existing in-app links / external bookmarks; the
  // route paths stay where they are so nothing breaks.
  { path: '/data-quality', component: DataQualityHubView },
  { path: '/data-quality/theme/procurement', component: ProcurementThemeView },
  { path: '/data-quality/theme/:themeId', component: ThemeScaffoldView },
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
  { path: '/data-quality/triples', component: TriplesDQView },
  { path: '/data-quality/etl-runs', component: EtlRunsDQView },
  { path: '/admin/data-quality/:page*', redirect: (to) => `/data-quality/${to.params.page || ''}` },

  // Auth
  { path: '/login', component: LoginView },
  { path: '/verify-email', component: VerifyEmailView },
  { path: '/forgot-password', component: ForgotPasswordView },
  { path: '/reset-password', component: ResetPasswordView },

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
  { path: '/account', component: AccountView },
  { path: '/studio', component: StudioHomeView },
  { path: '/studio/p/:projectId', component: StudioProjectView },
  { path: '/studio/p/:projectId/plot', component: StudioPlotView },
  { path: '/studio/p/:projectId/q/:queryId', component: StudioQueryView },

  // Issues
  { path: '/issues', component: IssuesView },
  { path: '/issues/:id', component: IssueDetailView },

  // Map — interactive map of the curated Eurostat datasets
  // (renamed from /atlas; old path redirects above).
  { path: '/map', component: AtlasView },

  // Spending — search the procurement graph + country-scoped
  // "of interest" lists (renamed from /public-spending).
  { path: '/spending', component: PublicSpendingView },

  // Data stories — canonical paths. Legacy /reports* paths redirect
  // for one release so external links and bookmarks keep working.
  { path: '/my-stories', component: MyReportsView },
  { path: '/investigations', component: InvestigationsView },
  { path: '/investigations/:id', component: InvestigationDetailView },
  { path: '/dossiers/:id', component: DossierView },
  { path: '/stories', redirect: '/my-stories' },
  { path: '/stories/:id', component: ReportView },
  { path: '/stories/:id/edit', component: ReportEditorView },
  { path: '/my-reports', redirect: '/my-stories' },
  { path: '/reports', redirect: '/my-stories' },
  { path: '/reports/:id', redirect: (to) => `/stories/${to.params.id}` },
  { path: '/reports/:id/edit', redirect: (to) => `/stories/${to.params.id}/edit` },

  // Company views
  { path: '/company/:gmr_id', component: CompanyProfileView },
  { path: '/contract/:noticeId', component: ContractDetailView },
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
    if (requiresAuth(to.path) && !isAuthed.value) return '/login'
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
  const i18n = createFontemI18n()
  app.use(router)
  app.use(i18n)
  // Expose the full i18n instance via provide so App.vue can hand it
  // to useLang's init() — `globalProperties.$i18n` is a wrapper that
  // only exposes the read-only display props (locale, t, n, d), not
  // setLocaleMessage / global, which are what activateLocale needs.
  app.provide('fontem-i18n', i18n)
  return { app, router, i18n }
}
