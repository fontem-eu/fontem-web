/**
 * Roadmap feature definitions — shared between the index and detail pages.
 *
 * Categories:
 *   data-source  — external datasets to ingest
 *   insight       — tools that turn data into understanding
 *   platform      — user-facing infrastructure (auth, collaboration)
 */

export const features = [
  // ── Insight tools (data → understanding) ──────────────────

  {
    id: 'collaborative-reports',
    title: 'Collaborative Reports',
    category: 'insight',
    status: 'proposed',
    effort: 'High',
    source: 'Internal',
    sourceUrl: null,
    format: 'Web UI + API + Neo4j storage',
    coverage: 'All loaded entities',
    summary:
      'Wikipedia-style collaborative investigations built on live graph data. ' +
      'Authenticated users create, share, and co-edit structured reports ' +
      'with embedded visualizations that stay connected to the underlying graph.',
    description: `
## The problem

Data without narrative is noise. A journalist discovers that Company X received €50M in public contracts while its director also sits on the board of the awarding authority — but there's no way to document this finding, share it with colleagues, or build on it over time. The insight dies in a browser tab.

## What collaborative reports are

A **report** is a structured document that combines:

- **Narrative text** — the human-written analysis, context, and conclusions
- **Embedded graph snapshots** — saved views from the graph explorer (entity, depth, filters, highlighted paths) that render live data, not static screenshots
- **Data tables** — query results (e.g. "all contracts between Authority X and Company Y, sorted by date") that update when the underlying data changes
- **Annotations** — user-added notes on specific entities or relationships ("this director resigned 2 days after the contract was awarded")

## Collaboration model

Each report has a **visibility level**:

| Level | Who can read | Who can edit | Use case |
|-------|-------------|-------------|----------|
| **Private** | Author only | Author only | Work in progress, personal research |
| **Team** | Named collaborators | Named collaborators | Newsroom investigation, research group |
| **Public (read-only)** | Anyone | Author + collaborators | Published investigation, reference report |
| **Public (commentable)** | Anyone | Author + collaborators (comments: anyone) | Community-reviewed investigation |

## Report structure

\`\`\`
Report
├── Title + abstract
├── Author(s) + creation/update dates
├── Visibility level
├── Sections (ordered)
│   ├── Section 1: "Background"
│   │   ├── Text block (Markdown)
│   │   └── Graph embed: Company X at depth 2
│   ├── Section 2: "The contract trail"
│   │   ├── Text block
│   │   ├── Data table: contracts between Auth Y → Company X
│   │   └── Graph embed: path from Director Z to Auth Y
│   └── Section 3: "Conclusions"
│       └── Text block
├── Comments (if commentable)
└── Revision history
\`\`\`

## Data model (Neo4j)

\`\`\`
(:User {user_id, email, name, role})
(:Report {report_id, title, abstract, visibility, created_at, updated_at})
(:Section {section_id, order, type, content_md, query_cypher, graph_state_json})
(:Comment {comment_id, body, created_at})

(User)-[:AUTHORED]->(Report)
(User)-[:COLLABORATES_ON]->(Report)
(Report)-[:HAS_SECTION]->(Section)
(Section)-[:REFERENCES]->(Company|Authority|Person|Contract)
(User)-[:COMMENTED {at}]->(Report)
(Comment)-[:ON]->(Report)
\`\`\`

## Embedded graph snapshots

A graph embed stores the full state needed to re-render a graph explorer view:

\`\`\`json
{
  "center_id": "gmr-123",
  "depth": 2,
  "type_filters": ["Company", "Authority"],
  "time_range": "3y",
  "summary_edges": true,
  "highlighted_path": { "from": "per-456", "to": "auth-789" },
  "locked_nodes": ["gmr-123"],
  "annotation": "Notice how the same 3 companies appear in all contracts"
}
\`\`\`

When a reader opens the report, each embed renders a live Cytoscape graph using the saved state. If the underlying data has changed (new contracts loaded), the graph reflects the current state — the embed is a query, not a screenshot.

## Embedded data tables

A data table embed stores a parameterized query:

\`\`\`json
{
  "type": "contracts",
  "params": { "authority_id": "auth-789", "company_gmr_id": "gmr-123" },
  "columns": ["date", "title", "value_eur", "cpv"],
  "sort": { "key": "value_eur", "desc": true },
  "caption": "Contracts awarded by Ville de Paris to Acme Corp"
}
\`\`\`

The frontend fetches the data via the existing API and renders it inline. The table is always current.

## Authentication

Reports require user accounts. Lightweight authentication options:

1. **Email + magic link** — no password, lowest friction
2. **OAuth** (France Connect, EU Login, GitHub) — for institutional users
3. **Anonymous read** — public reports are readable without login

Roles:
- **Reader** — can view public reports, leave comments
- **Contributor** — can create reports, collaborate on others' reports
- **Moderator** — can flag/hide reports, manage community

## Implementation phases

| Phase | Scope | Effort |
|-------|-------|--------|
| 1. Auth + basic reports | User accounts (magic link), create/edit private reports with Markdown sections, save/load from Neo4j | 2-3 weeks |
| 2. Graph embeds | Embed saved graph explorer states in sections, live rendering in report view | 1-2 weeks |
| 3. Data table embeds | Parameterized API queries rendered as tables inside sections | 1 week |
| 4. Collaboration | Invite collaborators by email, team visibility level, concurrent editing (last-write-wins for v1) | 2 weeks |
| 5. Public + comments | Public visibility, comment threads, moderation queue | 1-2 weeks |
| 6. Revision history | Track section-level changes, diff view, restore previous versions | 1 week |

## Example use case: "Who profits from Metro Mondego?"

1. Journalist searches "Metro Mondego" → sees Authority with 51 contracts, €699M total
2. Opens graph explorer → sees 9 supplier companies, notices 2 share the same director
3. Clicks "New Report" → creates "Metro Mondego procurement analysis"
4. Adds graph embed showing the Authority at depth 2 with CLIENT_OF edges
5. Adds data table of the top 10 contracts by value
6. Writes narrative connecting the shared director to the two winning companies
7. Shares report as "Public (commentable)" before the elections
8. Citizens and other journalists comment, suggest leads, verify facts
`,
    impact:
      'Transforms the platform from a data browser into an investigative workspace. ' +
      'The report becomes a citeable, verifiable artifact — the fact-checker\'s equivalent of a scientific paper.',
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
## The problem

With 3.6M companies and 779K contracts, no human can manually scan for irregularities. We need the graph to surface what's unusual.

## Proposed red-flag patterns

Each pattern is a Cypher query that returns entities matching a structural signature:

### 1. Revolving door
A person who directed a public authority also directs a company that won contracts from that authority.

\`\`\`
MATCH (p:Person)-[:DIRECTS]->(a:Authority)
MATCH (p)-[:DIRECTS]->(c:Company)
MATCH (a)-[:CLIENT_OF]->(c)
RETURN p, a, c
\`\`\`

### 2. Contract concentration
An authority awards >50% of its total spend to a single company.

### 3. Shell-like entities
Companies with no employees, no financial data, no website, but winning large public contracts.

### 4. Bid-splitting
Multiple small contracts just below the threshold that would trigger a public tender, awarded to the same company by the same authority within a short period.

### 5. Cross-border director networks
Same person directing companies in 3+ countries that all supply to the same authority.

## Output

A dashboard showing flagged entities with:
- The pattern that triggered the flag
- The specific entities and relationships involved
- A "severity" score (number of patterns matched, contract values involved)
- One-click navigation to the graph explorer centered on the flagged entity
- One-click "Start report" to document the finding

## Important caveat

Red flags are **not accusations**. A flag means "this structure is statistically unusual and warrants human review." The dashboard must clearly communicate this.
`,
    impact:
      'Turns passive data into active leads. Investigative journalists get a prioritized list of structures worth examining instead of searching blindly.',
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
      'Users "watch" entities they care about and receive alerts when new data appears: ' +
      'new contracts, new directors, new corporate group changes, new lobbying activities.',
    description: `
## Concept

A researcher investigating a specific company or authority shouldn't have to check the platform daily. Instead, they add entities to a personal watchlist, and the platform notifies them when something changes.

## What triggers an alert

- New contract awarded to/by the watched entity
- New director appointed or resigned
- New subsidiary added to the corporate group
- Entity appears in a newly loaded lobbying declaration
- Entity flagged by anomaly detection

## Alert channels

1. **In-app notification** — bell icon with unread count
2. **Email digest** — daily or weekly summary of changes across all watched entities
3. **Webhook** (for power users / newsrooms) — push notifications to Slack, custom integrations

## Implementation

Each alert is a lightweight Neo4j node:

\`\`\`
(:Watch {user_id, entity_id, entity_type, created_at})
(:Alert {alert_id, type, entity_id, details_json, created_at, read: false})
(User)-[:WATCHES]->(Company|Authority|Person)
(Alert)-[:ABOUT]->(Company|Authority|Person)
\`\`\`

A background job runs after each ETL load, compares the new state to the previous state, and generates alerts for watched entities.
`,
    impact:
      'Keeps investigators in the loop without requiring daily visits. When a watched company wins a new contract 2 weeks before an election, the journalist knows immediately.',
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
## Concept

The graph already contains the answers. The barrier is knowing Cypher. Natural language queries bridge this gap by translating human questions into structured graph queries.

## Architecture

\`\`\`
User question (text)
    → LLM (Claude API) with graph schema context
    → Cypher query
    → Neo4j execution
    → Result formatting
    → Answer with citations (entity links, graph embeds)
\`\`\`

The LLM receives the Neo4j schema (node labels, relationship types, key properties) as context and generates a Cypher query. The platform executes it, formats the result, and returns an answer grounded in real data.

## Safety

- The LLM generates **read-only** Cypher (no MERGE, CREATE, DELETE)
- A query validator rejects any write operations before execution
- Results always link back to source entities (clickable)
- The generated Cypher is shown to the user for transparency

## Example queries

| Question | Generated Cypher (simplified) |
|----------|------------------------------|
| "Who are the top 5 suppliers to Ville de Paris?" | \`MATCH (a:Authority {name: 'Ville de Paris'})-[:CLIENT_OF]->(c) RETURN c ORDER BY r.total_eur DESC LIMIT 5\` |
| "How is Jean Dupont connected to Metro Mondego?" | \`shortestPath between Person and Authority\` |
| "Which companies won contracts in both France and Germany?" | \`MATCH (c)-[:SUPPLIER_OF]->(:Authority {country: 'FRA'}) MATCH (c)-[:SUPPLIER_OF]->(:Authority {country: 'DEU'}) RETURN c\` |
`,
    impact:
      'Removes the last barrier between citizens and public data. The interested voter who doesn\'t know what Cypher is can still ask "did company X get public money?"',
  },
  {
    id: 'entity-dashboards',
    title: 'Entity Dashboards',
    category: 'insight',
    status: 'proposed',
    effort: 'Medium',
    source: 'Internal',
    sourceUrl: null,
    format: 'Web UI',
    coverage: 'All loaded entities',
    summary:
      'Rich summary pages for every entity type — not just companies, but authorities, persons, ' +
      'and associations — with key metrics, timelines, and relationship summaries.',
    description: `
## Current state

The company profile page exists but is basic. Authorities, persons, and associations have no dedicated profile at all.

## Proposed dashboards

### Authority dashboard
- Total spend (by year, by sector)
- Top 10 suppliers (by total EUR)
- Contract concentration score (% of spend going to top 3 suppliers)
- Geographic reach (which countries do its suppliers come from?)
- Director overlap with suppliers (red flag indicator)
- Timeline of contracts

### Person dashboard
- All current and past roles (companies, authorities, associations)
- Timeline of role changes
- Companies directed that received public money (total EUR)
- Network visualization: the person at center, all connected entities

### Association dashboard (when RNA loaded)
- Purpose, creation date, location
- Subsidies received (when loaded)
- Board members and their other affiliations
- Similar associations in the same sector/region
`,
    impact:
      'Makes every entity a starting point for investigation. A researcher hearing a name in the news can look it up and get a complete picture in seconds.',
  },

  // ── Data sources ──────────────────────────────────────────

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
      'Load 1.5M French associations into the graph. Cross-reference leaders with company directors and elected officials.',
    description: `
## Data source

The RNA (Répertoire National des Associations) contains all French associations declared under the loi 1901. Published as a CSV on data.gouv.fr, updated regularly.

## Data model

\`\`\`
(:Association {rna_id, name, purpose, address, department, creation_date, dissolution_date})
(Person)-[:LEADS]->(Association)
(Association)-[:LOCATED_IN]->(Commune)
\`\`\`

## Cross-references

- JOAFE (Journal Officiel des Associations) provides board member names → link to existing Person nodes
- SIRENE SIREN numbers → link associations that also have a business registration
- Subsidies data → link to Grant/Subsidy nodes when that data is loaded

## Size: ~1.5M associations, ~300MB CSV
`,
    impact: 'Makes the civil society visible. Citizens discover local associations; journalists trace conflict-of-interest networks.',
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
    summary: 'EU-level lobbying data: who is lobbying for what, how much they spend, and which EP access passes they hold.',
    description: `
## Data source

The EU Transparency Register contains ~13K organizations that lobby EU institutions. Bulk XML download updated regularly.

## Key fields

- Organization name, type, country
- Lobbying costs (annual range)
- EP access passes (named individuals)
- Legislative interests (which dossiers they follow)
- EU grants received

## Data model

\`\`\`
(:Lobbyist {tr_id, name, country, type, annual_costs_min, annual_costs_max})
(Lobbyist)-[:REPRESENTS]->(Company|Association)
(Lobbyist)-[:HAS_EP_PASS {person_name}]->(:EUInstitution)
(Lobbyist)-[:INTERESTS]->(LegislativeDossier)
\`\`\`
`,
    impact: 'Answers "who is lobbying for what?" Cross-reference with procurement data to check if lobbying correlates with contracts.',
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
    summary: 'French lobbying register + asset declarations of public officials. The link between money and politics.',
    description: `
## Two datasets

1. **Répertoire des représentants d'intérêts** — French lobbying register (~2K entities)
2. **Declarations of assets and interests** — Ministers, MPs, mayors, senior officials (~15K declarations)

## Data model

\`\`\`
(Person)-[:DECLARED {year}]->(AssetDeclaration {real_estate, securities, income, debts})
(Lobbyist)-[:LOBBIES]->(Person)  // official being lobbied
(Lobbyist)-[:REPRESENTS]->(Company|Association)
\`\`\`

## Cross-references

- Officials → link to existing Person nodes (directors, election candidates)
- Lobbyists → link to Company nodes (GLEIF/SIRENE match)
- Asset values → track evolution over time (is an official getting richer?)
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
## Data

Campaign accounts for presidential, legislative, municipal, regional, and European elections. Published by the CNCCFP on data.gouv.fr.

## Key fields

- Candidate name, party, constituency
- Total receipts and expenses
- Breakdown by category (advertising, travel, staff, events)
- Accepted/rejected status

## Data model

\`\`\`
(:Candidate {name, party})-[:RAN_IN]->(Election {type, year, constituency})
(:CampaignAccount {total_receipts, total_expenses, status})-[:FOR]->(Candidate)
\`\`\`
`,
    impact: 'Foundational for 2027 fact-checking. "How much did candidate X spend?" becomes a one-click query.',
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
    summary: 'Election results at commune and bureau-de-vote level. The electoral backbone.',
    description: `
## Data

Vote counts by bureau de vote, commune, department, region — candidate names, party affiliation, turnout, blank/null ballots. All French elections since 2002+.

## Cross-references

- Candidates → link to Person nodes (directors, lobbyists)
- Communes → link to Authority nodes (municipal procurement)
- Parties → link to campaign finance data
`,
    impact: 'Correlate voting patterns with procurement spending, subsidies, and lobbying activity by constituency.',
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
## Two sources

1. **EU Financial Transparency System (FTS)** — all Commission-managed funds. CSV bulk download by year.
2. **ESIF Open Data (Cohesion)** — structural and investment funds with regional granularity. JSON API.

## Data model

\`\`\`
(:Grant {grant_id, programme, amount_eur, year})
(Grant)-[:AWARDED_TO]->(Company|Association)
(Grant)-[:FUNDED_BY]->(Programme {name: "Horizon Europe"})
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
    summary: 'Public subsidies paid to French associations: amount, recipient, purpose, granting authority.',
    description: `
## Cross-references

- Recipients → link to Association nodes (RNA match)
- Granting authorities → link to Authority nodes
- Purpose → categorize by sector for aggregation
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
    format: 'XML / RDF / CSV / SPARQL endpoint',
    coverage: 'EU Parliament (all MEPs, all sessions)',
    effort: 'Medium',
    summary: 'MEP profiles, committee memberships, and roll-call votes. Cross-reference with lobbying register.',
    description: `
## Data

Roll-call votes by MEP, plenary session results, committee votes, parliamentary questions. Parltrack.org offers a clean JSON mirror.

## Cross-references

- MEPs → link to Person nodes
- Votes on specific dossiers → link to Lobbyist interests (who lobbied on this topic?)
- MEP country → link to national election results
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
## Data

Direct public aid to press organizations: amounts by publication, aid type (postal, distribution, pluralism).

## Media ownership gap

Media ownership data has no authoritative machine-readable source in Europe. EurOMo (media-ownership.eu) has research data but no bulk API. Community curation (via Collaborative Reports) is the pragmatic path.
`,
    impact: 'Critical for fighting fake news: check who owns a publication, who funds it, and what their other interests are.',
  },
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
    summary: 'Complete French business registry with SIREN/SIRET, addresses, and sector codes.',
    description: `
## Data

All French enterprises and establishments: SIREN/SIRET numbers, addresses, NAF sector codes, legal form, creation dates, employee count ranges.

## Why it matters

SIREN is the common key across French data sources. Subsidies, associations, tax data, social security data — all reference SIREN. Loading SIRENE makes entity matching across all French sources precise instead of fuzzy.
`,
    impact: 'The authoritative French entity backbone. Enables address-based geographic analysis and precise cross-source matching.',
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

