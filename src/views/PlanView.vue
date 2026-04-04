<script setup>
import { ref, onMounted, nextTick } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

onMounted(() => {
  document.title = 'Implementation Plan — GMR'
  nextTick(() => {
    const hash = window.location.hash.slice(1)
    if (hash) document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' })
  })
})

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'roles', label: 'Roles & Permissions' },
  { id: 'auth', label: 'Authentication (Zitadel)' },
  { id: 'reports', label: 'Collaborative Reports' },
  { id: 'embeds', label: 'Embeddable Visualizations' },
  { id: 'sharing', label: 'Sharing & Visibility' },
  { id: 'community', label: 'Community Curation' },
  { id: 'moderation', label: 'Moderation & Bans' },
  { id: 'security-tests', label: 'Security Test Plan' },
  { id: 'functional-tests', label: 'Functional Test Plan' },
  { id: 'phases', label: 'Implementation Phases' },
  { id: 'stack', label: 'Technology Stack' },
]

const active = ref('overview')
function scrollTo(id) {
  active.value = id
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <div class="pl">
    <nav class="pl-nav">
      <div class="pl-nav__head">
        <router-link to="/admin" class="pl-back">&larr; Admin</router-link>
        <h2>Plan</h2>
      </div>
      <button
        v-for="s in sections"
        :key="s.id"
        class="pl-nav__link"
        :class="{ active: active === s.id }"
        @click="scrollTo(s.id)"
      >{{ s.label }}</button>
    </nav>

    <main class="pl-main">
      <div class="pl-header">
        <div>
          <h1>Implementation Plan</h1>
          <p class="pl-sub">Authentication, Collaborative Reports, Community Curation & Moderation</p>
        </div>
        <ThemeToggle />
      </div>

<!-- ════════════════════════════════════════════════════════════ -->
<section id="overview" class="pl-s">
<h2>1. Overview</h2>

<p>This plan covers three interconnected systems that transform GMR from a data browser into a collaborative investigation platform:</p>

<div class="pl-three">
  <div class="pl-three__item">
    <strong>Authentication & Authorization</strong>
    <p>User accounts, groups, roles, and permissions — the foundation everything else is built on.</p>
  </div>
  <div class="pl-three__item">
    <strong>Collaborative Reports</strong>
    <p>Structured documents with embedded live visualizations, team editing, and public sharing.</p>
  </div>
  <div class="pl-three__item">
    <strong>Community Curation</strong>
    <p>Issue threads on data points, moderation queue, trust levels, and ban system.</p>
  </div>
</div>

<p>The entry point for users becomes <strong>"Start a new analysis"</strong> — a button that creates a new report and drops them into the editor. From there, they explore the graph, embed visualizations, write narrative, and collaborate with others. The report is the primary artifact, not the search bar.</p>

<h3>Design principles</h3>
<ul>
  <li><strong>KISS</strong> — the simplest thing that works. Upgrade paths documented, deferred until needed.</li>
  <li><strong>Extensibility at the component level</strong> — any Vue component that can serialize its state to JSON can be embedded in a report. New widget types are a single file addition to a registry.</li>
  <li><strong>Clean separation</strong> — Neo4j holds the <em>public knowledge graph</em> (companies, contracts, authorities). PostgreSQL holds <em>application state</em> (users, reports, permissions, issues, moderation). The graph stays clean and rebuildable from sources without affecting user data. Issues reference graph entities via external IDs (<code>entity_type</code> + <code>entity_id</code>).</li>
  <li><strong>Transparency-native moderation</strong> — public moderation log. The platform practices what it preaches.</li>
  <li><strong>Migration: unrecoverable</strong> — if a widget schema version is incompatible, the embed shows "outdated visualization" with a link to recreate. KISS over migration complexity.</li>
</ul>
</section>

<!-- ════════════════════════════════════════════════════════════ -->
<section id="roles" class="pl-s">
<h2>2. Roles & Permissions</h2>

<h3>Global roles (RBAC)</h3>
<table class="pl-table">
  <thead><tr><th>Role</th><th>Can read public</th><th>Can comment</th><th>Can create reports</th><th>Can curate data</th><th>Can moderate</th><th>Can admin</th></tr></thead>
  <tbody>
    <tr><td><code>reader</code></td><td>Yes</td><td>No</td><td>No</td><td>No</td><td>No</td><td>No</td></tr>
    <tr><td><code>commenter</code></td><td>Yes</td><td>Yes</td><td>No</td><td>No</td><td>No</td><td>No</td></tr>
    <tr><td><code>contributor</code></td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes (propose)</td><td>No</td><td>No</td></tr>
    <tr><td><code>moderator</code></td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes (decide)</td><td>Yes</td><td>No</td></tr>
    <tr><td><code>admin</code></td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes (decide)</td><td>Yes</td><td>Yes</td></tr>
  </tbody>
</table>

<h3>Report-level access (relationship-based)</h3>
<table class="pl-table">
  <thead><tr><th>Access level</th><th>Can view</th><th>Can comment</th><th>Can edit</th><th>Can change visibility</th><th>Can delete</th></tr></thead>
  <tbody>
    <tr><td><code>viewer</code></td><td>Yes</td><td>No</td><td>No</td><td>No</td><td>No</td></tr>
    <tr><td><code>commenter</code></td><td>Yes</td><td>Yes</td><td>No</td><td>No</td><td>No</td></tr>
    <tr><td><code>editor</code></td><td>Yes</td><td>Yes</td><td>Yes</td><td>No</td><td>No</td></tr>
    <tr><td><code>owner</code></td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
  </tbody>
</table>

<h3>Group-level access</h3>
<p>Groups are named collections of users. A group can be granted access to a report at any level. Effective permission = max(direct, group-inherited, public).</p>

<pre class="pl-code">-- PostgreSQL permission resolution (single query)
SELECT
  EXISTS(SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'admin') AS is_admin,
  ra.level AS direct_level,
  array_agg(DISTINCT ga.level) AS group_levels,
  r.visibility AS public_level
FROM reports r
LEFT JOIN report_access ra ON ra.report_id = r.id AND ra.user_id = $1
LEFT JOIN group_members gm ON gm.user_id = $1
LEFT JOIN report_access ga ON ga.report_id = r.id AND ga.group_id = gm.group_id
WHERE r.id = $2
GROUP BY ra.level, r.visibility;</pre>

<h3>Permission hierarchy</h3>
<p><code>owner &gt; editor &gt; commenter &gt; viewer &gt; none</code></p>
<p>Resolution: take the highest level from (direct access, any group access, public default). Admin overrides everything.</p>

<h3>Why PostgreSQL, not Neo4j</h3>
<p>Neo4j is the public knowledge graph — companies, contracts, authorities. Application state (users, reports, permissions, issues, moderation) belongs in a relational database:</p>
<ul>
  <li><strong>Full ACID transactions</strong> with battle-tested isolation levels</li>
  <li><strong>Alembic migrations</strong> — schema evolution without data loss</li>
  <li><strong>SQLAlchemy</strong> — mature ORM, type safety, connection pooling</li>
  <li><strong>Row-level security</strong> — PostgreSQL can enforce access at the database level</li>
  <li><strong>Graph stays rebuildable</strong> — wipe and reload from GLEIF/TED/EDGAR without losing user data</li>
  <li><strong>Zitadel already needs PostgreSQL</strong> — share the instance, no extra ops burden</li>
</ul>
<p>Issues reference graph entities via external IDs: <code>entity_type = 'Company'</code>, <code>entity_id = '65321d3c-...'</code>. The graph API resolves these to names/labels on read.</p>

<h3>PostgreSQL schema</h3>
<pre class="pl-code">-- Users (synced from Zitadel on first login)
CREATE TABLE users (
  id UUID PRIMARY KEY,        -- from Zitadel sub claim
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  trust_level TEXT NOT NULL DEFAULT 'new_user',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Global roles
CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id),
  role TEXT NOT NULL,  -- admin, moderator, contributor, commenter, reader
  PRIMARY KEY (user_id, role)
);

