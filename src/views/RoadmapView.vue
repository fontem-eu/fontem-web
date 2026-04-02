<script setup>
import { ref, onMounted, nextTick } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

onMounted(() => {
  document.title = 'Mission & Roadmap — GMR'
  // Scroll to hash if present
  nextTick(() => {
    const hash = window.location.hash.slice(1)
    if (hash) {
      const el = document.getElementById(hash)
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }
  })
})

const features = [
  {
    id: 'associations',
    title: 'French Associations (RNA)',
    status: 'proposed',
    source: 'Répertoire National des Associations — data.gouv.fr',
    sourceUrl: 'https://www.data.gouv.fr/fr/datasets/repertoire-national-des-associations/',
    format: 'CSV bulk download, ~1.5M associations',
    coverage: 'France',
    effort: 'Low',
    description:
      'Load all 1.5 million French associations (loi 1901) into the graph as Association nodes. ' +
      'Link to directors via the JOAFE (Journal Officiel des Associations) announcements. ' +
      'Cross-reference association leaders with company directors and elected officials to surface ' +
      'connections between civil society, business, and politics.',
    impact:
      'Makes the civil society visible for the first time in a connected knowledge graph. ' +
      'Citizens can discover local associations, journalists can trace conflict-of-interest networks.',
  },
  {
    id: 'lobbying-eu',
    title: 'EU Lobbying Register',
    status: 'proposed',
    source: 'EU Transparency Register — European Commission',
    sourceUrl: 'https://ec.europa.eu/transparencyregister/public/opendata',
    format: 'XML bulk download + REST API (JSON)',
    coverage: 'EU-wide (~13K registered entities)',
    effort: 'Low',
    description:
      'Load the EU Transparency Register into the graph. Creates Lobbyist nodes linked to the companies ' +
      'and associations they represent. Includes: lobbying costs, EP access passes, legislative interests, ' +
      'EU grants received.',
    impact:
      'Answers "who is lobbying for what?" at the EU level. ' +
      'Cross-referencing lobbyists with our existing procurement and corporate data surfaces patterns: ' +
      'are the same companies that lobby the EU also winning public contracts?',
  },
  {
    id: 'lobbying-fr',
    title: 'French Lobbying & Asset Declarations (HATVP)',
    status: 'proposed',
    source: 'Haute Autorité pour la transparence de la vie publique',
    sourceUrl: 'https://www.hatvp.fr/open-data/',
    format: 'JSON / CSV on data.gouv.fr',
    coverage: 'France (~15K declarations, ~2K lobbyists)',
    effort: 'Low',
    description:
      'Load two datasets: (1) the répertoire des représentants d\'intérêts (French national lobbying register) ' +
      'and (2) asset and interest declarations of French public officials. ' +
      'Creates Person → Lobbies → Company relationships and Official → Declares → Asset edges.',
    impact:
      'Directly relevant for 2027: voters can check what their representatives own, who lobbies them, ' +
      'and how those interests align with their votes. The missing link between money and politics in France.',
  },
  {
    id: 'campaign-finance',
    title: 'Campaign Finance (CNCCFP)',
    status: 'proposed',
    source: 'Commission nationale des comptes de campagne',
    sourceUrl: 'https://www.data.gouv.fr/fr/organizations/commission-nationale-des-comptes-de-campagne-et-des-financements-politiques/',
    format: 'CSV / Excel on data.gouv.fr',
    coverage: 'France (all elections)',
    effort: 'Low',
    description:
      'Load campaign accounts for presidential, legislative, municipal, regional, and European elections. ' +
      'Creates Candidate nodes linked to their campaign spending, party affiliation, and election results. ' +
      'Track spending patterns across election cycles.',
    impact:
      'Foundational for 2027 election fact-checking. "How much did candidate X spend?" and ' +
      '"How does this compare to previous cycles?" become one-click queries.',
  },
  {
    id: 'elections',
    title: 'Election Results',
    status: 'proposed',
    source: 'data.gouv.fr — résultats électoraux',
    sourceUrl: 'https://www.data.gouv.fr/fr/datasets/?q=resultats+elections',
    format: 'CSV / JSON, granularity down to bureau de vote',
    coverage: 'France (all elections since 2002+)',
    effort: 'Low',
    description:
      'Load election results at the commune and bureau-de-vote level for all French elections. ' +
      'Create ElectionResult nodes linked to Candidate, Commune, and Department nodes. ' +
      'Enables geographic correlation with procurement spending, subsidies, and lobbying.',
    impact:
      'The electoral backbone: "which communes voted for X, and how much public money did they receive?" ' +
      'Journalists and researchers can explore the relationship between public spending and voting patterns.',
  },
  {
    id: 'eu-funds',
    title: 'EU Funds & Grants (FTS + Cohesion)',
    status: 'proposed',
    source: 'EU Financial Transparency System + Cohesion Data',
    sourceUrl: 'https://ec.europa.eu/budget/financial-transparency-system/',
    format: 'CSV bulk download (FTS), JSON API (Cohesion)',
    coverage: 'EU-wide',
    effort: 'Medium',
    description:
      'Load all recipients of EU funds: Horizon grants, Erasmus, structural funds, cohesion projects. ' +
      'Two sources: FTS for Commission-managed funds and the ESIF Open Data platform for structural funds. ' +
      'Creates Grant nodes linked to recipient Company/Association and the funding programme.',
    impact:
      'Completes the money map: procurement shows who sells to the government, FTS/Cohesion shows who ' +
      'receives grants. Combined, they reveal the full picture of public money flows.',
  },
  {
    id: 'subsidies',
    title: 'French Public Subsidies to Associations',
    status: 'proposed',
    source: 'data.gouv.fr — subventions aux associations',
    sourceUrl: 'https://www.data.gouv.fr/fr/datasets/subventions-versees-aux-associations/',
    format: 'CSV bulk download',
    coverage: 'France',
    effort: 'Low',
    description:
      'Load all public subsidies paid to French associations: amount, recipient, purpose, granting authority. ' +
      'Cross-reference with RNA association data and with procurement authorities.',
    impact:
      'Answers "which associations receive public money, from whom, and how much?" ' +
      'Combined with the lobbying register, surfaces potential conflicts of interest.',
  },
  {
    id: 'eu-parliament',
    title: 'EU Parliament Voting Records',
    status: 'proposed',
    source: 'European Parliament Open Data Portal + Parltrack',
    sourceUrl: 'https://data.europarl.europa.eu/',
    format: 'XML / RDF / CSV / SPARQL endpoint',
    coverage: 'EU Parliament (all MEPs, all sessions)',
    effort: 'Medium',
    description:
      'Load MEP profiles, committee memberships, and roll-call votes. ' +
      'Cross-reference with the EU Transparency Register (who lobbied the MEP?) and FTS (did their constituency benefit?). ' +
      'Parltrack.org offers a clean JSON mirror of EP data.',
    impact:
      'Makes MEP voting records searchable in context: "MEP X voted against climate regulation — ' +
      'who lobbied them on this topic, and which companies in their constituency would benefit?"',
  },
  {
    id: 'press-subsidies',
    title: 'Press Subsidies & Media Transparency',
    status: 'proposed',
    source: 'data.gouv.fr — aides à la presse',
    sourceUrl: 'https://www.data.gouv.fr/fr/datasets/aides-a-la-presse/',
    format: 'CSV bulk download',
    coverage: 'France',
    effort: 'Low',
    description:
      'Load public subsidies to press organizations. Cross-reference with company ownership data (who owns the media outlet?) ' +
      'and with lobbying registers (does the owner also lobby?). ' +
      'Media ownership itself is poorly structured — EurOMo (media-ownership.eu) has research data but no bulk API. ' +
      'We can start with press subsidies and curate ownership manually as a community effort.',
    impact:
      'Critical for fighting fake news: when a media outlet publishes something, citizens can check ' +
      '"who owns this publication, who funds it, and what are their other interests?"',
  },
  {
    id: 'sirene',
    title: 'SIRENE (French Business Registry)',
    status: 'proposed',
    source: 'INSEE — Base SIRENE',
    sourceUrl: 'https://www.data.gouv.fr/fr/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret/',
    format: 'CSV bulk download (monthly), ~12M establishments',
    coverage: 'France',
    effort: 'Medium',
    description:
      'Load the full SIRENE database: all French enterprises and establishments with SIREN/SIRET numbers, ' +
      'addresses, NAF sector codes, legal form, creation dates. ' +
      'This becomes the authoritative French entity backbone, richer than GLEIF for domestic entities.',
    impact:
      'Enables address-based geographic analysis, sector-level aggregation, and precise entity matching ' +
      'across all French data sources (subsidies, associations, tax data all reference SIREN).',
  },
  {
    id: 'beneficial-ownership',
    title: 'Beneficial Ownership (when accessible)',
    status: 'blocked',
    source: 'INPI RBE / EU AMLD6 implementation',
    sourceUrl: 'https://www.openownership.org/',
    format: 'Varies by member state',
    coverage: 'EU (legally mandated but access restricted since CJEU 2022 ruling)',
    effort: 'High (legal barriers)',
    description:
      'The CJEU ruled in November 2022 that unrestricted public access to beneficial ownership registers violates ' +
      'privacy rights (Cases C-37/20 and C-601/20). Access now requires "legitimate interest." ' +
      'The new EU AML package (AMLD6, expected transposition 2025-2027) aims to restore access with conditions. ' +
      'Monitor this closely — when it reopens, loading UBO data into the graph would complete the ownership chain.',
    impact:
      'The holy grail of corporate transparency: who actually owns the companies that receive public money? ' +
      'Currently blocked by legal constraints but likely to reopen. Design the data model now.',
  },
  {
    id: 'factcheck-api',
    title: 'Fact-Check Query API',
    status: 'proposed',
    source: 'Internal — built on existing graph data',
    sourceUrl: null,
    format: 'REST API',
    coverage: 'All loaded entities',
    effort: 'Medium',
    description:
      'Build a high-level API that answers structured fact-check queries: ' +
      '"What public money has entity X received?" (contracts + subsidies + grants), ' +
      '"What are the connections between person A and company B?" (path finding), ' +
      '"Who are the suppliers of authority X?" (CLIENT_OF/SUPPLIER_OF). ' +
      'Designed for journalists and fact-checkers to quickly verify claims during election season.',
    impact:
      'The platform\'s public-facing value proposition: a single API that answers transparency questions ' +
      'combining data from 10+ sources. Could be embedded in newsroom workflows.',
  },
  {
    id: 'community',
    title: 'Community Curation & Reporting',
    status: 'proposed',
    source: 'Internal — user-generated',
    sourceUrl: null,
    format: 'Web UI + API',
    coverage: 'All entities',
    effort: 'High',
    description:
      'Allow authenticated users to flag incorrect data, suggest entity merges, report missing connections, ' +
      'and curate media ownership data. A moderation queue ensures quality. ' +
      'Think Wikipedia-style collaborative editing but for structured entity data.',
    impact:
      'Scales beyond what any single team can maintain. The community becomes the source of truth for ' +
      'hard-to-automate data like media ownership and political affiliations.',
  },
]

