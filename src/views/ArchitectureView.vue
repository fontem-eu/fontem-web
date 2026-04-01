<script setup>
import { onMounted, ref } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

const loaded = ref(false)

onMounted(async () => {
  document.title = 'Architecture — GMR'
  const script = document.createElement('script')
  script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js'
  script.onload = () => {
    const isDark = document.documentElement.classList.contains('dark')
    window.mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      securityLevel: 'loose',
    })
    window.mermaid.run()
    loaded.value = true
  }
  document.head.appendChild(script)
})

const diagrams = {
  system: `flowchart LR
  subgraph K8s["k8s cluster (gmr namespace)"]
    WEB["gmr-web<br/>(nginx + Vue SPA)"]
    API["edgar-gmr-etl<br/>(FastAPI)"]
    NEO["Neo4j 5<br/>(graph DB)"]
    NFS["NFS PVC<br/>(price CSVs)"]
  end
  USER((User)) --> WEB
  WEB -->|"/api/*"| API
  API --> NEO
  API --> NFS
  subgraph CronJobs
    GLEIF["GLEIF refresh<br/>(weekly)"]
    TED["TED daily<br/>(weekdays)"]
    BACKUP["Neo4j backup<br/>(nightly)"]
  end
  GLEIF --> NEO
  TED --> NEO
  BACKUP --> NFS`,

  interfaces: `classDiagram
  class FinancialDataSource {
    <<ABC>>
    +get_annual_fundamentals(ticker, years)
    +get_price_history(ticker, period)
    +search_tickers(query, limit)
  }
  class ContractDataSource {
    <<ABC>>
    +get_company_contracts(gmr_id)
    +get_authority_contracts(authority_id)
    +get_sector_summary(country, year)
  }
  class PersonDataSource {
    <<ABC>>
    +get_company_directors(gmr_id)
    +search_persons(name, limit)
  }
  class DataQualitySource {
    <<ABC>>
    +get_graph_stats()
    +get_matching_stats()
    +get_coverage_stats()
  }
  FinancialDataSource <|-- GraphDataSource
  ContractDataSource <|-- GraphContractSource
  PersonDataSource <|-- GraphPersonSource
  DataQualitySource <|-- GraphDataQualitySource`,

  schema: `erDiagram
  Company ||--o{ Listing : LISTED_AS
  Company ||--o{ FinancialYear : REPORTED
  Company ||--o{ Company : SUBSIDIARY_OF
  Authority ||--o{ Contract : AWARDED
  Contract }o--|| Company : AWARDED_TO
  Contract }o--o| CPV : CATEGORIZED_AS
  Person }o--o{ Company : DIRECTS
  Company {
    string gmr_id PK
    string lei
    string name
    string country
    string vat
  }
  Contract {
    string ted_notice_id PK
    string title
    float value_eur
    string award_date
  }
  Person {
    string person_id PK
    string name
    string first_name
  }`,

  pipeline: `flowchart TD
  GLEIF_L1["GLEIF Level 1<br/>3.26M companies"] -->|load_gleif.py| NEO[(Neo4j)]
  GLEIF_L2["GLEIF Level 2<br/>251K relationships"] -->|load_gleif_relationships.py| NEO
  ESEF["ESEF summaries"] -->|load_eu_listings.py| NEO
  EDGAR["EDGAR companyfacts"] -->|load_us_financials.py| NEO
  TED["TED monthly ZIPs"] -->|eforms-parser| PARSED["Parsed Notices"]
  PARSED -->|ted_matcher.py| MATCHED["Matched Companies"]
  MATCHED -->|load_ted_contracts.py| NEO
  RNE["recherche-entreprises API"] -->|load_fr_directors.py| NEO
  DEDUP["dedup_companies.py"] -->|merge / SAME_AS| NEO`,

  request: `sequenceDiagram
  participant B as Browser
  participant N as nginx
  participant F as FastAPI
  participant R as resolve_company_id
  participant G as GraphDataSource
  participant DB as Neo4j
  participant CSV as NFS CSV

  B->>N: GET /AAPL/profile
  N->>F: proxy to :8000
  F->>R: resolve_company_id("AAPL")
  R->>DB: MATCH (l:Listing)
  DB-->>R: company_info
  F->>G: get_annual_fundamentals
  G->>DB: MATCH ... FinancialYear
  DB-->>G: rows
  G->>CSV: read AAPL.csv
  CSV-->>G: OHLCV
  F-->>B: JSON response`,
}

const sections = [
  { id: 'system', title: 'System Overview' },
  { id: 'interfaces', title: 'Interface Map' },
  { id: 'schema', title: 'Neo4j Schema' },
  { id: 'pipeline', title: 'Data Pipeline' },
  { id: 'request', title: 'Request Flow' },
]

const expanded = ref({ system: true, interfaces: false, schema: false, pipeline: false, request: false })
function toggle(id) { expanded.value[id] = !expanded.value[id] }
</script>

<template>
  <div class="arch">
    <header class="arch-header">
      <div>
        <router-link to="/admin" class="arch-back">&larr; Admin</router-link>
        <h1>Architecture</h1>
        <p class="arch-sub">System diagrams rendered with Mermaid.js</p>
      </div>
      <ThemeToggle />
    </header>

    <div v-for="s in sections" :key="s.id" class="arch-section">
      <h2 class="arch-toggle" @click="toggle(s.id)">
        <span>{{ expanded[s.id] ? '\u25BE' : '\u25B8' }}</span>
        {{ s.title }}
      </h2>

      <div v-show="expanded[s.id]" class="arch-diagram">
        <pre class="mermaid">{{ diagrams[s.id] }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.arch { max-width: 1100px; margin: 0 auto; padding: 0 1rem 4rem; }
.arch-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.arch-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0.3rem 0 0; }
.arch-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.arch-sub { font-size: 0.85rem; color: var(--muted); margin-top: 0.2rem; }
.arch-section { margin-bottom: 0.5rem; }
.arch-toggle { font-size: 1rem; font-weight: 700; cursor: pointer; padding: 0.75rem 0; border-bottom: 1px solid var(--border); user-select: none; display: flex; gap: 0.5rem; align-items: center; }
.arch-toggle:hover { color: var(--accent); }
.arch-diagram { overflow-x: auto; padding: 1rem 0; }
.arch-diagram .mermaid { background: none; border: none; font-size: 0.85rem; }
</style>