-- Groups
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE group_members (
  group_id UUID REFERENCES groups(id),
  user_id UUID REFERENCES users(id),
  PRIMARY KEY (group_id, user_id)
);

-- Reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  abstract TEXT,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Report access (per-user or per-group)
CREATE TABLE report_access (
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  group_id UUID REFERENCES groups(id),
  level TEXT NOT NULL,  -- owner, editor, commenter, viewer
  CHECK (user_id IS NOT NULL OR group_id IS NOT NULL)
);

-- Sections (Tiptap JSON content)
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  sort_order INT NOT NULL,
  content_json JSONB NOT NULL DEFAULT '{}',
  lock_holder UUID REFERENCES users(id),
  lock_expires TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Section version history
CREATE TABLE section_versions (
  id BIGSERIAL PRIMARY KEY,
  section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
  content_json JSONB NOT NULL,
  saved_by UUID REFERENCES users(id),
  saved_at TIMESTAMPTZ DEFAULT now()
);

-- Issues (reference graph entities via external ID)
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body_md TEXT,
  issue_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,  -- 'Company', 'Authority', etc.
  entity_id TEXT NOT NULL,     -- gmr_id, authority_id, etc.
  status TEXT NOT NULL DEFAULT 'open',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Comments (on reports or issues)
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type TEXT NOT NULL,  -- 'report' or 'issue'
  parent_id UUID NOT NULL,
  body_md TEXT NOT NULL,
  author_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Flags and sanctions (moderation)
CREATE TABLE flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,  -- 'report', 'comment', 'issue'
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  flagged_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE sanctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL,  -- warning, mute, suspend, ban
  reason TEXT NOT NULL,
  starts_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  applied_by UUID REFERENCES users(id),
  lifted_at TIMESTAMPTZ
);</pre>
</section>

<!-- ════════════════════════════════════════════════════════════ -->
<section id="auth" class="pl-s">
<h2>3. Authentication — Zitadel</h2>

<h3>Why Zitadel</h3>
<ul>
  <li><strong>Single Go binary</strong> — smallest ops burden for a small team. One Helm chart, one deployment.</li>
  <li><strong>~256MB RAM</strong> with PostgreSQL backend (vs Keycloak's 1GB+ Java footprint).</li>
  <li><strong>OIDC-certified</strong> — standard JWT validation in FastAPI, standard OIDC flow in Vue.</li>
  <li><strong>Built-in organizations + projects</strong> — maps to our group concept.</li>
  <li><strong>FranceConnect compatible</strong> — configure as a custom OIDC upstream provider.</li>
  <li><strong>API-first (gRPC + REST)</strong> — programmatic user/group management from FastAPI.</li>
</ul>

<h3>Authentication flow</h3>
<pre class="pl-code">Browser                    Zitadel                   FastAPI
  │                          │                          │
  ├── click "Sign in" ───────►                          │
  │                          ├── OIDC authorize ──────► │
  │   ◄── redirect ─────────┤                          │
  │                          │                          │
  │── auth code callback ──► │                          │
  │                          ├── exchange for tokens ──►│
  │   ◄── id_token + ───────┤                          │
  │       access_token       │                          │
  │                          │                          │
  ├── API calls with ────────────────────────────────►  │
  │   Authorization: Bearer {access_token}              │
  │                          │       ├── validate JWT   │
  │                          │       ├── extract user_id│
  │                          │       ├── check Postgres  │
  │   ◄──────────────────────────────┤   permissions    │</pre>

<h3>Login options (in order of priority)</h3>
<ol>
  <li><strong>Email + magic link</strong> — lowest friction, no password. Zitadel supports this natively.</li>
  <li><strong>FranceConnect</strong> — for French citizens. Configured as custom OIDC provider in Zitadel.</li>
  <li><strong>EU Login (ECAS)</strong> — for EU institution users. Same pattern.</li>
  <li><strong>GitHub / Google</strong> — for developers and researchers.</li>
</ol>

<h3>FastAPI JWT middleware</h3>
<pre class="pl-code">from fastapi import Depends, HTTPException
from jose import jwt, JWTError

ZITADEL_ISSUER = "https://auth.gmr.void42.net"
ZITADEL_JWKS_URL = f"{ZITADEL_ISSUER}/.well-known/jwks.json"

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, jwks, algorithms=["RS256"],
                             issuer=ZITADEL_ISSUER)
        user_id = payload["sub"]
    except JWTError:
        raise HTTPException(401, "Invalid token")
    return await load_user_from_postgres(user_id)