const statusColors = {
  proposed: { bg: '#dbeafe', text: '#1e40af' },
  'in-progress': { bg: '#fef3c7', text: '#92400e' },
  done: { bg: '#d1fae5', text: '#065f46' },
  blocked: { bg: '#fee2e2', text: '#991b1b' },
}

const activeSection = ref('mission')

function scrollTo(id) {
  activeSection.value = id
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <div class="rm">
    <!-- Sidebar nav -->
    <nav class="rm-nav">
      <div class="rm-nav__header">
        <router-link to="/admin" class="rm-back">&larr; Admin</router-link>
        <h2>Roadmap</h2>
      </div>

      <div class="rm-nav__section">
        <button class="rm-nav__link" :class="{ active: activeSection === 'mission' }" @click="scrollTo('mission')">
          Mission
        </button>
        <button class="rm-nav__link" :class="{ active: activeSection === 'vision' }" @click="scrollTo('vision')">
          Vision
        </button>
      </div>

      <div class="rm-nav__divider"></div>
      <div class="rm-nav__label">Proposed Features</div>

      <div class="rm-nav__section">
        <button
          v-for="f in features"
          :key="f.id"
          class="rm-nav__link"
          :class="{ active: activeSection === f.id }"
          @click="scrollTo(f.id)"
        >
          <span
            class="rm-nav__dot"
            :style="{ background: statusColors[f.status]?.bg }"
          ></span>
          {{ f.title }}
        </button>
      </div>
    </nav>

    <!-- Main content -->
    <main class="rm-main">
      <div class="rm-header">
        <h1>Mission, Vision & Roadmap</h1>
        <ThemeToggle />
      </div>

      <!-- ═══ MISSION ════════════════════════════════════ -->
      <section id="mission" class="rm-section">
        <h2>Mission</h2>
        <div class="rm-card rm-card--accent">
          <p class="rm-lead">
            Strengthen democracy, justice, and community by making public information
            truly public — connected, searchable, and understandable by every citizen.
          </p>
        </div>

        <p>
          Public money flows through a complex web of companies, authorities, associations, and
          individuals. This information is technically public but practically invisible: scattered
          across dozens of government databases in incompatible formats, buried in PDFs, and accessible
          only to those who know exactly where to look.
        </p>
        <p>
          We build the connective tissue between these datasets. When a citizen reads that
          a company won a public contract, they should be able to see — in one click — who owns
          that company, who its directors are, what other contracts it has won, which elected
          officials are connected to it, and whether the same people lobby for favorable regulation.
        </p>
        <p>
          We don't take sides. We surface facts. The graph speaks for itself.
        </p>
      </section>

      <!-- ═══ VISION ═════════════════════════════════════ -->
      <section id="vision" class="rm-section">
        <h2>Vision</h2>
        <div class="rm-card rm-card--accent">
          <p class="rm-lead">
            Become the reference platform for verifying claims about public money,
            corporate influence, and political connections in the European Union —
            starting with France and the 2027 elections.
          </p>
        </div>

        <h3>Why now</h3>
        <p>
          Disinformation is accelerating. The 2027 French presidential and legislative elections
          will be fought in an information environment shaped by AI-generated content, social media
          amplification, and declining trust in institutions. Voters need tools to distinguish
          signal from noise — not opinion, but verifiable structural facts.
        </p>

        <h3>The gap we fill</h3>
        <p>
          Existing fact-checking organizations (AFP, Le Monde's Les Décodeurs) do excellent work
          on individual claims. What's missing is the underlying infrastructure: a connected knowledge
          graph that lets anyone explore the relationships between public entities, follow the money,
          and verify structural claims like "company X is linked to politician Y."
        </p>

        <h3>Concentric circles</h3>
        <div class="rm-circles">
          <div class="rm-circle">
            <div class="rm-circle__num">1</div>
            <div>
              <strong>France 2027</strong> — Full coverage of French companies, associations, elected officials,
              procurement, lobbying, campaign finance, and election results. The reference for the upcoming elections.
            </div>
          </div>
          <div class="rm-circle">
            <div class="rm-circle__num">2</div>
            <div>
              <strong>EU institutions</strong> — EU Parliament votes, EU lobbying register, EU funds,
              cross-border corporate groups. The Brussels dimension.
            </div>
          </div>
          <div class="rm-circle">
            <div class="rm-circle__num">3</div>
            <div>
              <strong>EU member states</strong> — Replicate the French model in other member states.
              The data sources differ but the graph model is universal.
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ FEATURES ═══════════════════════════════════ -->
      <section class="rm-section">
        <h2>Roadmap</h2>
        <p class="rm-section__sub">
          Each proposed feature represents a new data source or capability.
          Ordered roughly by impact-to-effort ratio for the France 2027 timeline.
        </p>

        <div
          v-for="f in features"
          :id="f.id"
          :key="f.id"
          class="rm-feature"
        >
          <div class="rm-feature__header">
            <h3>{{ f.title }}</h3>
            <span
              class="rm-status"
              :style="{
                background: statusColors[f.status]?.bg,
                color: statusColors[f.status]?.text,
              }"
            >
              {{ f.status }}
            </span>
          </div>

          <p>{{ f.description }}</p>

          <div class="rm-feature__meta">
            <div v-if="f.source" class="rm-meta-row">
              <span class="rm-meta-label">Source</span>
              <a v-if="f.sourceUrl" :href="f.sourceUrl" target="_blank" rel="noopener">
                {{ f.source }}
              </a>
              <span v-else>{{ f.source }}</span>
            </div>
            <div v-if="f.format" class="rm-meta-row">
              <span class="rm-meta-label">Format</span>
              <span>{{ f.format }}</span>
            </div>
            <div v-if="f.coverage" class="rm-meta-row">
              <span class="rm-meta-label">Coverage</span>
              <span>{{ f.coverage }}</span>
            </div>
            <div v-if="f.effort" class="rm-meta-row">
              <span class="rm-meta-label">Effort</span>
              <span>{{ f.effort }}</span>
            </div>
          </div>

          <div class="rm-impact">
            <strong>Impact:</strong> {{ f.impact }}
          </div>
        </div>
      </section>

      <!-- ═══ DATA MODEL ═════════════════════════════════ -->
      <section class="rm-section">
        <h2>Where we are today</h2>
        <div class="rm-stats">
          <div class="rm-stat"><div class="rm-stat__val">3.6M+</div><div class="rm-stat__lbl">Companies</div></div>
          <div class="rm-stat"><div class="rm-stat__val">779K</div><div class="rm-stat__lbl">Contracts</div></div>
          <div class="rm-stat"><div class="rm-stat__val">251K</div><div class="rm-stat__lbl">Corporate Links</div></div>
          <div class="rm-stat"><div class="rm-stat__val">71K</div><div class="rm-stat__lbl">Authorities</div></div>
          <div class="rm-stat"><div class="rm-stat__val">735K</div><div class="rm-stat__lbl">Trade Edges</div></div>
          <div class="rm-stat"><div class="rm-stat__val">27</div><div class="rm-stat__lbl">EU Countries</div></div>
        </div>
        <p>
          Sources loaded: GLEIF (global company + corporate group data), SEC EDGAR (US financials),
          ESMA ESEF (EU financials), TED (EU procurement since 2023), French directors (RNE).
          The graph explorer, path finding, and entity resolution are operational.
        </p>
      </section>
    </main>
  </div>
</template>

<style scoped>
.rm {
  display: flex;
  min-height: 100vh;
}

/* ── Sidebar ────────────────────────────── */
.rm-nav {
  width: 260px;
  flex-shrink: 0;
  padding: 1.5rem 1rem;
  border-right: 1px solid var(--border);
  background: var(--surface);
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.rm-nav__header {
  margin-bottom: 1.25rem;
}

.rm-nav__header h2 {
  font-size: 1.1rem;
  font-weight: 700;
  margin-top: 0.3rem;
}

.rm-back {
  font-size: 0.8rem;
  color: var(--accent);
  text-decoration: none;
}

.rm-nav__section {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.rm-nav__link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  font-size: 0.78rem;
  color: var(--muted);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  border-radius: 4px;
  line-height: 1.3;
}

.rm-nav__link:hover {
  color: var(--text);
  background: var(--bg);
}

.rm-nav__link.active {
  color: var(--accent);
  font-weight: 600;
}

.rm-nav__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.rm-nav__divider {
  height: 1px;
  background: var(--border);
  margin: 0.75rem 0;
}

.rm-nav__label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-weight: 600;
  padding: 0 8px;
  margin-bottom: 4px;
}

/* ── Main content ───────────────────────── */
.rm-main {
  flex: 1;
  max-width: 780px;
  padding: 1.5rem 2rem 4rem;
}

.rm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

.rm-header h1 {
  font-size: 1.5rem;
  font-weight: 800;
}

.rm-section {
  margin-bottom: 3rem;
}

.rm-section h2 {
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 1rem;
  padding-bottom: 0.4rem;
  border-bottom: 2px solid var(--accent);
  display: inline-block;
}

.rm-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 1.25rem 0 0.5rem;
}

