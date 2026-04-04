/**
 * Roadmap feature definitions — shared between the index and detail pages.
 *
 * Categories:
 *   data-source  — external datasets to ingest
 *   insight       — tools that turn data into understanding
 *   platform      — user-facing infrastructure (auth, collaboration)
 *
 * Already implemented (removed from roadmap):
 *   - Collaborative Reports (gmr-community-api: reports, sections, sharing, pocket)
 *   - Community Curation (issues, moderation, flags, sanctions, trust levels)
 *   - Entity Dashboards (ProfilePanel: company/authority/person profiles, directors, contracts, groups)
 */

export const features = [
  // ── Insight tools (data → understanding) ──────────────────

  {
    id: 'llm-assistant',
    title: 'AI-Assisted Report Writing',
    category: 'insight',
    status: 'proposed',
    effort: 'High',
    source: 'Anthropic Claude API',
    sourceUrl: 'https://docs.anthropic.com/en/docs',
    format: 'Web UI (in-editor) + API proxy',
    coverage: 'All loaded entities',
    summary:
      'An LLM embedded in the report editor that can query the graph API, summarise ' +
      'data, draft analysis paragraphs, and answer questions — all grounded in real GMR data.',
    description: `
## The problem

Reports are powerful, but writing them is slow. A journalist staring at 200 contracts needs help extracting patterns, drafting summaries, and asking "what if" questions. An LLM that can read the graph is the force multiplier.

## Architecture

Three options were evaluated:

| Approach | Cost model | Latency | Context control | Verdict |
|----------|-----------|---------|----------------|---------|
| **A. Backend-proxied API** | Per-token (Anthropic API) | 1-5s | Full server-side control | **Chosen** |
| B. Embedded Claude terminal (iframe) | User's own Claude subscription | <1s | No control — user pastes data manually | Too unstructured |
| C. Frontend-only SDK | Per-token, key exposed | 1-5s | No server-side safety | Insecure |

**Option A wins** because the backend controls context, enforces quotas, and keeps the API key secret.

## How it works

\`\`\`
User types prompt in report editor
    → POST /capi/assist/chat
    → gmr-community-api validates JWT, checks quota
    → Builds system prompt with:
        - Neo4j schema (node labels, relationship types, properties)
        - Current report context (title, sections so far)
        - Available tool definitions (graph API endpoints)
    → Calls Anthropic Messages API with tool_use enabled
    → Claude may call tools (graph queries, contract lookups, etc.)
    → Backend executes tool calls against edgar-gmr-etl API
    → Returns final response with citations
    → Frontend renders in editor sidebar
\`\`\`

## Tool-use: giving Claude access to the graph

The key insight: Claude's **tool_use** feature lets us define the GMR REST API as callable tools. The LLM decides which endpoints to call, the backend executes them, and Claude synthesises the results.

### Tools exposed to Claude

| Tool | Maps to | Purpose |
|------|---------|---------|
| \`search_entities\` | \`GET /api/tickers/search\` | Find companies, authorities, persons by name |
| \`get_company\` | \`GET /api/companies/{id}\` | Full company profile with contracts, directors, group |
| \`get_authority\` | \`GET /api/authorities/{id}\` | Authority profile with awarded contracts |
| \`get_contracts\` | \`GET /api/companies/{id}/contracts\` | Contracts for an entity |
| \`explore_graph\` | \`GET /api/graph/{id}?depth=N\` | Graph traversal from any entity |
| \`find_paths\` | \`GET /api/graph/paths/find\` | Find connections between two entities |
| \`get_fundamentals\` | \`GET /api/{ticker}/fundamentals\` | Financial data |

### Example interaction

User: "Summarise Metro Mondego's procurement patterns"

Claude internally:
1. Calls \`search_entities("Metro Mondego")\` → gets authority_id
2. Calls \`get_authority(authority_id)\` → sees 51 contracts, €699M total
3. Calls \`get_contracts(authority_id)\` → gets top contracts by value
4. Calls \`explore_graph(authority_id, depth=1)\` → sees supplier network
5. Synthesises: "Metro Mondego awarded 51 contracts totalling €699M. The top 3 suppliers account for 72% of total spend..."

## Context management

| Context layer | Size | Purpose |
|--------------|------|---------|
| System prompt | ~2K tokens | Schema, safety rules, available tools |
| Report context | ~1K tokens | Title, abstract, section summaries |
| Conversation history | Last 10 turns | Continuity within a session |
| Tool results | Variable | Fresh data from graph API |

**Total context budget:** ~8K tokens system + tool results. User messages and tool calls fill the rest. Use \`claude-sonnet-4-6\` for cost efficiency (~$3/M input, $15/M output).

## Cost control

| Control | Implementation |
|---------|---------------|
| Per-user daily quota | PostgreSQL: \`llm_usage(user_id, date, tokens_in, tokens_out)\` |
| Default: 50K tokens/day | Configurable per trust_level |
| Rate limit | 10 requests/minute per user (FastAPI middleware) |
| Max response | 4096 tokens per completion |
| Admin override | Admins get unlimited |

## Schema changes

### PostgreSQL (gmr-community-api)

\`\`\`sql
CREATE TABLE llm_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    tokens_in BIGINT NOT NULL DEFAULT 0,
    tokens_out BIGINT NOT NULL DEFAULT 0,
    request_count INT NOT NULL DEFAULT 0,
    UNIQUE(user_id, date)
);

CREATE TABLE llm_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    report_id TEXT,
    messages JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
\`\`\`

## New files

| File | Purpose |
|------|---------|
| \`gmr-community-api/src/services/llm_service.py\` | Claude API client with tool execution loop |
| \`gmr-community-api/src/services/llm_tools.py\` | Tool definitions + proxy calls to edgar-gmr-etl |
| \`gmr-community-api/src/api/routers/assist.py\` | \`POST /assist/chat\`, \`GET /assist/usage\` |
| \`gmr-community-api/src/repositories/llm_repository.py\` | Usage tracking + conversation persistence |
| \`gmr-community-api/migrations/versions/002_llm_tables.py\` | Alembic migration |
| \`gmr-web/src/components/AssistPanel.vue\` | Chat sidebar in report editor |
| \`gmr-web/src/api/community.js\` | Add \`sendAssistMessage()\`, \`getUsage()\` |

## Environment variables

\`\`\`
ANTHROPIC_API_KEY=sk-ant-...        # K8s secret
ANTHROPIC_MODEL=claude-sonnet-4-6   # Default model
LLM_DAILY_QUOTA=50000               # Tokens per user per day
GMR_API_INTERNAL=http://gmr-api.gmr.svc.cluster.local:8000  # Internal API URL for tool calls
\`\`\`

## Frontend UX

The report editor gets a collapsible **Assist panel** (right sidebar):
- Chat-style interface with user messages and AI responses
- Responses include inline citations linking to graph entities
- "Insert into report" button copies AI text into the active section
- Token usage indicator at bottom
- Conversation persists per report (reload-safe)
`,
    impact:
      'The most transformative feature. Turns every user into a data analyst. ' +
      'A citizen asks "is this company getting unusual amounts of public money?" and gets a sourced answer in seconds.',
  },
  {
    id: 'anomaly-detection',
    title: 'Anomaly Detection & Red Flags',
    category: 'insight',
    status: 'proposed',
    effort: 'Medium',
    source: 'Internal — Cypher pattern queries on existing graph',
    sourceUrl: null,
    format: 'API + Dashboard',
    coverage: 'All loaded entities',
    summary:
      'Automated pattern detection that surfaces suspicious structures: ' +
      'unusually concentrated procurement, director networks spanning buyers and suppliers, ' +
      'shell-like entities, and abnormal contract timing.',
    description: `
## Red-flag patterns (Cypher queries)

### 1. Revolving door
Person who directed a public authority also directs a company that won contracts from it.

\`\`\`cypher
MATCH (p:Person)-[:DIRECTS]->(a:Authority)
MATCH (p)-[:DIRECTS]->(c:Company)
MATCH (a)-[:CLIENT_OF]->(c)
RETURN p.name, a.name, c.name, r.total_eur
\`\`\`

### 2. Contract concentration
Authority awards >50% of total spend to a single supplier.

\`\`\`cypher
MATCH (a:Authority)-[r:CLIENT_OF]->(c:Company)
WITH a, sum(r.total_eur) AS total_spend, collect({company: c.name, eur: r.total_eur}) AS suppliers
UNWIND suppliers AS s
WITH a, total_spend, s WHERE s.eur > total_spend * 0.5
RETURN a.name, s.company, s.eur, total_spend
\`\`\`

### 3. Shell-like entities
Companies with no financials, no employees, but winning large contracts.

### 4. Bid-splitting
Multiple contracts just below public tender threshold, same authority→company, within 90 days.

### 5. Cross-border director networks
Person directing companies in 3+ countries that all supply the same authority.

## Implementation plan

### Schema changes (Neo4j)

\`\`\`cypher
CREATE (:RedFlag {id, pattern, severity, entity_ids, details_json, detected_at, reviewed: false})
CREATE INDEX redflag_pattern FOR (r:RedFlag) ON (r.pattern)
CREATE INDEX redflag_reviewed FOR (r:RedFlag) ON (r.reviewed)
\`\`\`

### New files

| File | Purpose |
|------|---------|
| \`edgar-gmr-etl/src/etl/detect_anomalies.py\` | Run all pattern queries, create RedFlag nodes |
| \`edgar-gmr-etl/src/api/routers/red_flags.py\` | \`GET /red-flags\`, \`GET /red-flags/{entity_id}\`, \`POST /red-flags/{id}/review\` |
| \`gmr-web/src/views/RedFlagsView.vue\` | Dashboard: sortable table with severity, pattern, entities |
| \`gmr-web/src/components/RedFlagBadge.vue\` | Small badge shown on entity profiles when flags exist |

### New CronJob

\`\`\`yaml
# cronjob-anomaly-detection.yaml
schedule: "0 8 * * 1"  # Weekly Monday 08:00 UTC
command: python3 -m src.etl.detect_anomalies
\`\`\`

### API endpoints

| Endpoint | Purpose |
|----------|---------|
| \`GET /red-flags?pattern=&severity_min=&reviewed=false&limit=50\` | List flags with filters |
| \`GET /red-flags/entity/{entity_id}\` | Flags involving a specific entity |
| \`POST /red-flags/{id}/review\` | Mark as reviewed (admin) |
| \`GET /red-flags/stats\` | Counts by pattern and severity |

## Important caveat

Red flags are **not accusations**. The UI must clearly state: "This structure is statistically unusual and warrants human review."
`,
    impact:
      'Turns passive data into active leads. Investigative journalists get a prioritized list of structures worth examining.',
  },
  {
    id: 'entity-watchlists',
    title: 'Entity Watchlists & Alerts',
    category: 'insight',
    status: 'proposed',
    effort: 'Medium',
    source: 'Internal',
    sourceUrl: null,
    format: 'Web UI + email notifications',
    coverage: 'All loaded entities',
    summary:
      'Users watch entities and receive alerts when new data appears: ' +
      'new contracts, new directors, new corporate group changes.',
    description: `
## What triggers an alert

- New contract awarded to/by the watched entity
- New director appointed or resigned
- New subsidiary added to the corporate group
- Entity flagged by anomaly detection
- Entity appears in a newly loaded dataset

## Schema changes

### PostgreSQL (gmr-community-api)

\`\`\`sql
CREATE TABLE watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,  -- company, authority, person
    entity_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, entity_id)
);

CREATE TABLE alert (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,  -- new_contract, new_director, new_subsidiary, red_flag
    title TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_alert_user_read ON alert(user_id, read);
\`\`\`

## New files

| File | Purpose |
|------|---------|
| \`gmr-community-api/src/domain/watchlist.py\` | Watch, Alert dataclasses |
| \`gmr-community-api/src/repositories/watchlist_repository.py\` | ABC for watch/alert CRUD |
| \`gmr-community-api/src/infra/memory/mem_watchlist_repo.py\` | InMemory impl |
| \`gmr-community-api/src/infra/postgres/pg_watchlist_repo.py\` | Postgres impl |
| \`gmr-community-api/src/services/watchlist_service.py\` | Watch/unwatch, generate alerts, mark read |
| \`gmr-community-api/src/api/routers/watchlist.py\` | REST endpoints |
| \`gmr-community-api/migrations/versions/003_watchlist.py\` | Alembic migration |
| \`gmr-web/src/components/WatchButton.vue\` | Toggle watch on any entity profile |
| \`gmr-web/src/components/AlertBell.vue\` | Header bell icon with unread count |
| \`gmr-web/src/views/AlertsView.vue\` | Full alerts list with filters |

## API endpoints

| Endpoint | Purpose |
|----------|---------|
| \`POST /watchlist\` | Watch an entity |
| \`DELETE /watchlist/{entity_id}\` | Unwatch |
| \`GET /watchlist\` | List watched entities |
| \`GET /alerts?read=false&limit=20\` | List alerts |
| \`POST /alerts/{id}/read\` | Mark as read |
| \`POST /alerts/read-all\` | Mark all as read |

## Alert generation

A background job runs after each ETL load:
1. Query Neo4j for entities with new data since last run
2. Cross-reference with watchlist table
3. Create alert rows for matching users

### New CronJob

\`\`\`yaml
# cronjob-generate-alerts.yaml
schedule: "30 6 * * 1-5"  # Weekdays 06:30 UTC (after TED daily at 06:00)
command: python3 -m src.etl.generate_alerts
\`\`\`

## Email digest (phase 2)

Weekly email via SendGrid/SES with all unread alerts. Requires \`email_preferences\` table extension.
`,
    impact:
      'Keeps investigators in the loop without daily visits. When a watched company wins a new contract before an election, the journalist knows immediately.',
  },
  {
    id: 'natural-language',
    title: 'Natural Language Queries',
    category: 'insight',
    status: 'proposed',
    effort: 'High',
    source: 'Internal — LLM-powered query translation',
    sourceUrl: null,
    format: 'Web UI (search bar) + API',
    coverage: 'All loaded entities',
    summary:
      'Ask questions in plain language — "Who are the biggest suppliers to the French Ministry of Defence?" ' +
      '— and get graph-backed answers with citations.',
    description: `
## Architecture

Reuses the same LLM infrastructure as AI-Assisted Report Writing, but exposed as a standalone search interface.

\`\`\`
User question (text)
    → POST /capi/assist/query
    → Same tool_use loop as report assistant
    → But returns structured answer card instead of chat
\`\`\`

## Depends on

- **AI-Assisted Report Writing** — shares the LLM service, tool definitions, and quota system

## New files (incremental over LLM assistant)

| File | Purpose |
|------|---------|
| \`gmr-community-api/src/api/routers/assist.py\` | Add \`POST /assist/query\` endpoint |
| \`gmr-web/src/components/NaturalLanguageBar.vue\` | Search bar with "Ask a question" mode |
| \`gmr-web/src/components/AnswerCard.vue\` | Structured answer display with citations |

## Safety

- LLM generates **read-only** API calls only (no mutations)
- Generated queries shown to user for transparency
- Results always link back to source entities
- Unauthenticated users get 5 free queries/day (encourage sign-up)

## Example queries

| Question | Tools called |
|----------|-------------|
| "Who are the top 5 suppliers to Ville de Paris?" | search_entities → get_authority → get_contracts |
| "How is Jean Dupont connected to Metro Mondego?" | search_entities (x2) → find_paths |
| "Which companies won contracts in both France and Germany?" | explore_graph with filters |
| "How much public money did VINCI receive in 2024?" | search_entities → get_contracts |
`,
    impact:
      'Removes the last barrier between citizens and public data. No Cypher knowledge needed.',
  },
  {
    id: 'factcheck-api',
    title: 'Fact-Check Query API',
    category: 'insight',
    status: 'proposed',
    effort: 'Medium',
    source: 'Internal',
    sourceUrl: null,
    format: 'REST API',
    coverage: 'All loaded entities',
    summary: 'High-level API for common transparency questions. Designed for newsroom integration.',
    description: `
## Endpoints

Pre-built queries that combine multiple graph traversals into single answers:

| Endpoint | Purpose | Combines |
|----------|---------|----------|
| \`GET /factcheck/money/{entity_id}\` | All public money received | Contracts + subsidies + grants |
| \`GET /factcheck/connections/{a}/{b}\` | All paths between two entities | Graph paths + shared directors |
| \`GET /factcheck/network/{person_id}\` | Person's full network | Companies + authorities + associations |
| \`GET /factcheck/red-flags/{entity_id}\` | All anomaly flags | RedFlag nodes |
| \`GET /factcheck/timeline/{entity_id}\` | Chronological event log | Contracts + directors + elections |

## Response format

\`\`\`json
{
  "question": "How much public money did VINCI receive?",
  "answer": {
    "total_eur": 2450000000,
    "breakdown": { "contracts": 2300000000, "grants": 150000000 },
    "period": "2020-2025"
  },
  "sources": [
    { "type": "TED", "count": 487, "loaded_at": "2026-04-01" },
    { "type": "FTS", "count": 12, "loaded_at": "2026-03-15" }
  ],
  "confidence": "high",
  "explore_url": "/c/vinci-gmr-id/contracts"
}
\`\`\`

## New files

| File | Purpose |
|------|---------|
| \`edgar-gmr-etl/src/api/routers/factcheck.py\` | All /factcheck endpoints |
| \`edgar-gmr-etl/tests/test_api_factcheck.py\` | Unit tests |

## Depends on

Multiple data sources being loaded. Endpoints gracefully degrade — if grants aren't loaded yet, the \`money\` endpoint returns contracts only with a \`sources\` array indicating what's available.
`,
    impact: 'A single API answering transparency questions across all sources. Embeddable in newsroom workflows, WhatsApp bots, or other tools.',
  },

  // ── Data sources ──────────────────────────────────────────

  {
    id: 'sirene',
    title: 'SIRENE (French Business Registry)',
    category: 'data-source',
    status: 'proposed',
    source: 'INSEE — Base SIRENE',
    sourceUrl: 'https://www.data.gouv.fr/fr/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret/',
    format: 'CSV bulk download (monthly), ~12M establishments',
    coverage: 'France',
    effort: 'Medium',
    summary: 'The French entity backbone. SIREN is the common key across all French data sources.',
    description: `
## Why SIRENE first

SIREN numbers link subsidies, associations, tax data, lobbying declarations, and campaign finance. Loading SIRENE makes entity matching across all French sources **precise** instead of fuzzy name-based.

## Data model extension

### Company node enrichment

\`\`\`cypher
// Add SIREN/SIRET to existing Company nodes (matched via name+country or VAT)
SET c.siren = "123456789"
SET c.siret_hq = "12345678900012"
SET c.naf_code = "6201Z"
SET c.naf_label = "Computer programming"
SET c.address = "12 rue de la Paix, 75002 Paris"
SET c.employee_range = "50-99"
SET c.legal_form = "SAS"
SET c.creation_date = date("2015-03-12")
\`\`\`

### New index

\`\`\`cypher
CREATE INDEX company_siren IF NOT EXISTS FOR (c:Company) ON (c.siren)
\`\`\`

## ETL pipeline

| File | Purpose |
|------|---------|
| \`edgar-gmr-etl/src/etl/load_sirene.py\` | Download monthly CSV (~2GB), stream-parse, MERGE into Company nodes |
| \`edgar-gmr-etl/src/etl/sirene_matcher.py\` | Match SIRENE entries to existing Company nodes (SIREN→VAT, name+dept) |

## Matching strategy

1. SIREN → existing Company.vat (French VAT = FR + SIREN check digits)
2. Name + department exact match → existing Company nodes
3. Unmatched → create new Company node with \`gmr_id.from_national_id("FR", siren)\`

## CronJob

\`\`\`yaml
schedule: "0 3 1 * *"  # Monthly, 1st at 03:00 UTC
command: python3 -m src.etl.load_sirene
\`\`\`

## Size: ~4M active enterprises, ~12M establishments. CSV ~2GB compressed.
`,
    impact: 'The authoritative French entity backbone. Enables address-based geographic analysis and precise cross-source matching for all French data.',
  },
  {
    id: 'associations',
    title: 'French Associations (RNA)',
    category: 'data-source',
    status: 'proposed',
    source: 'Répertoire National des Associations — data.gouv.fr',
    sourceUrl: 'https://www.data.gouv.fr/fr/datasets/repertoire-national-des-associations/',
    format: 'CSV bulk download, ~1.5M associations',
    coverage: 'France',
    effort: 'Low',
    summary:
      'Load 1.5M French associations. Cross-reference leaders with company directors and elected officials.',
    description: `
## Depends on

- **SIRENE** — for SIREN-based matching of associations that have a business registration

## Schema changes (Neo4j)

\`\`\`cypher
CREATE CONSTRAINT assoc_rna IF NOT EXISTS FOR (a:Association) REQUIRE a.rna_id IS UNIQUE
CREATE INDEX assoc_siren IF NOT EXISTS FOR (a:Association) ON (a.siren)
\`\`\`

### New node

\`\`\`
(:Association {
    rna_id,         -- "W751234567"
    siren,          -- nullable, links to SIRENE
    name,
    purpose,        -- short description
    address,
    department,     -- "75", "13", etc.
    creation_date,
    dissolution_date,
    last_updated
})
\`\`\`

### New relationships

\`\`\`
(:Person)-[:LEADS {role: "president"|"treasurer"|"secretary"}]->(:Association)
(:Association)-[:RECEIVED_SUBSIDY]->(:Subsidy)  -- when subsidies data loaded
\`\`\`

## ETL pipeline

| File | Purpose |
|------|---------|
| \`edgar-gmr-etl/src/etl/load_rna.py\` | Download RNA CSV, parse, MERGE Association nodes |
| \`edgar-gmr-etl/src/etl/load_rna_leaders.py\` | Parse JOAFE announcements for board member names, link to Person nodes |

## Cross-references

- JOAFE (Journal Officiel des Associations) board member names → match to existing Person nodes by name+birth_year
- SIREN → match to Company nodes (some associations are also registered businesses)
- Department → geographic analysis

## CronJob

\`\`\`yaml
schedule: "0 4 15 * *"  # Monthly, 15th at 04:00 UTC
command: python3 -m src.etl.load_rna
\`\`\`
`,
    impact: 'Makes civil society visible. Journalists trace conflict-of-interest networks between associations, companies, and public officials.',
  },
  {
    id: 'lobbying-eu',
    title: 'EU Lobbying Register',
    category: 'data-source',
    status: 'proposed',
    source: 'EU Transparency Register — European Commission',
    sourceUrl: 'https://ec.europa.eu/transparencyregister/public/opendata',
    format: 'XML bulk download + REST API (JSON)',
    coverage: 'EU-wide (~13K registered entities)',
    effort: 'Low',
    summary: 'EU-level lobbying data: who lobbies, how much they spend, which EP access passes they hold.',
    description: `
## Schema changes (Neo4j)

\`\`\`cypher
CREATE CONSTRAINT lobbyist_tr_id IF NOT EXISTS FOR (l:Lobbyist) REQUIRE l.tr_id IS UNIQUE
\`\`\`

### New nodes

\`\`\`
(:Lobbyist {
    tr_id,              -- EU Transparency Register ID
    name,
    country,
    type,               -- "company", "trade_assoc", "ngo", "consultancy", "law_firm"
    annual_costs_min,   -- EUR
    annual_costs_max,
    fte_lobbyists,
    ep_passes,          -- count of EP access badges
    last_updated
})
\`\`\`

### New relationships

\`\`\`
(:Lobbyist)-[:REPRESENTS]->(Company)     -- matched via name/VAT/LEI
(:Lobbyist)-[:HAS_EP_PASS {person_name}]->(:EUInstitution {name: "European Parliament"})
(:Lobbyist)-[:INTERESTS {dossier}]->(:LegislativeDossier)
(:Lobbyist)-[:RECEIVED_EU_GRANT {amount_eur, year}]->(:Grant)
\`\`\`

## ETL pipeline

| File | Purpose |
|------|---------|
| \`edgar-gmr-etl/src/etl/load_eu_lobbying.py\` | Download XML, parse, MERGE Lobbyist nodes + relationships |
| \`edgar-gmr-etl/src/etl/eu_lobby_matcher.py\` | Match lobbyists to existing Company nodes (name, VAT, country) |

## CronJob

\`\`\`yaml
schedule: "0 5 1 * *"  # Monthly, 1st at 05:00 UTC
command: python3 -m src.etl.load_eu_lobbying
\`\`\`
`,
    impact: 'Answers "who is lobbying for what?" Cross-reference with procurement to check if lobbying correlates with contracts.',
  },
  {
    id: 'lobbying-fr',
    title: 'French Lobbying & Asset Declarations (HATVP)',
    category: 'data-source',
    status: 'proposed',
    source: 'Haute Autorité pour la transparence de la vie publique',
    sourceUrl: 'https://www.hatvp.fr/open-data/',
    format: 'JSON / CSV on data.gouv.fr',
    coverage: 'France (~15K declarations, ~2K lobbyists)',
    effort: 'Low',
    summary: 'French lobbying register + asset declarations of public officials.',
    description: `
## Two datasets

1. **Répertoire des représentants d'intérêts** — ~2K entities that lobby French institutions
2. **Declarations of assets and interests** — Ministers, MPs, mayors, senior officials (~15K declarations)

## Schema changes (Neo4j)

### New nodes

\`\`\`
(:AssetDeclaration {
    declaration_id,
    person_id,      -- links to Person
    mandate,        -- "député", "sénateur", "maire"
    real_estate_eur,
    securities_eur,
    income_eur,
    debts_eur,
    year
})
\`\`\`

### New relationships

\`\`\`
(:Person)-[:DECLARED]->(AssetDeclaration)
(:Lobbyist)-[:LOBBIED {year, topic}]->(Person)  -- official being lobbied
\`\`\`

## ETL pipeline

| File | Purpose |
|------|---------|
| \`edgar-gmr-etl/src/etl/load_hatvp.py\` | Download JSON, create AssetDeclaration + Lobbyist nodes |
| \`edgar-gmr-etl/src/etl/hatvp_matcher.py\` | Match officials to Person nodes, lobbyists to Company/Lobbyist |

## CronJob

\`\`\`yaml
schedule: "0 4 1 */3 *"  # Quarterly
command: python3 -m src.etl.load_hatvp
\`\`\`
`,
    impact: 'Directly relevant for 2027: voters check what their representatives own and who lobbies them.',
  },
  {
    id: 'campaign-finance',
    title: 'Campaign Finance (CNCCFP)',
    category: 'data-source',
    status: 'proposed',
    source: 'Commission nationale des comptes de campagne',
    sourceUrl: 'https://www.data.gouv.fr/fr/organizations/commission-nationale-des-comptes-de-campagne-et-des-financements-politiques/',
    format: 'CSV / Excel on data.gouv.fr',
    coverage: 'France (all elections)',
    effort: 'Low',
    summary: 'Campaign accounts for all French elections. Track spending patterns across cycles.',
    description: `
## Schema changes (Neo4j)

### New nodes

\`\`\`
(:Election {
    election_id,    -- "presidentielle-2022", "legislatives-2024-01"
    type,           -- "presidentielle", "legislative", "municipale", "europeenne"
    year,
    round,          -- 1 or 2
    constituency    -- nullable (for legislative/municipal)
})

(:CampaignAccount {
    account_id,
    candidate_name,
    party,
    total_receipts_eur,
    total_expenses_eur,
    status          -- "approved", "rejected", "reformed"
})
\`\`\`

### New relationships

\`\`\`
(:Person)-[:RAN_IN]->(Election)
(:CampaignAccount)-[:FOR]->(Person)
(:CampaignAccount)-[:IN]->(Election)
\`\`\`

## ETL pipeline

| File | Purpose |
|------|---------|
| \`edgar-gmr-etl/src/etl/load_campaign_finance.py\` | Download CSVs by election, parse, MERGE |

## CronJob

Not needed — campaign data is published once per election cycle. Manual trigger:

\`\`\`bash
python3 -m src.etl.load_campaign_finance --election presidentielle-2027
\`\`\`
`,
    impact: 'Foundational for 2027. "How much did candidate X spend?" becomes a one-click query.',
  },
  {
    id: 'elections',
    title: 'Election Results',
    category: 'data-source',
    status: 'proposed',
    source: 'data.gouv.fr — résultats électoraux',
    sourceUrl: 'https://www.data.gouv.fr/fr/datasets/?q=resultats+elections',
    format: 'CSV / JSON, granularity down to bureau de vote',
    coverage: 'France (all elections since 2002+)',
    effort: 'Low',
    summary: 'Election results at commune and bureau-de-vote level.',
    description: `
## Schema changes (Neo4j)

### Extends Election node

\`\`\`
(:ElectionResult {
    result_id,
    election_id,
    candidate_name,
    commune_code,   -- INSEE code
    votes,
    pct,
    elected         -- boolean
})
\`\`\`

### New relationships

\`\`\`
(:ElectionResult)-[:IN]->(Election)
(:ElectionResult)-[:FOR]->(Person)
(:ElectionResult)-[:AT]->(Commune)
\`\`\`

## Depends on

- **Campaign Finance** — shares Election nodes and Person matching

## ETL pipeline

| File | Purpose |
|------|---------|
| \`edgar-gmr-etl/src/etl/load_elections.py\` | Download CSVs, parse, MERGE results |

## Cross-references

- Candidates → Person nodes (directors, lobbyists)
- Communes → Authority nodes (municipal procurement)
- Parties → CampaignAccount linkage
`,
    impact: 'Correlate voting patterns with procurement spending, subsidies, and lobbying by constituency.',
  },
  {
    id: 'eu-funds',
    title: 'EU Funds & Grants (FTS + Cohesion)',
    category: 'data-source',
    status: 'proposed',
    source: 'EU Financial Transparency System + Cohesion Data',
    sourceUrl: 'https://ec.europa.eu/budget/financial-transparency-system/',
    format: 'CSV bulk download (FTS), JSON API (Cohesion)',
    coverage: 'EU-wide',
    effort: 'Medium',
    summary: 'All recipients of EU funds: Horizon, Erasmus, structural funds, cohesion projects.',
    description: `
## Schema changes (Neo4j)

\`\`\`cypher
CREATE CONSTRAINT grant_id IF NOT EXISTS FOR (g:Grant) REQUIRE g.grant_id IS UNIQUE
CREATE INDEX grant_programme IF NOT EXISTS FOR (g:Grant) ON (g.programme)
CREATE INDEX grant_year IF NOT EXISTS FOR (g:Grant) ON (g.year)
\`\`\`

### New nodes

\`\`\`
(:Grant {
    grant_id,       -- "FTS-2024-12345" or "ESIF-2024-67890"
    source,         -- "fts" or "esif"
    programme,      -- "Horizon Europe", "Erasmus+", "ERDF", etc.
    title,
    amount_eur,
    year,
    country
})
\`\`\`

### New relationships

\`\`\`
(:Grant)-[:AWARDED_TO]->(Company|Association)
(:Grant)-[:FUNDED_BY]->(Programme)
\`\`\`

## ETL pipeline

| File | Purpose |
|------|---------|
| \`edgar-gmr-etl/src/etl/load_eu_fts.py\` | Download FTS CSV by year, parse, MERGE Grant nodes |
| \`edgar-gmr-etl/src/etl/load_eu_cohesion.py\` | Query Cohesion JSON API, MERGE Grant nodes |
| \`edgar-gmr-etl/src/etl/grant_matcher.py\` | Match recipients to existing Company/Association nodes |

## CronJob

\`\`\`yaml
schedule: "0 3 1 */3 *"  # Quarterly
command: python3 -m src.etl.load_eu_fts --year $(date +%Y)
\`\`\`
`,
    impact: 'Completes the money map: procurement + grants = the full picture of public money flows.',
  },
  {
    id: 'subsidies',
    title: 'French Public Subsidies',
    category: 'data-source',
    status: 'proposed',
    source: 'data.gouv.fr — subventions aux associations',
    sourceUrl: 'https://www.data.gouv.fr/fr/datasets/subventions-versees-aux-associations/',
    format: 'CSV bulk download',
    coverage: 'France',
    effort: 'Low',
    summary: 'Public subsidies paid to French associations.',
    description: `
## Depends on

- **SIRENE** — for SIREN-based matching of recipients
- **Associations (RNA)** — for linking subsidies to association profiles

## Schema changes (Neo4j)

### New node

\`\`\`
(:Subsidy {
    subsidy_id,     -- hash of authority+recipient+year+amount
    amount_eur,
    purpose,
    year,
    authority_name
})
\`\`\`

### New relationships

\`\`\`
(:Authority)-[:GRANTED]->(Subsidy)
(:Subsidy)-[:RECEIVED_BY]->(Association|Company)
\`\`\`

## ETL pipeline

| File | Purpose |
|------|---------|
| \`edgar-gmr-etl/src/etl/load_fr_subsidies.py\` | Download CSV, match recipients by SIREN, MERGE |

## CronJob

\`\`\`yaml
schedule: "0 4 1 */6 *"  # Every 6 months
command: python3 -m src.etl.load_fr_subsidies
\`\`\`
`,
    impact: 'Answers "which associations receive public money, from whom, and how much?"',
  },
  {
    id: 'eu-parliament',
    title: 'EU Parliament Voting Records',
    category: 'data-source',
    status: 'proposed',
    source: 'European Parliament Open Data Portal + Parltrack',
    sourceUrl: 'https://data.europarl.europa.eu/',
    format: 'XML / JSON via Parltrack mirror',
    coverage: 'EU Parliament (all MEPs, all sessions)',
    effort: 'Medium',
    summary: 'MEP profiles, committee memberships, and roll-call votes.',
    description: `
## Schema changes (Neo4j)

### New nodes

\`\`\`
(:MEP {
    mep_id,         -- EP identifier
    person_id,      -- links to Person
    name,
    country,
    party_national,
    party_eu,       -- EPP, S&D, Renew, etc.
    term_start,
    term_end
})

(:Vote {
    vote_id,
    dossier,
    title,
    date,
    result          -- "adopted", "rejected"
})
\`\`\`

### New relationships

\`\`\`
(:Person)-[:SERVED_AS]->(MEP)
(:MEP)-[:VOTED {position: "for"|"against"|"abstain"}]->(Vote)
(:MEP)-[:MEMBER_OF {role}]->(Committee)
(:Lobbyist)-[:INTERESTS]->(Vote)  -- via legislative dossier matching
\`\`\`

## ETL pipeline

| File | Purpose |
|------|---------|
| \`edgar-gmr-etl/src/etl/load_eu_parliament.py\` | Download from Parltrack JSON, MERGE MEPs + votes |
| \`edgar-gmr-etl/src/etl/ep_matcher.py\` | Match MEPs to Person nodes, votes to lobbying interests |

## CronJob

\`\`\`yaml
schedule: "0 5 * * 0"  # Weekly Sunday 05:00 UTC
command: python3 -m src.etl.load_eu_parliament
\`\`\`
`,
    impact: 'Track MEP voting alignment with lobbying interests and party discipline.',
  },
  {
    id: 'press-subsidies',
    title: 'Press Subsidies & Media Transparency',
    category: 'data-source',
    status: 'proposed',
    source: 'data.gouv.fr — aides à la presse',
    sourceUrl: 'https://www.data.gouv.fr/fr/datasets/aides-a-la-presse/',
    format: 'CSV bulk download',
    coverage: 'France',
    effort: 'Low',
    summary: 'Public subsidies to press organizations. Cross-reference with ownership data.',
    description: `
## Schema changes (Neo4j)

### New node

\`\`\`
(:PressAid {
    aid_id,
    publication_name,
    aid_type,       -- "postal", "distribution", "pluralism", "digital"
    amount_eur,
    year
})
\`\`\`

### New relationships

\`\`\`
(:PressAid)-[:RECEIVED_BY]->(Company)  -- press companies matched via SIREN
(:Company)-[:OWNS]->(Company)          -- media ownership (community-curated)
\`\`\`

## ETL pipeline

| File | Purpose |
|------|---------|
| \`edgar-gmr-etl/src/etl/load_press_subsidies.py\` | Download CSV, match publications to Company nodes via SIREN/name |

## Media ownership gap

No authoritative machine-readable source in Europe. EurOMo (media-ownership.eu) has research data but no bulk API. **Community curation via reports** is the pragmatic path — users document ownership chains in collaborative reports.
`,
    impact: 'Critical for fighting fake news: check who owns a publication, who funds it, and what their other interests are.',
  },
  {
    id: 'beneficial-ownership',
    title: 'Beneficial Ownership',
    category: 'data-source',
    status: 'blocked',
    source: 'INPI RBE / EU AMLD6 implementation',
    sourceUrl: 'https://www.openownership.org/',
    format: 'Varies by member state',
    coverage: 'EU (restricted since CJEU 2022 ruling)',
    effort: 'High (legal barriers)',
    summary: 'Who actually owns the companies? Currently blocked by CJEU privacy ruling. Monitor AMLD6 transposition.',
    description: `
## Legal status

The CJEU ruled in November 2022 (Cases C-37/20 and C-601/20) that unrestricted public access to beneficial ownership registers violates privacy rights. Access now requires "legitimate interest."

The EU's AMLD6 package (expected transposition 2025-2027) aims to restore access with conditions.

## Prepared schema (ready when access reopens)

\`\`\`cypher
CREATE CONSTRAINT bo_id IF NOT EXISTS FOR (bo:BeneficialOwner) REQUIRE bo.bo_id IS UNIQUE
\`\`\`

\`\`\`
(:BeneficialOwner {
    bo_id,
    name,
    nationality,
    birth_year,
    person_id       -- links to Person when matched
})

(:BeneficialOwner)-[:OWNS {share_pct, direct: boolean}]->(Company)
\`\`\`

## Action items

- Monitor OpenOwnership.org for register status updates
- Pre-build ETL for UK (Companies House PSC — already open) as proof of concept
- When AMLD6 transposes: adapt per member state
`,
    impact: 'The holy grail of corporate transparency. Who actually owns the companies that receive public money?',
  },
]

export const categories = {
  insight: { label: 'Insight Tools', desc: 'Turn data into understanding' },
  'data-source': { label: 'Data Sources', desc: 'External datasets to ingest' },
  platform: { label: 'Platform', desc: 'User-facing infrastructure' },
}

export const statusColors = {
  proposed: { bg: '#dbeafe', text: '#1e40af', label: 'Proposed' },
  'in-progress': { bg: '#fef3c7', text: '#92400e', label: 'In Progress' },
  done: { bg: '#d1fae5', text: '#065f46', label: 'Done' },
  blocked: { bg: '#fee2e2', text: '#991b1b', label: 'Blocked' },
}