async def require_role(role: str):
    def checker(user = Depends(get_current_user)):
        if role not in user.roles and "admin" not in user.roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return checker</pre>

<h3>Kubernetes deployment</h3>
<pre class="pl-code">Namespace: gmr
├── zitadel (Deployment, 1 replica, 256Mi RAM)
│   └── PostgreSQL (PVC, 5Gi) — or share existing if available
├── gmr-api (existing, add JWT validation middleware)
└── gmr-web (existing, add OIDC login flow)</pre>
</section>

<!-- ════════════════════════════════════════════════════════════ -->
<section id="reports" class="pl-s">
<h2>4. Collaborative Reports</h2>

<h3>Document model</h3>
<p>A report is an ordered list of <strong>sections</strong>. Each section is a <strong>Tiptap editor instance</strong> (ProseMirror-based rich text) that can contain <strong>widget blocks</strong> alongside regular text.</p>

<pre class="pl-code">Report
├── title, abstract, visibility, created_at, updated_at
├── Section 1: "Background"
│   └── Tiptap JSON document
│       ├── paragraph: "Metro Mondego is a..."
│       ├── widget_block: { type: "graph_explorer", config: {...} }
│       └── paragraph: "As shown above..."
├── Section 2: "Contract analysis"
│   └── Tiptap JSON document
│       ├── paragraph: "The following table..."
│       ├── widget_block: { type: "data_table", config: {...} }
│       └── paragraph: "Notice the concentration..."
└── Section 3: "Conclusions"
    └── Tiptap JSON document</pre>

<h3>Section editing</h3>
<p><strong>Section-level locking (last-write-wins)</strong> — no CRDT. When a user opens a section for editing:</p>
<ol>
  <li>Acquire lock (PostgreSQL column: <code>lock_holder</code>, <code>lock_expires</code>). TTL = 5 min, renewed by heartbeat.</li>
  <li>Other users see "Being edited by X" — can view but not edit that section.</li>
  <li>On save, section content replaces the old content. Previous version stored for history.</li>
  <li>Lock released on save or on disconnect (WebSocket heartbeat timeout).</li>
</ol>
<p><strong>Upgrade path</strong>: if real-time collab is needed later, each section becomes a Yjs document via Hocuspocus. The section boundary stays the same — clean migration.</p>

<h3>Version history</h3>
<pre class="pl-code">-- PostgreSQL: section_versions table (see schema above)
-- Each save inserts a new row. Latest 50 versions kept per section.
-- Older versions pruned by background job (DELETE WHERE saved_at &lt; ...).</pre>

<h3>Rich text editor: Tiptap</h3>
<ul>
  <li>Built on ProseMirror — industry standard for structured editing.</li>
  <li>Vue 3 support via <code>@tiptap/vue-3</code>.</li>
  <li>Custom node views for widget blocks — each widget type is a ProseMirror node with <code>atom: true</code>.</li>
  <li>Document serialized as Tiptap JSON (not HTML). Stored in PostgreSQL as JSONB.</li>
</ul>

<h3>Entry point: "Start a new analysis"</h3>
<p>The primary CTA on the landing page (for authenticated users) and in the header. Creates a blank report with one empty section and drops the user into the editor. From the editor, they can:</p>
<ul>
  <li>Write narrative text</li>
  <li>Insert a widget block (graph explorer, data table, chart, KPI card)</li>
  <li>Search for entities and embed them</li>
  <li>Add more sections</li>
  <li>Invite collaborators</li>
  <li>Set visibility</li>
</ul>
</section>

<!-- ════════════════════════════════════════════════════════════ -->
<section id="embeds" class="pl-s">
<h2>5. Embeddable Visualizations</h2>

<h3>Core principle: <code>storeState()</code> / <code>restoreFromState()</code></h3>
<p>Every embeddable component implements a contract:</p>

<pre class="pl-code">// TypeScript interface (enforced by convention, not runtime)
interface EmbeddableWidget {
  /** Widget type identifier — must match registry key */
  readonly widgetType: string

  /** Serialize current state to a JSON-safe object */
  storeState(): WidgetConfig

  /** Restore from a previously stored state */
  restoreFromState(config: WidgetConfig): void
}

interface WidgetConfig {
  schema_version: number      // integer, monotonically increasing
  widget_type: string          // discriminator → component registry
  data_binding: DataBinding    // what data to fetch
  display: Record&lt;string, any&gt; // how to render it
}</pre>

<h3>Component registry</h3>
<pre class="pl-code">// src/widgets/registry.js
import { defineAsyncComponent } from 'vue'

const registry = {
  graph_explorer:  () =&gt; import('./GraphExplorerEmbed.vue'),
  data_table:      () =&gt; import('./DataTableEmbed.vue'),
  contracts_table: () =&gt; import('./ContractsTableEmbed.vue'),
  bar_chart:       () =&gt; import('./BarChartEmbed.vue'),
  kpi_card:        () =&gt; import('./KpiCardEmbed.vue'),
  entity_profile:  () =&gt; import('./EntityProfileEmbed.vue'),
}

export function resolveWidget(type) {
  const loader = registry[type]
  return loader ? defineAsyncComponent(loader) : null
}