.rm-section p {
  font-size: 0.88rem;
  line-height: 1.65;
  color: var(--text);
  margin-bottom: 0.75rem;
}

.rm-section__sub {
  color: var(--muted);
  font-size: 0.85rem;
  margin-bottom: 1.5rem;
}

/* Cards */
.rm-card {
  padding: 1.25rem 1.5rem;
  border-radius: 6px;
  margin-bottom: 1.25rem;
  border: 1px solid var(--border);
}

.rm-card--accent {
  border-left: 4px solid var(--accent);
  background: var(--surface);
}

.rm-lead {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.5;
  color: var(--text);
  margin: 0;
}

/* Circles */
.rm-circles {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 1rem 0;
}

.rm-circle {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  font-size: 0.85rem;
  line-height: 1.5;
}

.rm-circle__num {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.8rem;
}

/* ── Feature cards ──────────────────────── */
.rm-feature {
  padding: 1.25rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  margin-bottom: 1.25rem;
  background: var(--surface);
}

.rm-feature__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 0.75rem;
}

.rm-feature__header h3 {
  font-size: 0.95rem;
  font-weight: 700;
  margin: 0;
}

.rm-status {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.rm-feature p {
  font-size: 0.84rem;
  line-height: 1.6;
  color: var(--text);
  margin-bottom: 0.75rem;
}

.rm-feature__meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 16px;
  font-size: 0.78rem;
  margin-bottom: 0.75rem;
}

.rm-meta-row {
  display: flex;
  gap: 6px;
}

.rm-meta-label {
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
}

.rm-meta-row a {
  color: var(--accent);
  text-decoration: none;
}

.rm-meta-row a:hover {
  text-decoration: underline;
}

.rm-impact {
  font-size: 0.82rem;
  line-height: 1.5;
  padding: 8px 12px;
  background: var(--bg);
  border-radius: 4px;
  border-left: 3px solid var(--accent);
}

/* ── Stats ──────────────────────────────── */
.rm-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 1rem;
}

.rm-stat {
  text-align: center;
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  min-width: 80px;
}

.rm-stat__val {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--accent);
}

.rm-stat__lbl {
  font-size: 0.65rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* ── Mobile ─────────────────────────────── */
@media (max-width: 768px) {
  .rm { flex-direction: column; }
  .rm-nav {
    width: 100%;
    height: auto;
    position: static;
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding: 1rem;
  }
  .rm-nav__section { flex-direction: row; flex-wrap: wrap; gap: 4px; }
  .rm-main { padding: 1rem; }
  .rm-feature__meta { grid-template-columns: 1fr; }
}
</style>
