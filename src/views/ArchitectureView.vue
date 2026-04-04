<script setup>
import { onMounted, ref } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

const loaded = ref(false)
const renderedSvgs = ref({})

onMounted(async () => {
  document.title = 'Architecture — GMR'
  const script = document.createElement('script')
  script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js'
  script.onload = async () => {
    const isDark = document.documentElement.classList.contains('dark')
    window.mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      securityLevel: 'loose',
    })
    for (const [id, code] of Object.entries(diagrams)) {
      try {
        const { svg } = await window.mermaid.render(`mermaid-${id}`, code)
        renderedSvgs.value[id] = svg
      } catch (e) {
        renderedSvgs.value[id] = `<p style="color:red">Diagram error: ${e.message?.substring(0, 100)}</p>`
      }
    }
    loaded.value = true
  }
  document.head.appendChild(script)
})

// ── Diagram definitions ──────────────────────────────────────

const diagrams = {
  // 1. Infrastructure — what runs where
  infra: `flowchart LR
  subgraph Internet
    USER((User))
    TED_API["TED API<br/>ted.europa.eu"]
    GLEIF_API["GLEIF API<br/>leidata.gleif.org"]
    RNE_API["RNE API<br/>recherche-entreprises"]
    ZITADEL_EXT["FranceConnect<br/>EU Login"]
  end
  subgraph K8s["k8s cluster — gmr namespace"]
    WEB["gmr-web<br/>nginx + Vue 3 SPA<br/>+ Tiptap editor"]
    API["gmr-api<br/>FastAPI + Neo4j<br/>public data"]
    CAPI["gmr-community-api<br/>FastAPI + PostgreSQL<br/>reports + issues"]
    NEO["Neo4j 5 CE<br/>APOC plugin<br/>12Gi RAM / 50Gi PVC"]
    PG["PostgreSQL 16<br/>users + reports + issues<br/>permissions + moderation"]
    ZIT["Zitadel<br/>OIDC IdP<br/>user management"]
    PROM["Prometheus<br/>ServiceMonitor"]
  end
  subgraph Storage
    NFS["NFS PVC<br/>EDGAR JSON + price CSVs"]
    ESEF_PVC["ESEF PVC<br/>EU XBRL summaries"]
  end
  USER -->|HTTPS| WEB
  WEB -->|"/api/*"| API
  WEB -->|"/capi/*"| CAPI
  WEB -->|"OIDC login"| ZIT
  API --> NEO
  API -->|read-only| NFS
  API -->|read-only| ESEF_PVC
  CAPI --> PG
  CAPI -->|"entity names"| API
  ZIT --> PG
  ZIT -.-> ZITADEL_EXT
  API -->|"/metrics"| PROM
  subgraph ETL["CronJobs"]
    GLEIF_JOB["GLEIF L1+L2<br/>weekly"]
    TED_JOB["TED contracts<br/>daily"]
    DIR_JOB["FR directors<br/>monthly"]
  end
  GLEIF_API -.-> GLEIF_JOB
  TED_API -.-> TED_JOB
  RNE_API -.-> DIR_JOB
  GLEIF_JOB --> NEO
  TED_JOB --> NEO
  DIR_JOB --> NEO`,

  // 2. Neo4j data model — every node, relationship, key property
  schema: `erDiagram
  Company ||--o{ Listing : LISTED_AS
  Company ||--o{ FinancialYear : REPORTED
  Company }o--o{ Company : SUBSIDIARY_OF
  Authority ||--o{ Contract : AWARDED
  Contract }o--|| Company : AWARDED_TO
  Contract }o--o| CPV : CATEGORIZED_AS
  Person }o--o{ Company : DIRECTS
  Company }o--o{ Company : SAME_AS
  Authority }o--o{ Company : CLIENT_OF
  Company }o--o{ Authority : SUPPLIER_OF
  Company {
    string gmr_id PK
    string lei UK
    string cik
    string name
    string country
    list vat
    bool active
  }
  Listing {
    string ticker UK
    string exchange
    string currency
    bool active
  }
  FinancialYear {
    string gmr_id FK
    int year
    string source
    float revenue
    float net_income
    float equity
    float assets
    float liabilities
  }
  Contract {
    string ted_notice_id PK
    string title
    string description
    float value_eur
    string publication_date
    string cpv_main
    string procedure_type
    string country
    string ted_url
  }
  Authority {
    string authority_id PK
    string name
    string country
  }
  Person {
    string person_id PK
    string name
    string first_name
    int birth_year
    string nationality
  }
  CPV {
    string code PK
    string description
    string division
  }`,

  // 3. Backend layers — both APIs side by side
  layers: `flowchart TD
  subgraph GraphAPI["gmr-api (edgar-gmr-etl) — Neo4j public data"]
    direction TB
    subgraph GP["REST Routers (11)"]
      R_FIN["Financial<br/>fundamentals / valuation / prices"]
      R_PROC["Procurement<br/>contracts / search / authorities"]
      R_GRAPH["Graph<br/>traversal / path finding"]
      R_GOV["Governance<br/>persons / entity-resolution"]
    end
    subgraph GD["Domain ABCs"]
      ABC1["FinancialDataSource"]
      ABC2["ContractDataSource"]
      ABC3["PersonDataSource"]
    end
    subgraph GI["Neo4j Implementations"]
      G1["GraphDataSource"]
      G2["GraphContractSource"]
      G3["GraphPersonSource"]
      NEO_C["Neo4jClient"]
    end
    GP --> GD
    GD --> GI
    GI --> NEO_C
  end
  subgraph CommunityAPI["gmr-community-api — PostgreSQL app state"]
    direction TB
    subgraph CP["REST Routers (6)"]
      CR["Reports<br/>CRUD + sections + locking"]
      CI["Issues<br/>CRUD + comments + votes"]
      CS["Sharing<br/>access grants"]
      CM["Moderation<br/>flags + sanctions + log"]
      CU["Users + Groups"]
      CA["Auth middleware<br/>JWT validation"]
    end
    subgraph CSVC["Service Layer"]
      SRP["ReportService"]
      SIS["IssueService"]
      SPM["PermissionService"]
      SMD["ModerationService"]
    end
    subgraph CREP["Repository ABCs"]
      RR["ReportRepository"]
      RI["IssueRepository"]
      RPR["PermissionRepository"]
      RMR["ModerationRepository"]
      RU["UserRepository"]
      RG["GroupRepository"]
    end
    subgraph CIMP["Implementations"]
      PG_R["PgReportRepo"]
      PG_I["PgIssueRepo"]
      PG_P["PgPermissionRepo"]
      PG_M["PgModerationRepo"]
      MEM["InMemoryXxxRepo<br/>(unit tests)"]
    end
    CP --> CSVC
    CSVC --> CREP
    CREP --> CIMP
  end
  NEO_C -->|bolt| NEO[(Neo4j)]
  CIMP -->|SQL| PG[(PostgreSQL)]`,

  // 4. ETL pipeline — data sources to graph
  etl: `flowchart TD
  subgraph Sources["External Data Sources"]
    GLEIF_L1["GLEIF Level 1<br/>3.26M companies<br/>LEI + name + country"]
    GLEIF_L2["GLEIF Level 2<br/>251K parent-child<br/>relationships"]
    EDGAR_REF["EDGAR reference<br/>company_tickers.json<br/>US listed companies"]
    EDGAR_FACTS["EDGAR companyfacts<br/>10-K annual filings<br/>XBRL JSON"]
    ESEF_DATA["ESEF summaries<br/>EU annual filings<br/>XBRL JSON"]
    TED_PKG["TED monthly ZIPs<br/>EU procurement notices<br/>eForms XML"]
    FR_RNE["recherche-entreprises<br/>French directors<br/>REST API"]
    PRICE_CSV["Yahoo Finance CSVs<br/>daily OHLCV<br/>on NFS mount"]
  end
  subgraph ETL["ETL Scripts (src/etl/)"]
    L1["load_gleif.py<br/>streaming XML parser<br/>2K-record batches"]
    L2["load_gleif_relationships.py<br/>LEI index required"]
    L3["load_us_companies.py<br/>CIK-based gmr_id"]
    L4["load_us_financials.py<br/>EDGAR JSON to FinancialYear"]
    L5["load_eu_listings.py<br/>LEI or name matching"]
    L6["eforms-parser<br/>+ ted_matcher.py<br/>+ load_ted_contracts.py"]
    L7["load_fr_directors.py<br/>Person + DIRECTS"]
    L8["load_cpv.py<br/>45 top-level + dynamic"]
    NORM["normalize_countries.py<br/>alpha-2 to alpha-3<br/>pycountry"]
    DEDUP["dedup_companies.py<br/>auto-merge or SAME_AS"]
  end
  GLEIF_L1 --> L1
  GLEIF_L2 --> L2
  EDGAR_REF --> L3
  EDGAR_FACTS --> L4
  ESEF_DATA --> L5
  TED_PKG --> L6
  FR_RNE --> L7
  L1 -->|"MERGE Company"| NEO[(Neo4j)]
  L2 -->|"MERGE SUBSIDIARY_OF"| NEO
  L3 -->|"MERGE Company + Listing"| NEO
  L4 -->|"MERGE FinancialYear"| NEO
  L5 -->|"MERGE Listing + FinancialYear"| NEO
  L6 -->|"MERGE Contract + Authority + AWARDED"| NEO
  L7 -->|"MERGE Person + DIRECTS"| NEO
  L8 -->|"MERGE CPV"| NEO
  NORM -->|"SET country = alpha3"| NEO
  DEDUP -->|"apoc.refactor.mergeNodes<br/>or SAME_AS"| NEO`,

  // 5. Frontend component tree
  frontend: `flowchart TD
  subgraph App["Vue 3 SPA (gmr-web)"]
    ROUTER["Vue Router"]
    subgraph DataPages["Data Exploration"]
      HOME["HomeView<br/>Landing + Ticker Detail"]
      CP["CompanyProfileView"]
      P9["GraphExplorer<br/>Cytoscape + path finding<br/>+ timeline + export"]
      P8["ContractsPanel<br/>companies + authorities"]
    end
    subgraph ReportPages["Collaborative Reports"]
      RL["ReportListView<br/>my reports + shared + public"]
      RV["ReportView<br/>read-only + widget embeds"]
      RE["ReportEditorView<br/>Tiptap + widget insertion"]
      SM["ShareModal<br/>collaborators + visibility"]
    end
    subgraph CommunityPages["Community"]
      IL["IssuesView<br/>list + filter tabs"]
      ID["IssueDetailView<br/>comments + votes + mod actions"]
      IC["IssueCreateModal<br/>entity-linked issue creation"]
      MV["ModerationView<br/>flagged content + action log"]
    end
    subgraph AdminPages["Admin"]
      ADMIN["AdminView Hub"]
      DQ["DataQualityView"]
      ER["EntityResolutionView"]
      ARCH["ArchitectureView"]
      PLAN["PlanView"]
      ROAD["RoadmapView"]
    end
    subgraph Widgets["Widget System"]
      WR["WidgetRenderer<br/>resolves type, renders component"]
      REG["registry.js<br/>graph_explorer, contracts_table,<br/>entity_profile"]
      GEE["GraphExplorerEmbed<br/>storeState / restoreFromState"]
      CTE["ContractsTableEmbed"]
      EPE["EntityProfileEmbed"]
    end
    subgraph APIs["API Clients"]
      GMR_JS["gmr.js<br/>fetch /api/* (graph data)"]
      CAPI_JS["community.js<br/>fetch /capi/* (app data)"]
    end
  end
  ROUTER --> DataPages
  ROUTER --> ReportPages
  ROUTER --> CommunityPages
  ROUTER --> AdminPages
  RE --> WR
  RV --> WR
  WR --> REG
  REG --> GEE
  REG --> CTE
  REG --> EPE
  RE --> CAPI_JS
  IL --> CAPI_JS
  P9 --> GMR_JS
  P8 --> GMR_JS`,

  // 6. API endpoint map — both APIs
  api: `flowchart LR
  subgraph GAPI["/api/* — gmr-api (Neo4j)"]
    subgraph Financial["Financial"]
      E1["GET /{ticker}/fundamentals"]
      E2["GET /{ticker}/gmr_long"]
      E6["GET /{ticker}/valuation"]
      E7["GET /{ticker}/prices"]
      E8["GET /tickers/search"]
    end
    subgraph Procurement["Procurement"]
      E9["GET /companies/{id}/contracts"]
      E10["GET /companies/{id}"]
      E11["GET /authorities/{id}/contracts"]
      E15["GET /search"]
    end
    subgraph Graph["Graph"]
      E16["GET /graph/{id}?depth&types&since&summary"]
      E17["GET /graph/paths/find?from&to"]
    end
    subgraph Gov["Governance"]
      E20["GET /entity-resolution/candidates"]
      E21["POST /entity-resolution/resolve"]
      E22["GET /data-quality"]
    end
  end
  subgraph CAPI["/capi/* — community-api (PostgreSQL)"]
    subgraph Reports["Reports"]
      C1["POST /reports"]
      C2["GET /reports"]
      C3["GET /reports/{id}"]
      C4["PUT /reports/{id}/sections/{sid}"]
      C5["POST /reports/{id}/sections/{sid}/lock"]
    end
    subgraph Sharing["Sharing"]
      C6["GET /reports/{id}/access"]
      C7["POST /reports/{id}/access"]
    end
    subgraph Issues["Issues"]
      C8["POST /issues"]
      C9["GET /issues/{id}"]
      C10["POST /issues/{id}/comments"]
      C11["POST /issues/{id}/vote"]
    end
    subgraph Mod["Moderation"]
      C12["POST /flags"]
      C13["POST /moderation/sanctions"]
      C14["GET /moderation/log"]
    end
    subgraph Auth["Auth"]
      C15["GET /users/me"]
      C16["POST /groups"]
    end
  end`,

  // 7. Request flow — collaborative report with embeds
  reportflow: `sequenceDiagram
  participant B as Browser
  participant N as nginx
  participant C as community-api
  participant PG as PostgreSQL
  participant G as gmr-api
  participant DB as Neo4j

  Note over B: User clicks "Start Analysis"
  B->>N: POST /capi/reports {title}
  N->>C: create report
  C->>PG: INSERT INTO reports
  PG-->>C: report_id
  C-->>B: {id, title, visibility: private}

  Note over B: User writes + inserts graph widget
  B->>N: PUT /capi/reports/{id}/sections/{sid}
  N->>C: save section (Tiptap JSON + widget config)
  C->>PG: UPDATE sections SET content_json
  C->>PG: INSERT INTO section_versions
  C-->>B: 200 OK

  Note over B: Reader opens published report
  B->>N: GET /capi/reports/{id}
  N->>C: load report + sections
  C->>PG: SELECT + permission check
  C-->>B: report with sections

  Note over B: WidgetRenderer encounters graph_explorer embed
  B->>N: GET /api/graph/{entity}?depth=2&since=2025-04
  N->>G: proxy to graph API
  G->>DB: MATCH path = (start)-[*1..2]-(n)
  DB-->>G: nodes + edges
  G-->>B: GraphResponse
  Note over B: Cytoscape renders live graph inside report`,

  // 8. Data separation — what lives where
  separation: `flowchart LR
  subgraph PGData["PostgreSQL (application state)"]
    U["users"]
    UR["user_roles"]
    GR["groups + group_members"]
    R["reports"]
    S["sections + section_versions"]
    RA["report_access"]
    I["issues + comments"]
    IV["issue_votes"]
    F["flags + sanctions"]
    ML["moderation_log"]
  end
  subgraph NEOData["Neo4j (public knowledge graph)"]
    CO["Company (3.6M)"]
    CT["Contract (779K)"]
    AU["Authority (71K)"]
    PE["Person"]
    LI["Listing"]
    FY["FinancialYear"]
    CP2["CPV"]
    REL["AWARDED / AWARDED_TO<br/>CLIENT_OF / SUPPLIER_OF<br/>SUBSIDIARY_OF / DIRECTS<br/>LISTED_AS / REPORTED"]
  end
  I -.->|"entity_type + entity_id<br/>(external reference)"| CO
  I -.->|"external ref"| AU
  I -.->|"external ref"| PE
  S -.->|"widget config fetches<br/>/api/graph/{id}"| NEOData
  subgraph Rebuild["Rebuildable from sources"]
    SRC["GLEIF + TED + EDGAR + ESEF + RNE"]
  end
  SRC -->|"ETL scripts"| NEOData
  Note1["PostgreSQL: ACID, migrations,<br/>user data survives graph rebuild"]
  Note2["Neo4j: traversal-optimized,<br/>rebuildable, public data only"]`,

  // 8. Identity resolution — gmr_id generation
  identity: `flowchart TD
  subgraph Input["Entity Arrives"]
    SRC_GLEIF["GLEIF record<br/>has LEI"]
    SRC_EDGAR["EDGAR record<br/>has CIK"]
    SRC_TED["TED contractor<br/>has VAT or name"]
  end
  subgraph Resolution["gmr_id Generation (deterministic UUID5)"]
    R1{"Has LEI?"}
    R2{"Has CIK?"}
    R3{"Has VAT?"}
    R4["Name + Country<br/>last resort"]
    GEN_LEI["UUID5 from lei:LEI"]
    GEN_CIK["UUID5 from edgar:CIK"]
    GEN_VAT["UUID5 from COUNTRY:VAT"]
    GEN_NAME["UUID5 from COUNTRY:NAME"]
  end
  subgraph Post["Post-Processing"]
    NORM["normalize_countries.py<br/>alpha-2 to alpha-3"]
    DEDUP["dedup_companies.py"]
    MERGE{"Conflict?"}
    AUTO["Auto-merge<br/>apoc.refactor.mergeNodes"]
    MANUAL["SAME_AS edge<br/>reviewed: false"]
    OPERATOR["Entity Resolution UI<br/>approve / reject"]
  end
  SRC_GLEIF --> R1
  SRC_EDGAR --> R2
  SRC_TED --> R3
  R1 -->|yes| GEN_LEI
  R1 -->|no| R2
  R2 -->|yes| GEN_CIK
  R2 -->|no| R3
  R3 -->|yes| GEN_VAT
  R3 -->|no| R4
  R4 --> GEN_NAME
  GEN_LEI --> NORM
  GEN_CIK --> NORM
  GEN_VAT --> NORM
  GEN_NAME --> NORM
  NORM --> DEDUP
  DEDUP --> MERGE
  MERGE -->|no| AUTO
  MERGE -->|yes| MANUAL
  MANUAL --> OPERATOR`,
}