// Extensibility: add new widget types with one line
export function registerWidget(type, loader) {
  registry[type] = loader
}</pre>

<h3>Widget renderer (used in Tiptap node views and in report read mode)</h3>
<pre class="pl-code">&lt;!-- WidgetRenderer.vue --&gt;
&lt;template&gt;
  &lt;component
    :is="component"
    v-if="component"
    :config="config"
    @update:config="$emit('update:config', $event)"
  /&gt;
  &lt;div v-else class="widget-unsupported"&gt;
    Unsupported widget: {{ config.widget_type }}
    (schema v{{ config.schema_version }})
  &lt;/div&gt;
&lt;/template&gt;</pre>

<h3>Schema versioning: unrecoverable by design</h3>
<p>If a widget config cannot be rendered (unknown type, incompatible schema), the embed shows a placeholder: <em>"This visualization was created with an older version and cannot be displayed. Click to recreate."</em></p>
<p>No forward/backward migration machinery. KISS. If we ever need migrations, we adopt the Grafana pattern (chain of <code>v1→v2→v3</code> pure functions) — but not until then.</p>

<h3>Existing components → embeddable widgets</h3>
<table class="pl-table">
  <thead><tr><th>Existing component</th><th>Widget type</th><th>State to serialize</th></tr></thead>
  <tbody>
    <tr><td>GraphExplorer</td><td><code>graph_explorer</code></td><td>entity_id, depth, type_filters, time_range, summary, path_target, keyword</td></tr>
    <tr><td>ContractsPanel</td><td><code>contracts_table</code></td><td>entity_id, sort_key, sort_asc, limit</td></tr>
    <tr><td>SummaryPanel (D3 chart)</td><td><code>price_chart</code></td><td>ticker, period</td></tr>
    <tr><td>Fundamentals table</td><td><code>data_table</code></td><td>ticker, years, columns</td></tr>
    <tr><td>ProfilePanel</td><td><code>entity_profile</code></td><td>entity_id</td></tr>
  </tbody>
</table>

<p>Each embed wrapper component (<code>GraphExplorerEmbed.vue</code>) wraps the existing component, adds <code>storeState()</code>/<code>restoreFromState()</code>, and adapts props from the serialized config.</p>

<h3>Data freshness</h3>
<p>Embeds are <strong>live queries, not snapshots</strong>. When a report is viewed, each widget fetches current data from the API using the stored config. If new contracts were loaded since the report was written, they appear. The config defines the query, not the result.</p>
</section>

<!-- ════════════════════════════════════════════════════════════ -->
<section id="sharing" class="pl-s">
<h2>6. Sharing & Visibility</h2>

<table class="pl-table">
  <thead><tr><th>Visibility</th><th>Who can read</th><th>Who can edit</th><th>Who can comment</th></tr></thead>
  <tbody>
    <tr><td><strong>Private</strong></td><td>Owner + explicit access</td><td>Owner + editors</td><td>Owner + commenters</td></tr>
    <tr><td><strong>Group</strong></td><td>Group members + explicit</td><td>Group editors + explicit</td><td>Group commenters + explicit</td></tr>
    <tr><td><strong>Public (authenticated)</strong></td><td>Any logged-in user</td><td>Owner + explicit</td><td>Any logged-in user</td></tr>
    <tr><td><strong>Public (open)</strong></td><td>Anyone (no login)</td><td>Owner + explicit</td><td>Logged-in users only</td></tr>
  </tbody>
</table>

<h3>Sharing UI</h3>
<ul>
  <li><strong>Share button</strong> on report header → opens modal</li>
  <li><strong>Add people</strong>: search by name/email → select access level (viewer/commenter/editor)</li>
  <li><strong>Add group</strong>: search groups → select access level</li>
  <li><strong>Visibility dropdown</strong>: Private / Group / Public (authenticated) / Public (open)</li>
  <li><strong>Copy link</strong>: generates shareable URL. For private reports, link requires authentication.</li>
</ul>
</section>

<!-- ════════════════════════════════════════════════════════════ -->
<section id="community" class="pl-s">
<h2>7. Community Curation</h2>

<h3>Issues on data points</h3>
<p>Any authenticated user with <code>contributor</code> role (or higher) can raise an <strong>issue</strong> on any entity, relationship, or data point in the graph.</p>

<pre class="pl-code">-- PostgreSQL: issues table (see schema above)
-- entity_type + entity_id reference graph entities (e.g. 'Company', 'gmr-123')
-- Comments via comments table (parent_type='issue', parent_id=issue.id)
-- Votes via a separate issue_votes(issue_id, user_id, direction) table
--
-- The graph API resolves entity_id → name/label on read.
-- Graph stays clean: no application nodes in Neo4j.</pre>

<h3>Issue types</h3>
<table class="pl-table">
  <thead><tr><th>Type</th><th>Description</th><th>Example</th></tr></thead>
  <tbody>
    <tr><td><code>incorrect_data</code></td><td>A data point is wrong</td><td>"This company's country should be PRT not FRA"</td></tr>
    <tr><td><code>duplicate_entity</code></td><td>Two nodes are the same entity</td><td>"Metro Mondego S.A and Metro Mondego, S. A. are the same"</td></tr>
    <tr><td><code>missing_connection</code></td><td>A relationship exists but isn't in the graph</td><td>"Person X is also a director of Company Y"</td></tr>
    <tr><td><code>missing_entity</code></td><td>An entity should exist but doesn't</td><td>"Association Z is not in the graph"</td></tr>
    <tr><td><code>other</code></td><td>General feedback</td><td>"The contract value seems unusually high"</td></tr>
  </tbody>
</table>

<h3>Issue lifecycle</h3>
<pre class="pl-code">open ──► under_review ──► resolved (data changed)
  │          │              │
  │          └──► rejected (not actionable)
  │
  └──► closed (by author or moderator)</pre>

