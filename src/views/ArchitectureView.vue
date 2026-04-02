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
  end
  subgraph K8s["k8s cluster — gmr namespace"]
    WEB["gmr-web<br/>nginx + Vue 3 SPA"]
    API["gmr-api<br/>FastAPI + uvicorn"]
    NEO["Neo4j 5 CE<br/>APOC plugin<br/>12Gi RAM / 50Gi PVC"]
    PROM["Prometheus<br/>ServiceMonitor"]
  end
  subgraph Storage
    NFS["NFS PVC<br/>EDGAR JSON + price CSVs"]
    ESEF_PVC["ESEF PVC<br/>EU XBRL summaries"]
  end
  USER -->|HTTPS| WEB
  WEB -->|"/api/*"| API
  API --> NEO
  API -->|read-only| NFS
  API -->|read-only| ESEF_PVC
  API -->|"/metrics"| PROM
  subgraph ETL["CronJobs (scheduled)"]
    GLEIF_JOB["GLEIF L1+L2<br/>weekly"]
    TED_JOB["TED contracts<br/>daily"]
    DIR_JOB["FR directors<br/>monthly"]
  end
  GLEIF_API -.->|download| GLEIF_JOB
  TED_API -.->|download| TED_JOB
  RNE_API -.->|download| DIR_JOB
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

  // 3. Backend layers — hexagonal architecture
  layers: `flowchart TD
  subgraph Presentation["Presentation Layer (11 routers)"]
    R_FIN["Financial routers<br/>fundamentals / valuation / prices / gmr_long / gmr_short / gmr_data"]
    R_PROC["Procurement routers<br/>contracts / search / authorities / sectors"]
    R_GOV["Governance routers<br/>persons / entity-resolution / data-quality"]
    R_GRAPH["Graph router<br/>graph traversal / path finding"]
    R_INFRA["Infra routers<br/>health / tickers"]
  end
  subgraph DI["Dependency Injection (dependencies.py)"]
    D1["get_data_source()"]
    D2["get_contract_source()"]
    D3["get_person_source()"]
    D4["get_data_quality_source()"]
    D5["get_neo4j_client()"]
  end
  subgraph Domain["Domain Layer (ABCs in src/analysis/)"]
    ABC1["FinancialDataSource<br/>8 abstract methods"]
    ABC2["ContractDataSource<br/>4 abstract methods"]
    ABC3["PersonDataSource<br/>3 abstract methods"]
    ABC4["DataQualitySource<br/>4 abstract methods"]
    LOGIC["Pure analysis<br/>GMRLong / GMRShort<br/>Fundamentals / Valuation"]
  end
  subgraph Infra["Infrastructure Layer (src/data/)"]
    G1["GraphDataSource<br/>Neo4j + CSV fallback"]
    G2["GraphContractSource<br/>Neo4j"]
    G3["GraphPersonSource<br/>Neo4j"]
    G4["GraphDataQualitySource<br/>Neo4j"]
    NEO_C["Neo4jClient<br/>bolt driver wrapper"]
    CSV1["LocalEdgarFetcher<br/>EDGAR JSON files"]
    CSV2["LocalPriceFetcher<br/>daily OHLCV CSVs"]
  end
  R_FIN --> D1
  R_PROC --> D2
  R_GOV --> D3
  R_GOV --> D4
  R_GRAPH --> D5
  D1 --> ABC1
  D2 --> ABC2
  D3 --> ABC3
  D4 --> ABC4
  ABC1 --> G1
  ABC2 --> G2
  ABC3 --> G3
  ABC4 --> G4
  G1 --> NEO_C
  G1 --> CSV1
  G1 --> CSV2
  G2 --> NEO_C
  G3 --> NEO_C
  G4 --> NEO_C
  LOGIC --> ABC1`,

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
    subgraph Pages["Page Components"]
      HOME["HomeView<br/>Landing + Ticker Detail"]
      ADMIN["AdminView<br/>Hub"]
      DQ["DataQualityView<br/>Health Dashboard"]
      ER["EntityResolutionView<br/>3-Panel Merge UI"]
      ARCH["ArchitectureView<br/>Mermaid Diagrams"]
      COV["CoverageView<br/>Test Matrix"]
      CP["CompanyProfileView<br/>Standalone Profile"]
    end
    subgraph Core["Core Components"]
      SEARCH["TickerSearch<br/>debounced search + dropdown"]
      DISPATCH["TickerFinancials<br/>view dispatcher + data loader"]
      NAV["DataViewSelector<br/>grouped desktop nav<br/>mobile dropdown"]
    end
    subgraph Panels["9 View Panels"]
      P1["ProfilePanel"]
      P2["SummaryPanel<br/>D3 candlestick chart"]
      P3["Fundamentals table"]
      P4["IncomePanel"]
      P5["CashflowPanel"]
      P6["BalancePanel"]
      P7["ValuationPanel"]
      P8["ContractsPanel<br/>sortable table + cards"]
      P9["GraphExplorer<br/>Cytoscape + path finding<br/>+ timeline + export"]
    end
    subgraph Shared["Shared"]
      THEME["useTheme<br/>dark/light + localStorage"]
      ANALYTICS["useAnalytics<br/>Umami events"]
      FMT["format.js<br/>fmtMoney / fmtPrice"]
    end
  end
  ROUTER --> HOME
  ROUTER --> ADMIN
  ROUTER --> CP
  ADMIN --> DQ
  ADMIN --> ER
  ADMIN --> ARCH
  ADMIN --> COV
  HOME --> SEARCH
  HOME --> NAV
  HOME --> DISPATCH
  DISPATCH --> P1
  DISPATCH --> P2
  DISPATCH --> P3
  DISPATCH --> P4
  DISPATCH --> P5
  DISPATCH --> P6
  DISPATCH --> P7
  DISPATCH --> P8
  DISPATCH --> P9
  P9 -->|"fetch /api/graph/"| API_GRAPH["Graph API"]
  P8 -->|"fetch /api/companies/"| API_PROC["Procurement API"]
  DISPATCH -->|"fetch /api/fundamentals"| API_FIN["Financial API"]`,

  // 6. API endpoint map — full surface area
  api: `flowchart LR
  subgraph Financial["Financial Endpoints"]
    E1["GET /{ticker}/fundamentals<br/>P/E, P/B, ROE, margins, 10Y"]
    E2["GET /{ticker}/gmr_long<br/>value investing screen"]
    E3["GET /{ticker}/gmr_short<br/>swing trading screen"]
    E4["GET /{ticker}/gmr_data<br/>raw spreadsheet data"]
    E5["GET /{ticker}/gmr_data_csv<br/>CSV download"]
    E6["GET /{ticker}/valuation<br/>EV, EBITDA, ROIC"]
    E7["GET /{ticker}/prices<br/>OHLCV history"]
    E8["GET /tickers/search<br/>ticker lookup"]
  end
  subgraph Procurement["Procurement Endpoints"]
    E9["GET /companies/{id}/contracts<br/>awarded contracts"]
    E10["GET /companies/{id}<br/>company profile + group"]
    E11["GET /authorities/{id}/contracts<br/>issued contracts"]
    E12["GET /authorities/{id}<br/>authority profile"]
    E13["GET /contracts/sectors<br/>CPV aggregation"]
    E14["GET /contracts/{notice}<br/>contract detail"]
    E15["GET /search<br/>unified search"]
  end
  subgraph Graph["Graph Explorer Endpoints"]
    E16["GET /graph/{id}<br/>entity traversal depth 0-3<br/>500-node cap"]
    E17["GET /graph/paths/find<br/>shortest + extra paths"]
  end
  subgraph Governance["Governance Endpoints"]
    E18["GET /persons/search<br/>name search"]
    E19["GET /persons/{id}<br/>roles history"]
    E20["GET /entity-resolution/candidates<br/>unreviewed SAME_AS"]
    E21["POST /entity-resolution/resolve<br/>approve/reject merge"]
    E22["GET /data-quality<br/>health overview"]
    E23["GET /v1/health/data<br/>liveness probe"]
  end`,

  // 7. Request flow — graph explorer path finding
  graphflow: `sequenceDiagram
  participant B as Browser
  participant N as nginx
  participant F as FastAPI
  participant R as graph.py
  participant DB as Neo4j

  B->>N: GET /c/SOCOMEC-uuid/graph
  N->>B: Vue SPA (index.html)
  Note over B: GraphExplorer.vue mounts
  B->>N: GET /api/graph/{uuid}?depth=1
  N->>F: proxy to :8000
  F->>R: graph_traverse(uuid, depth=1)
  R->>DB: MATCH (n:Company {gmr_id}) ... detect entity
  DB-->>R: Company found
  R->>DB: MATCH path = (start)-[*1..1]-(neighbor)
  DB-->>R: paths (nodes + relationships)
  R-->>F: GraphResponse (nodes, edges, truncated)
  F-->>B: JSON
  Note over B: Cytoscape renders graph
  B->>N: GET /api/graph/paths/find?from=A&to=B
  N->>F: proxy
  F->>R: graph_paths(from, to)
  R->>DB: shortestPath((a)-[*..5]-(b))
  DB-->>R: path
  R->>DB: extra paths within shortest+2
  DB-->>R: additional paths
  R-->>F: PathResponse
  F-->>B: JSON
  Note over B: Highlight paths in blue`,

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
  { id: 'infra', title: 'Infrastructure', desc: 'Kubernetes cluster, pods, storage, external data sources, CronJobs.' },
  { id: 'schema', title: 'Neo4j Data Model', desc: '8 node labels, 8 relationship types, key properties and constraints.' },
  { id: 'layers', title: 'Backend Architecture', desc: 'Hexagonal layers: routers, dependency injection, domain ABCs, Neo4j implementations.' },
  { id: 'api', title: 'API Surface', desc: '23 endpoints across financial, procurement, graph, and governance domains.' },
  { id: 'etl', title: 'Data Pipeline', desc: '10 ETL scripts loading GLEIF, EDGAR, ESEF, TED, and French directors into Neo4j.' },
  { id: 'frontend', title: 'Frontend Components', desc: 'Vue 3 SPA: 7 pages, 13 components, 9 view panels, 2 composables.' },
  { id: 'graphflow', title: 'Graph Explorer Flow', desc: 'How the graph explorer fetches, renders, and highlights paths.' },
  { id: 'identity', title: 'Identity Resolution', desc: 'How gmr_id is generated, countries normalized, and duplicates resolved.' },
]

const expanded = ref({
  infra: true, schema: false, layers: false, api: false,
  etl: false, frontend: false, graphflow: false, identity: false,
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
        <div class="arch-stat__value">3.4M+</div>
        <div class="arch-stat__label">Companies</div>
      </div>
      <div class="arch-stat">
        <div class="arch-stat__value">379K</div>
        <div class="arch-stat__label">Contracts</div>
      </div>
      <div class="arch-stat">
        <div class="arch-stat__value">251K</div>
        <div class="arch-stat__label">Parent-Child</div>
      </div>
      <div class="arch-stat">
        <div class="arch-stat__value">27</div>
        <div class="arch-stat__label">EU Countries</div>
      </div>
      <div class="arch-stat">
        <div class="arch-stat__value">23</div>
        <div class="arch-stat__label">API Endpoints</div>
      </div>
      <div class="arch-stat">
        <div class="arch-stat__value">456</div>
        <div class="arch-stat__label">Backend Tests</div>
      </div>
      <div class="arch-stat">
        <div class="arch-stat__value">321</div>
        <div class="arch-stat__label">Frontend Tests</div>
      </div>
    </div>

    <!-- Tech stack -->
    <div class="arch-stack">
      <span class="arch-tag">Vue 3</span>
      <span class="arch-tag">FastAPI</span>
      <span class="arch-tag">Neo4j 5</span>
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
            <td>Vue 3 + Vite + Tailwind + D3 + Cytoscape + Mermaid</td>
            <td>321 vitest + 175 Playwright (Chromium + Firefox)</td>
            <td>Docker (nginx) &rarr; Helm &rarr; k8s gmr namespace</td>
          </tr>
          <tr>
            <td><strong>edgar-gmr-etl</strong></td>
            <td>FastAPI + Neo4j driver + pandas + pycountry</td>
            <td>456 pytest + pylint 9.9+</td>
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