const sections = [
  { id: 'infra', title: 'Infrastructure', desc: 'k8s cluster: 3 APIs, 2 databases, IdP, storage, CronJobs.' },
  { id: 'schema', title: 'Neo4j Data Model', desc: '8 node labels, 10 relationship types including CLIENT_OF/SUPPLIER_OF.' },
  { id: 'layers', title: 'Backend Architecture', desc: 'Two hexagonal APIs: gmr-api (Neo4j) and gmr-community-api (PostgreSQL).' },
  { id: 'api', title: 'API Surface', desc: '58 endpoints: 23 graph API + 35 community API (reports, issues, moderation).' },
  { id: 'etl', title: 'Data Pipeline', desc: '10 ETL scripts + materialize_trade_edges for CLIENT_OF/SUPPLIER_OF.' },
  { id: 'frontend', title: 'Frontend Components', desc: '15 pages, widget system, Tiptap editor, report embeds, issue tracker.' },
  { id: 'reportflow', title: 'Report Flow', desc: 'How reports are created, edited, and rendered with live widget embeds.' },
  { id: 'separation', title: 'Data Separation', desc: 'PostgreSQL for app state, Neo4j for public data. Clean boundary.' },
  { id: 'identity', title: 'Identity Resolution', desc: 'How gmr_id is generated, countries normalized, and duplicates resolved.' },
]