<h3>Discussion</h3>
<ul>
  <li>Any authenticated user can comment on an open issue.</li>
  <li>Comments support Markdown.</li>
  <li>Upvote/downvote on issues (not comments) — surfaces high-priority issues.</li>
  <li>Moderators can pin, lock (no new comments), or close issues.</li>
</ul>

<h3>Resolution</h3>
<p>Users with <code>moderator</code> or <code>admin</code> role can <strong>resolve</strong> an issue, which may trigger:</p>
<ul>
  <li><strong>Entity merge</strong> (duplicate_entity) → uses existing Entity Resolution UI</li>
  <li><strong>Property update</strong> (incorrect_data) → Neo4j graph update via API with audit trail in PostgreSQL</li>
  <li><strong>New relationship</strong> (missing_connection) → creates edge in graph</li>
  <li>All resolutions logged as <code>(:Resolution {action, before, after, resolved_by, resolved_at})</code></li>
</ul>
</section>

<!-- ════════════════════════════════════════════════════════════ -->
<section id="moderation" class="pl-s">
<h2>8. Moderation & Bans</h2>

<h3>Trust levels (auto-progression)</h3>
<table class="pl-table">
  <thead><tr><th>Level</th><th>Name</th><th>Requirements</th><th>Capabilities</th></tr></thead>
  <tbody>
    <tr><td>0</td><td><code>new_user</code></td><td>Just registered</td><td>Read public content, create private reports (for review)</td></tr>
    <tr><td>1</td><td><code>commenter</code></td><td>Email verified + 24h since registration</td><td>Comment on public reports and issues</td></tr>
    <tr><td>2</td><td><code>contributor</code></td><td>1 approved report or 5 approved comments</td><td>Create public reports, raise issues, propose data changes</td></tr>
    <tr><td>3</td><td><code>moderator</code></td><td>Manually granted by admin</td><td>Resolve issues, moderate content, warn/suspend users</td></tr>
    <tr><td>4</td><td><code>admin</code></td><td>Manually granted</td><td>Everything + user management + system config</td></tr>
  </tbody>
</table>

<h3>Content flagging</h3>
<ul>
  <li>Any authenticated user can flag a report, comment, or issue.</li>
  <li>Flag reasons: <code>inaccurate</code>, <code>spam</code>, <code>harassment</code>, <code>off_topic</code>, <code>other</code> (+ free text).</li>
  <li><strong>Auto-hide threshold</strong>: 3 unique flags → content hidden from public view, added to moderation queue.</li>
  <li>Moderators can: <strong>dismiss</strong> flags (restore content), <strong>edit</strong> content, <strong>delete</strong> content, <strong>sanction</strong> author.</li>
</ul>

<h3>User sanctions</h3>
<table class="pl-table">
  <thead><tr><th>Sanction</th><th>Effect</th><th>Duration</th><th>Who can apply</th></tr></thead>
  <tbody>
    <tr><td><code>warning</code></td><td>Message shown on next login</td><td>One-time</td><td>moderator, admin</td></tr>
    <tr><td><code>mute</code></td><td>Cannot comment or create issues (can still read and edit own reports)</td><td>1-30 days</td><td>moderator, admin</td></tr>
    <tr><td><code>suspend</code></td><td>Cannot post anything (can read public content)</td><td>1-365 days</td><td>moderator, admin</td></tr>
    <tr><td><code>ban</code></td><td>Cannot log in</td><td>Permanent (until lifted)</td><td>admin only</td></tr>
  </tbody>
</table>

<pre class="pl-code">-- PostgreSQL: sanctions table (see schema above)
-- user_id, type, reason, starts_at, expires_at, applied_by
-- All sanctions visible in public moderation log
-- Ban enforcement: auth middleware checks sanctions table on each request</pre>

<h3>Public moderation log</h3>
<p>Every moderation action (flag resolution, sanction, content removal) is logged and publicly visible at <code>/admin/moderation-log</code>. A transparency platform must be transparent about its own governance.</p>

<h3>Appeal process (v2)</h3>
<p>Deferred. At launch, appeals are handled via email to an admin. When volume requires it, add an in-app appeal form that routes to a different moderator than the one who applied the sanction.</p>
</section>

<!-- ════════════════════════════════════════════════════════════ -->
<section id="security-tests" class="pl-s">
<h2>9. Security Test Plan</h2>

<p>All security tests run in CI as part of the gate. Failures block deployment.</p>

<h3>Authentication (AUTH-SEC)</h3>
<table class="pl-table">
  <thead><tr><th>ID</th><th>Test</th><th>Method</th></tr></thead>
  <tbody>
    <tr><td>AUTH-SEC-01</td><td>Unauthenticated request to protected endpoint returns 401</td><td>pytest</td></tr>
    <tr><td>AUTH-SEC-02</td><td>Expired JWT returns 401</td><td>pytest (craft expired token)</td></tr>
    <tr><td>AUTH-SEC-03</td><td>JWT with wrong issuer returns 401</td><td>pytest (craft token with bad iss)</td></tr>
    <tr><td>AUTH-SEC-04</td><td>JWT with tampered signature returns 401</td><td>pytest (modify payload, keep sig)</td></tr>
    <tr><td>AUTH-SEC-05</td><td>JWT with wrong audience returns 401</td><td>pytest</td></tr>
  </tbody>
</table>