The CJEU ruled in November 2022 (Cases C-37/20 and C-601/20) that unrestricted public access to beneficial ownership registers violates the right to privacy. Access now requires demonstrating "legitimate interest."

The EU's new AML package (AMLD6, expected transposition 2025-2027) aims to restore access with conditions. OpenOwnership.org tracks which registers are open.

## When it reopens

Design the data model now so we're ready:

\`\`\`
(:BeneficialOwner {name, nationality, birth_year})
(BeneficialOwner)-[:OWNS {share_pct, direct}]->(Company)
\`\`\`
`,
    impact: 'The holy grail of corporate transparency. Who actually owns the companies that receive public money?',
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
    summary: 'Structured API for common transparency questions. Designed for newsroom integration.',
    description: `
## Concept

A high-level API layer above the raw graph that answers common fact-check patterns:

- \`GET /factcheck/money/{entity_id}\` — all public money received (contracts + subsidies + grants)
- \`GET /factcheck/connections/{entity_a}/{entity_b}\` — all paths connecting two entities
- \`GET /factcheck/network/{person_id}\` — all entities connected to a person (companies, authorities, associations)
- \`GET /factcheck/red-flags/{entity_id}\` — all anomaly patterns involving this entity

## Output format

Each response includes:
- The answer (structured data)
- Source citations (which dataset, when loaded)
- Confidence level (direct match vs. fuzzy)
- One-click links to explore in the graph
`,
    impact: 'A single API that answers transparency questions combining 10+ sources. Embeddable in newsroom workflows.',
  },
  {
    id: 'community',
    title: 'Community Curation',
    category: 'platform',
    status: 'proposed',
    effort: 'High',
    source: 'Internal — user-generated',
    sourceUrl: null,
    format: 'Web UI + API',
    coverage: 'All entities',
    summary: 'Community-driven data curation: flag errors, suggest merges, curate media ownership.',
    description: `
## Concept

Allow authenticated users to:
- **Flag incorrect data** — "this company name is misspelled"
- **Suggest entity merges** — "these two entries are the same company"
- **Add missing connections** — "this person also directs this association"
- **Curate media ownership** — the one area where no structured open data exists

A moderation queue ensures quality. Trusted contributors get higher privileges over time (similar to Wikipedia's autoconfirmed user system).

## Depends on

- User authentication (from Collaborative Reports feature)
- Entity Resolution UI (already built)
`,
    impact: 'Scales data curation beyond what any single team can maintain. The community becomes the source of truth for hard-to-automate data.',
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