const expanded = ref({
  infra: true, schema: false, layers: false, api: false,
  etl: false, frontend: false, reportflow: false, separation: false, identity: false,
})

function toggle(id) {
  expanded.value[id] = !expanded.value[id]
}

function expandAll() {
  for (const k of Object.keys(expanded.value)) expanded.value[k] = true
}

function collapseAll() {
  for (const k of Object.keys(expanded.value)) expanded.value[k] = false
}
</script>

<template>
  <div class="arch">
    <header class="arch-header">
      <div>
        <router-link to="/admin" class="arch-back">&larr; Admin</router-link>
        <h1>Architecture</h1>
        <p class="arch-sub">
          GMR platform internals &mdash; 8 diagrams covering infrastructure, data model, backend,
          API surface, ETL, frontend, graph explorer, and identity resolution.
        </p>
      </div>
      <div class="arch-header__right">
        <button class="arch-expand-btn" @click="expandAll">Expand all</button>
        <button class="arch-expand-btn" @click="collapseAll">Collapse all</button>
        <ThemeToggle />
      </div>
    </header>

    <!-- Quick stats -->
    <div class="arch-stats">
      <div class="arch-stat">
        <div class="arch-stat__value">3.6M+</div>
        <div class="arch-stat__label">Companies</div>
      </div>
      <div class="arch-stat">
        <div class="arch-stat__value">779K</div>
        <div class="arch-stat__label">Contracts</div>
      </div>
      <div class="arch-stat">
        <div class="arch-stat__value">735K</div>
        <div class="arch-stat__label">Trade Edges</div>
      </div>
      <div class="arch-stat">
        <div class="arch-stat__value">3</div>
        <div class="arch-stat__label">Repos</div>
      </div>
      <div class="arch-stat">
        <div class="arch-stat__value">58</div>
        <div class="arch-stat__label">API Endpoints</div>
      </div>
      <div class="arch-stat">
        <div class="arch-stat__value">510</div>
        <div class="arch-stat__label">Backend Tests</div>
      </div>
      <div class="arch-stat">
        <div class="arch-stat__value">343</div>
        <div class="arch-stat__label">Frontend Tests</div>
      </div>
    </div>

    <!-- Tech stack -->
    <div class="arch-stack">
      <span class="arch-tag">Vue 3</span>
      <span class="arch-tag">FastAPI</span>
      <span class="arch-tag">Neo4j 5</span>
      <span class="arch-tag">PostgreSQL 16</span>
      <span class="arch-tag">SQLAlchemy 2</span>
      <span class="arch-tag">Tiptap</span>
      <span class="arch-tag">Cytoscape.js</span>
      <span class="arch-tag">D3.js</span>
      <span class="arch-tag">Tailwind CSS</span>
      <span class="arch-tag">Playwright</span>
      <span class="arch-tag">Vitest</span>
      <span class="arch-tag">Pytest</span>
      <span class="arch-tag">k8s / Helm</span>
      <span class="arch-tag">nginx</span>
      <span class="arch-tag">Prometheus</span>
    </div>

    <div v-for="s in sections" :key="s.id" class="arch-section">
      <h2 class="arch-toggle" @click="toggle(s.id)">
        <span>{{ expanded[s.id] ? '\u25BE' : '\u25B8' }}</span>
        {{ s.title }}
      </h2>
      <p v-if="!expanded[s.id]" class="arch-desc">{{ s.desc }}</p>

      <div v-show="expanded[s.id]" class="arch-diagram" v-html="renderedSvgs[s.id] || 'Loading...'">
      </div>
    </div>

    <!-- Repos -->
    <div class="arch-repos">
      <h2>Repositories</h2>
      <table>
        <thead><tr><th>Repo</th><th>Stack</th><th>Tests</th><th>Deploy</th></tr></thead>
        <tbody>
          <tr>
            <td><strong>gmr-web</strong></td>
            <td>Vue 3 + Vite + Tailwind + Tiptap + D3 + Cytoscape + Mermaid</td>
            <td>343 vitest + 175 Playwright (Chromium + Firefox)</td>
            <td>Docker (nginx) &rarr; Helm &rarr; k8s gmr namespace</td>
          </tr>
          <tr>
            <td><strong>edgar-gmr-etl</strong></td>
            <td>FastAPI + Neo4j driver + pandas + pycountry</td>
            <td>459 pytest + pylint 9.9+</td>
            <td>Docker (Python 3.12) &rarr; Helm &rarr; k8s gmr namespace</td>
          </tr>
          <tr>
            <td><strong>gmr-community-api</strong></td>
            <td>FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL</td>
            <td>51 pytest (0.10s, InMemory repos)</td>
            <td>Docker (Python 3.12) &rarr; Helm &rarr; k8s gmr namespace</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.arch { max-width: 1100px; margin: 0 auto; padding: 0 1rem 4rem; }