<h3>Authorization / privilege escalation (AUTHZ-SEC)</h3>
<table class="pl-table">
  <thead><tr><th>ID</th><th>Test</th><th>Method</th></tr></thead>
  <tbody>
    <tr><td>AUTHZ-SEC-01</td><td>Reader cannot create a report (403)</td><td>pytest</td></tr>
    <tr><td>AUTHZ-SEC-02</td><td>Viewer of report A cannot edit report A (403)</td><td>pytest</td></tr>
    <tr><td>AUTHZ-SEC-03</td><td>Editor of report A cannot change its visibility (403)</td><td>pytest</td></tr>
    <tr><td>AUTHZ-SEC-04</td><td>Editor of report A cannot delete report A (403)</td><td>pytest</td></tr>
    <tr><td>AUTHZ-SEC-05</td><td>User not in group X cannot access group X's private report (403)</td><td>pytest</td></tr>
    <tr><td>AUTHZ-SEC-06</td><td>Contributor cannot resolve issues (403)</td><td>pytest</td></tr>
    <tr><td>AUTHZ-SEC-07</td><td>Moderator cannot ban users (403) — admin only</td><td>pytest</td></tr>
    <tr><td>AUTHZ-SEC-08</td><td>Suspended user cannot create reports (403)</td><td>pytest</td></tr>
    <tr><td>AUTHZ-SEC-09</td><td>Banned user cannot authenticate (401)</td><td>pytest</td></tr>
    <tr><td>AUTHZ-SEC-10</td><td>Changing own role via API returns 403</td><td>pytest</td></tr>
    <tr><td>AUTHZ-SEC-11</td><td>IDOR: user A cannot access user B's private report by guessing ID</td><td>pytest</td></tr>
    <tr><td>AUTHZ-SEC-12</td><td>IDOR: user A cannot edit user B's profile</td><td>pytest</td></tr>
  </tbody>
</table>

<h3>Data integrity (DATA-SEC)</h3>
<table class="pl-table">
  <thead><tr><th>ID</th><th>Test</th><th>Method</th></tr></thead>
  <tbody>
    <tr><td>DATA-SEC-01</td><td>XSS in report title/body is sanitized on render</td><td>e2e (Playwright)</td></tr>
    <tr><td>DATA-SEC-02</td><td>XSS in comment body is sanitized</td><td>e2e</td></tr>
    <tr><td>DATA-SEC-03</td><td>Cypher injection in widget data_binding is prevented</td><td>pytest (parameterized queries only)</td></tr>
    <tr><td>DATA-SEC-04</td><td>Widget config with invalid JSON is rejected</td><td>pytest</td></tr>
    <tr><td>DATA-SEC-05</td><td>Report section save validates lock ownership</td><td>pytest</td></tr>
  </tbody>
</table>

<h3>Rate limiting (RATE-SEC)</h3>
<table class="pl-table">
  <thead><tr><th>ID</th><th>Test</th><th>Method</th></tr></thead>
  <tbody>
    <tr><td>RATE-SEC-01</td><td>New user creating reports beyond rate limit gets 429</td><td>pytest</td></tr>
    <tr><td>RATE-SEC-02</td><td>Flag spam (same user flagging same content) is rejected</td><td>pytest</td></tr>
  </tbody>
</table>
</section>

<!-- ════════════════════════════════════════════════════════════ -->
<section id="functional-tests" class="pl-s">
<h2>10. Functional Test Plan</h2>

<h3>Reports (RPT)</h3>
<table class="pl-table">
  <thead><tr><th>ID</th><th>Test</th><th>Layer</th></tr></thead>
  <tbody>
    <tr><td>RPT-01</td><td>Create a new report returns 201 with report_id</td><td>API</td></tr>
    <tr><td>RPT-02</td><td>Add section to report</td><td>API</td></tr>
    <tr><td>RPT-03</td><td>Edit section content (Tiptap JSON)</td><td>API</td></tr>
    <tr><td>RPT-04</td><td>Reorder sections</td><td>API</td></tr>
    <tr><td>RPT-05</td><td>Delete section</td><td>API</td></tr>
    <tr><td>RPT-06</td><td>Section lock acquired on edit</td><td>API</td></tr>
    <tr><td>RPT-07</td><td>Section lock blocks concurrent editor</td><td>API</td></tr>
    <tr><td>RPT-08</td><td>Section lock expires after timeout</td><td>API</td></tr>
    <tr><td>RPT-09</td><td>Version history records each save</td><td>API</td></tr>
    <tr><td>RPT-10</td><td>Report list shows only accessible reports</td><td>API</td></tr>
  </tbody>
</table>

<h3>Widgets (WDG)</h3>
<table class="pl-table">
  <thead><tr><th>ID</th><th>Test</th><th>Layer</th></tr></thead>
  <tbody>
    <tr><td>WDG-01</td><td>Graph explorer embed renders from stored config</td><td>vitest</td></tr>
    <tr><td>WDG-02</td><td>Data table embed fetches live data on render</td><td>vitest</td></tr>
    <tr><td>WDG-03</td><td>Unknown widget type shows fallback UI</td><td>vitest</td></tr>
    <tr><td>WDG-04</td><td>Widget config roundtrips through store/restore</td><td>vitest</td></tr>
    <tr><td>WDG-05</td><td>Widget registry resolves all registered types</td><td>vitest</td></tr>
  </tbody>
</table>

<h3>Sharing (SHR)</h3>
<table class="pl-table">
  <thead><tr><th>ID</th><th>Test</th><th>Layer</th></tr></thead>
  <tbody>
    <tr><td>SHR-01</td><td>Owner can change report visibility</td><td>API</td></tr>
    <tr><td>SHR-02</td><td>Owner can add collaborator with access level</td><td>API</td></tr>
    <tr><td>SHR-03</td><td>Owner can add group with access level</td><td>API</td></tr>
    <tr><td>SHR-04</td><td>Public report is readable without auth</td><td>API + e2e</td></tr>
    <tr><td>SHR-05</td><td>Public (authenticated) report requires login to read</td><td>API</td></tr>
  </tbody>
</table>

<h3>Community (CMY)</h3>
<table class="pl-table">
  <thead><tr><th>ID</th><th>Test</th><th>Layer</th></tr></thead>
  <tbody>
    <tr><td>CMY-01</td><td>Contributor can create issue on entity</td><td>API</td></tr>
    <tr><td>CMY-02</td><td>Users can comment on open issue</td><td>API</td></tr>
    <tr><td>CMY-03</td><td>3 flags auto-hide content</td><td>API</td></tr>
    <tr><td>CMY-04</td><td>Moderator can resolve issue</td><td>API</td></tr>
    <tr><td>CMY-05</td><td>Issue resolution creates audit trail</td><td>API</td></tr>
    <tr><td>CMY-06</td><td>Moderation log is publicly readable</td><td>API + e2e</td></tr>
    <tr><td>CMY-07</td><td>Suspended user cannot comment</td><td>API</td></tr>
    <tr><td>CMY-08</td><td>Banned user gets 401 on login</td><td>API</td></tr>
  </tbody>
</table>

<h3>E2E user journeys (E2E)</h3>
<table class="pl-table">
  <thead><tr><th>ID</th><th>Test</th><th>Layer</th></tr></thead>
  <tbody>
    <tr><td>E2E-01</td><td>Sign up → create report → add text → add graph embed → publish</td><td>Playwright</td></tr>
    <tr><td>E2E-02</td><td>Share report with collaborator → collaborator edits section</td><td>Playwright</td></tr>
    <tr><td>E2E-03</td><td>Raise issue on entity → moderator resolves → entity updated</td><td>Playwright</td></tr>
    <tr><td>E2E-04</td><td>Flag report → auto-hidden → moderator reviews</td><td>Playwright</td></tr>
  </tbody>
</table>
</section>

<!-- ════════════════════════════════════════════════════════════ -->
<section id="phases" class="pl-s">
<h2>11. Implementation Phases</h2>

<div class="pl-phase">
  <h3>Phase 1 — Authentication & User Model (2 weeks)</h3>
  <ul>
    <li>Deploy Zitadel to k8s (Helm chart, PostgreSQL)</li>
    <li>Configure OIDC: magic link, FranceConnect, GitHub</li>
    <li>FastAPI JWT middleware + user sync to PostgreSQL</li>
    <li>Vue OIDC login flow (redirect-based)</li>
    <li>User profile page, group management API</li>
    <li>Role assignment API (admin-only)</li>
    <li>Security tests: AUTH-SEC-01 through AUTH-SEC-05</li>
  </ul>
  <p class="pl-gate">Gate: all auth tests pass, login works on production, groups/roles manageable via API</p>
</div>

<div class="pl-phase">
  <h3>Phase 2 — Report CRUD + Rich Text (2 weeks)</h3>
  <ul>
    <li>Report/Section PostgreSQL schema (Alembic migration) + CRUD API</li>
    <li>Tiptap integration in Vue (basic: headings, paragraphs, lists, bold, italic, links)</li>
    <li>Section locking (acquire/release/timeout)</li>
    <li>"Start a new analysis" entry point</li>
    <li>Report list page (my reports, shared with me, public)</li>
    <li>Functional tests: RPT-01 through RPT-10</li>
  </ul>
  <p class="pl-gate">Gate: create/edit/view reports with rich text, section locking works</p>
</div>

<div class="pl-phase">
  <h3>Phase 3 — Widget Embeds (2 weeks)</h3>
  <ul>
    <li>Widget registry + WidgetRenderer component</li>
    <li>Tiptap custom node view for widget blocks</li>
    <li>"Insert visualization" button in editor toolbar</li>
    <li>Graph explorer embed (storeState/restoreFromState)</li>
    <li>Data table embed, contracts table embed</li>
    <li>Widget tests: WDG-01 through WDG-05</li>
  </ul>
  <p class="pl-gate">Gate: embed graph + table in report, renders live data on view</p>
</div>

<div class="pl-phase">
  <h3>Phase 4 — Sharing & Permissions (1-2 weeks)</h3>
  <ul>
    <li>Permission resolution in FastAPI (RBAC + ReBAC query)</li>
    <li>Sharing modal in Vue (add people, add groups, visibility)</li>
    <li>Public report rendering (no login required for open reports)</li>
    <li>Security tests: AUTHZ-SEC-01 through AUTHZ-SEC-12</li>
    <li>Sharing tests: SHR-01 through SHR-05</li>
  </ul>
  <p class="pl-gate">Gate: all permission tests pass, sharing works end-to-end</p>
</div>

<div class="pl-phase">
  <h3>Phase 5 — Community Curation (2 weeks)</h3>
  <ul>
    <li>Issue CRUD API + discussion (comments)</li>
    <li>Issue UI: raise, discuss, vote</li>
    <li>Moderation queue + resolution workflow</li>
    <li>Content flagging + auto-hide</li>
    <li>Community tests: CMY-01 through CMY-08</li>
  </ul>
  <p class="pl-gate">Gate: raise issue → discuss → resolve, flagging + auto-hide works</p>
</div>

<div class="pl-phase">
  <h3>Phase 6 — Moderation & Trust (1-2 weeks)</h3>
  <ul>
    <li>Trust level auto-progression</li>
    <li>Sanction system (warn, mute, suspend, ban)</li>
    <li>Public moderation log</li>
    <li>Ban enforcement in auth middleware</li>
    <li>E2E tests: E2E-01 through E2E-04</li>
    <li>Security tests: DATA-SEC-01 through DATA-SEC-05, RATE-SEC-01 through RATE-SEC-02</li>
  </ul>
  <p class="pl-gate">Gate: full moderation workflow, all security tests pass, deployed to production</p>
</div>

<p><strong>Total estimated effort: 10-12 weeks</strong> for a 2-person team working full-time. Phases are sequential — each builds on the previous. Each phase ends with a gate (tests pass, deployed, reviewed).</p>
</section>

<!-- ════════════════════════════════════════════════════════════ -->
<section id="stack" class="pl-s">
<h2>12. Technology Stack</h2>