.arch-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.arch-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0.3rem 0 0; }
.arch-header__right { display: flex; gap: 8px; align-items: center; }
.arch-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.arch-sub { font-size: 0.82rem; color: var(--muted); margin-top: 0.2rem; max-width: 600px; line-height: 1.5; }
.arch-section { margin-bottom: 0.5rem; }
.arch-toggle { font-size: 1rem; font-weight: 700; cursor: pointer; padding: 0.75rem 0; border-bottom: 1px solid var(--border); user-select: none; display: flex; gap: 0.5rem; align-items: center; }
.arch-toggle:hover { color: var(--accent); }
.arch-desc { font-size: 0.82rem; color: var(--muted); padding: 0.25rem 0 0 1.2rem; }
.arch-diagram { overflow-x: auto; padding: 1rem 0; }
.arch-diagram .mermaid { background: none; border: none; font-size: 0.85rem; }
.arch-expand-btn { padding: 3px 10px; font-size: 0.75rem; border: 1px solid var(--border); background: transparent; color: var(--muted); cursor: pointer; border-radius: 3px; }
.arch-expand-btn:hover { border-color: var(--accent); color: var(--accent); }

/* Stats strip */
.arch-stats { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 1.25rem; }
.arch-stat { text-align: center; padding: 8px 14px; border: 1px solid var(--border); border-radius: 6px; min-width: 80px; background: var(--surface); }
.arch-stat__value { font-size: 1.1rem; font-weight: 800; color: var(--accent); }
.arch-stat__label { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }

/* Tech tags */
.arch-stack { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 1.5rem; }
.arch-tag { font-size: 0.72rem; font-weight: 600; padding: 2px 8px; border-radius: 3px; background: var(--surface); color: var(--text); border: 1px solid var(--border); letter-spacing: 0.02em; }

/* Repos table */
.arch-repos { margin-top: 2rem; }
.arch-repos h2 { font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem; }
.arch-repos table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.arch-repos th { background: var(--surface); text-align: left; padding: 6px 10px; border: 1px solid var(--border); font-weight: 600; }
.arch-repos td { padding: 6px 10px; border: 1px solid var(--border); vertical-align: top; }
</style>