<table class="pl-table">
  <thead><tr><th>Layer</th><th>Choice</th><th>Why</th></tr></thead>
  <tbody>
    <tr><td>Identity provider</td><td><strong>Zitadel</strong></td><td>Single Go binary, ~256MB RAM, OIDC-certified, API-first, FranceConnect-ready</td></tr>
    <tr><td>Application DB</td><td><strong>PostgreSQL</strong></td><td>Users, reports, permissions, issues, moderation — ACID, Alembic migrations, SQLAlchemy ORM. Shared instance with Zitadel.</td></tr>
    <tr><td>Knowledge graph</td><td><strong>Neo4j (existing)</strong></td><td>Public data only — companies, contracts, authorities, directors. Rebuildable from sources.</td></tr>
    <tr><td>Permissions</td><td><strong>PostgreSQL (RBAC + per-report access)</strong></td><td>Single SQL query resolves global role + direct access + group access. No extra service.</td></tr>
    <tr><td>Rich text editor</td><td><strong>Tiptap (ProseMirror)</strong></td><td>Industry standard, Vue 3 support, custom node views for widget blocks</td></tr>
    <tr><td>Collaboration</td><td><strong>Section-level locking (LWW)</strong></td><td>No CRDT overhead. Upgrade to Yjs per-section later if needed</td></tr>
    <tr><td>Widget embedding</td><td><strong>Vue component registry + typed JSON config</strong></td><td>Extensible (one file per widget type), serializable, lazy-loaded</td></tr>
    <tr><td>Schema versioning</td><td><strong>Unrecoverable by design</strong></td><td>KISS — show fallback placeholder for incompatible versions</td></tr>
    <tr><td>Moderation</td><td><strong>3-tier trust + flag queue + public log</strong></td><td>Minimum viable, transparency-native, auto-hide on N flags</td></tr>
    <tr><td>Testing</td><td><strong>pytest (security + API) + vitest (widgets) + Playwright (E2E)</strong></td><td>Consistent with existing test infrastructure</td></tr>
  </tbody>
</table>

<h3>Deployment additions to k8s</h3>
<pre class="pl-code">Namespace: gmr
├── postgresql (new, 1 replica, 256Mi, PVC 10Gi)
│   ├── DB: zitadel  (Zitadel's internal state)
│   └── DB: gmr_app  (users, reports, issues, permissions, moderation)
├── zitadel (new, 1 replica, 256Mi, uses postgresql)
├── gmr-api (existing, add auth middleware + report/issue routers + SQLAlchemy)
├── gmr-web (existing, add Tiptap + auth flow + widget registry)
└── neo4j (existing, unchanged — public knowledge graph only)</pre>
</section>

    </main>
  </div>
</template>

<style scoped>
.pl { display: flex; min-height: 100vh; }

.pl-nav { width: 220px; flex-shrink: 0; padding: 1.5rem 0.75rem; border-right: 1px solid var(--border); background: var(--surface); position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.pl-nav__head { margin-bottom: 1rem; padding: 0 0.5rem; }
.pl-nav__head h2 { font-size: 1rem; font-weight: 700; margin-top: 0.25rem; }
.pl-back { font-size: 0.78rem; color: var(--accent); text-decoration: none; }
.pl-nav__link { display: block; width: 100%; padding: 5px 8px; font-size: 0.75rem; color: var(--muted); background: transparent; border: none; cursor: pointer; text-align: left; border-radius: 3px; line-height: 1.3; margin-bottom: 1px; }
.pl-nav__link:hover { color: var(--text); background: var(--bg); }
.pl-nav__link.active { color: var(--accent); font-weight: 600; }

.pl-main { flex: 1; max-width: 820px; padding: 1.5rem 2rem 4rem; }
.pl-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
.pl-header h1 { font-size: 1.4rem; font-weight: 800; }
.pl-sub { font-size: 0.82rem; color: var(--muted); margin-top: 0.2rem; }

.pl-s { margin-bottom: 3rem; }
.pl-s h2 { font-size: 1.15rem; font-weight: 700; margin-bottom: 0.75rem; padding-bottom: 0.3rem; border-bottom: 2px solid var(--accent); }
.pl-s h3 { font-size: 0.95rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
.pl-s p { font-size: 0.84rem; line-height: 1.6; margin-bottom: 0.6rem; }
.pl-s ul, .pl-s ol { font-size: 0.84rem; line-height: 1.6; padding-left: 1.25rem; margin-bottom: 0.6rem; }
.pl-s li { margin-bottom: 0.25rem; }

.pl-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; margin: 0.5rem 0 1rem; }
.pl-table th { background: var(--surface); text-align: left; padding: 5px 8px; border: 1px solid var(--border); font-weight: 600; }
.pl-table td { padding: 4px 8px; border: 1px solid var(--border); vertical-align: top; }
.pl-table code { font-size: 0.85em; background: var(--bg); padding: 1px 3px; border-radius: 2px; }

.pl-code { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 10px 14px; overflow-x: auto; font-size: 0.76rem; line-height: 1.5; margin: 0.5rem 0 1rem; font-family: 'SFMono-Regular', Consolas, monospace; white-space: pre; }

.pl-three { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0.75rem 0; }
.pl-three__item { padding: 10px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); }
.pl-three__item strong { font-size: 0.85rem; display: block; margin-bottom: 4px; }
.pl-three__item p { font-size: 0.78rem; color: var(--muted); margin: 0; }

.pl-phase { padding: 1rem; border: 1px solid var(--border); border-radius: 6px; margin: 0.75rem 0; background: var(--surface); }
.pl-phase h3 { margin-top: 0; }
.pl-gate { font-size: 0.78rem; font-weight: 600; color: var(--accent); padding: 6px 10px; background: var(--bg); border-radius: 4px; border-left: 3px solid var(--accent); margin-top: 0.5rem; }

@media (max-width: 768px) {
  .pl { flex-direction: column; }
  .pl-nav { width: 100%; height: auto; position: static; border-right: none; border-bottom: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 2px; padding: 0.75rem; }
  .pl-nav__head { width: 100%; }
  .pl-main { padding: 1rem; }
  .pl-three { grid-template-columns: 1fr; }
}
</style>
