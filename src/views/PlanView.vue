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
  { id: 'repos', label: 'Repo Separation' },
  { id: 'layers', label: 'Layered Architecture' },
  { id: 'interfaces', label: 'Repository Interfaces' },
  { id: 'services', label: 'Service Layer' },
  { id: 'api-surface', label: 'REST API Surface' },
  { id: 'auth', label: 'Authentication (Zitadel)' },
  { id: 'roles', label: 'Roles & Permissions' },
  { id: 'reports', label: 'Reports & Embeds' },
  { id: 'community', label: 'Community & Issues' },
  { id: 'moderation', label: 'Moderation & Bans' },
  { id: 'unit-tests', label: 'Unit Test Plan' },
  { id: 'security-tests', label: 'Security Test Plan' },
  { id: 'e2e-tests', label: 'E2E Test Plan' },
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
          <p class="pl-sub">gmr-community-api — Auth, Reports, Community, Moderation</p>
        </div>
        <ThemeToggle />
      </div>

<!-- ═══════════════════════════════════════════════════════════ -->
<section id="overview" class="pl-s">
<h2>1. Overview</h2>
<p>A new microservice — <code>gmr-community-api</code> — that handles all user-facing collaboration features. Separate repo, separate database (PostgreSQL), separate deployment. The existing <code>edgar-gmr-etl</code> API stays focused on public data serving from Neo4j.</p>

<div class="pl-three">
  <div class="pl-three__item">
    <strong>gmr-community-api</strong>
    <p>New repo. FastAPI + PostgreSQL. Auth, reports, issues, moderation.</p>
  </div>
  <div class="pl-three__item">
    <strong>edgar-gmr-etl</strong>
    <p>Existing. FastAPI + Neo4j. Public data: companies, contracts, graph.</p>
  </div>
  <div class="pl-three__item">
    <strong>gmr-web</strong>
    <p>Existing. Vue 3 SPA. Consumes both APIs.</p>
  </div>
</div>

<h3>Design principles</h3>
<ul>
  <li><strong>Clean separation</strong> — Neo4j = public knowledge graph (rebuildable from sources). PostgreSQL = application state (users, reports, issues). Never mixed.</li>
  <li><strong>Hexagonal architecture</strong> — Repository interfaces (ABCs) define data access. Two implementations: PostgreSQL for production, in-memory dict for unit tests. Business logic never touches SQL.</li>
  <li><strong>Sub-millisecond unit tests</strong> — InMemory repositories mean 0 I/O in unit tests. No database, no network. Hundreds of tests in under a second.</li>
  <li><strong>Extensibility at the Vue component level</strong> — any component that implements <code>storeState()</code> / <code>restoreFromState()</code> can be embedded in a report.</li>
  <li><strong>Widget schema: unrecoverable</strong> — if a saved widget config is incompatible, show a placeholder. No migration machinery. KISS.</li>
</ul>
</section>

<!-- ═══════════════════════════════════════════════════════════ -->
<section id="repos" class="pl-s">
<h2>2. Repo Separation</h2>

<pre class="pl-code">gmr-community-api/              # NEW REPO
├── src/
│   ├── api/                    # FastAPI routers (REST layer)
│   │   ├── app.py
│   │   ├── auth.py             # JWT middleware, current_user
│   │   ├── routers/
│   │   │   ├── reports.py
│   │   │   ├── issues.py
│   │   │   ├── users.py
│   │   │   ├── groups.py
│   │   │   └── moderation.py
│   │   └── schemas/            # Pydantic request/response models
│   ├── services/               # Business logic layer
│   │   ├── report_service.py
│   │   ├── issue_service.py
│   │   ├── permission_service.py
│   │   └── moderation_service.py
│   ├── repositories/           # Data access interfaces (ABCs)
│   │   ├── base.py
│   │   ├── user_repository.py
│   │   ├── report_repository.py
│   │   ├── issue_repository.py
│   │   ├── group_repository.py
│   │   └── moderation_repository.py
│   ├── infra/                  # Implementations
│   │   ├── postgres/           # Real PostgreSQL implementations
│   │   │   ├── pg_user_repo.py
│   │   │   ├── pg_report_repo.py
│   │   │   ├── pg_issue_repo.py
│   │   │   └── ...
│   │   └── memory/             # In-memory implementations (tests)
│   │       ├── mem_user_repo.py
│   │       ├── mem_report_repo.py
│   │       ├── mem_issue_repo.py
│   │       └── ...
│   └── domain/                 # Domain models (dataclasses)
│       ├── user.py
│       ├── report.py
│       ├── issue.py
│       └── moderation.py
├── tests/
│   ├── unit/                   # Fast: InMemory repos, no I/O
│   ├── integration/            # Slow: real PostgreSQL
│   └── conftest.py
├── migrations/                 # Alembic
├── Dockerfile
├── makefile
└── requirements.txt</pre>

<h3>How the three repos interact</h3>
<pre class="pl-code">┌──────────────────────────────────────────────────────────────┐
│  gmr-web (Vue 3 SPA)                                        │
│  ├── /api/*    → nginx proxy → edgar-gmr-etl (graph data)   │
│  └── /capi/*   → nginx proxy → gmr-community-api (app data) │
└──────────────────────────────────────────────────────────────┘

gmr-community-api (PostgreSQL)
  │
  ├── stores: users, reports, sections, issues, permissions,
  │           comments, flags, sanctions
  │
  └── calls: edgar-gmr-etl API when it needs entity names
             (e.g. issue about Company → GET /api/graph/{id}?depth=0
              to get the entity's display name and type)

edgar-gmr-etl (Neo4j) — unchanged
  │
  └── serves: companies, contracts, graph traversal, path finding</pre>
</section>

<!-- ═══════════════════════════════════════════════════════════ -->
<section id="layers" class="pl-s">
<h2>3. Layered Architecture</h2>

<pre class="pl-code">┌───────────────────────────────────────────────────────────┐
│  REST Layer (src/api/routers/)                            │
│  - Input validation (Pydantic schemas)                    │
│  - Authentication (JWT → current_user)                    │
│  - Calls service methods                                  │
│  - Serializes responses                                   │
│  - NO business logic here                                 │
├───────────────────────────────────────────────────────────┤
│  Service Layer (src/services/)                            │
│  - All business logic                                     │
│  - Permission checks                                      │
│  - Section locking rules                                  │
│  - Trust level progression                                │
│  - Flag auto-hide thresholds                              │
│  - Calls repositories via ABCs (never SQL)                │
├───────────────────────────────────────────────────────────┤
│  Repository Layer (src/repositories/ = ABCs)              │
│  - Pure interfaces (abstract methods)                     │
│  - Define what data operations exist                      │
│  - Two implementations:                                   │
│    ├── src/infra/postgres/ (production)                   │
│    └── src/infra/memory/   (unit tests)                   │
├───────────────────────────────────────────────────────────┤
│  Domain Layer (src/domain/)                               │
│  - Dataclasses: User, Report, Section, Issue, Sanction    │
│  - No dependencies on anything else                       │
│  - Shared by all layers                                   │
└───────────────────────────────────────────────────────────┘</pre>

<h3>Dependency injection</h3>
<pre class="pl-code"># src/api/dependencies.py
from src.repositories.report_repository import ReportRepository
from src.services.report_service import ReportService

_report_repo: ReportRepository | None = None
_report_service: ReportService | None = None

def get_report_service() -&gt; ReportService:
    global _report_repo, _report_service
    if _report_service is None:
        from src.infra.postgres.pg_report_repo import PgReportRepository
        _report_repo = PgReportRepository(get_db_pool())
        _report_service = ReportService(_report_repo)
    return _report_service

# In tests: override with InMemory implementation
# app.dependency_overrides[get_report_service] = lambda: ReportService(InMemoryReportRepo())</pre>
</section>

<!-- ═══════════════════════════════════════════════════════════ -->
<section id="interfaces" class="pl-s">
<h2>4. Repository Interfaces</h2>
<p>Each ABC defines the contract. Services depend on these, never on concrete implementations.</p>

<h3>UserRepository</h3>
<pre class="pl-code">from abc import ABC, abstractmethod
from src.domain.user import User

class UserRepository(ABC):
    @abstractmethod
    async def get_by_id(self, user_id: str) -&gt; User | None: ...

    @abstractmethod
    async def get_by_email(self, email: str) -&gt; User | None: ...

    @abstractmethod
    async def upsert(self, user: User) -&gt; User: ...

    @abstractmethod
    async def get_roles(self, user_id: str) -&gt; list[str]: ...

    @abstractmethod
    async def set_roles(self, user_id: str, roles: list[str]) -&gt; None: ...

    @abstractmethod
    async def get_trust_level(self, user_id: str) -&gt; str: ...

    @abstractmethod
    async def set_trust_level(self, user_id: str, level: str) -&gt; None: ...

    @abstractmethod
    async def get_active_sanction(self, user_id: str) -&gt; Sanction | None: ...</pre>

<h3>ReportRepository</h3>
<pre class="pl-code">class ReportRepository(ABC):
    @abstractmethod
    async def create(self, report: Report) -&gt; Report: ...

    @abstractmethod
    async def get_by_id(self, report_id: str) -&gt; Report | None: ...

    @abstractmethod
    async def update(self, report: Report) -&gt; Report: ...

    @abstractmethod
    async def delete(self, report_id: str) -&gt; None: ...

    @abstractmethod
    async def list_for_user(self, user_id: str, limit: int, offset: int) -&gt; list[Report]: ...

    @abstractmethod
    async def list_public(self, limit: int, offset: int) -&gt; list[Report]: ...

    # ── Sections ──
    @abstractmethod
    async def add_section(self, report_id: str, section: Section) -&gt; Section: ...

    @abstractmethod
    async def update_section(self, section: Section) -&gt; Section: ...

    @abstractmethod
    async def delete_section(self, section_id: str) -&gt; None: ...

    @abstractmethod
    async def get_section(self, section_id: str) -&gt; Section | None: ...

    @abstractmethod
    async def get_sections(self, report_id: str) -&gt; list[Section]: ...

    # ── Locking ──
    @abstractmethod
    async def acquire_lock(self, section_id: str, user_id: str, ttl_seconds: int) -&gt; bool: ...

    @abstractmethod
    async def release_lock(self, section_id: str, user_id: str) -&gt; None: ...

    @abstractmethod
    async def get_lock_holder(self, section_id: str) -&gt; str | None: ...

    # ── Versions ──
    @abstractmethod
    async def save_version(self, section_id: str, content: dict, user_id: str) -&gt; None: ...

    @abstractmethod
    async def get_versions(self, section_id: str, limit: int) -&gt; list[SectionVersion]: ...</pre>

<h3>PermissionRepository</h3>
<pre class="pl-code">class PermissionRepository(ABC):
    @abstractmethod
    async def get_report_access(self, user_id: str, report_id: str) -&gt; str | None:
        """Return highest access level (owner/editor/commenter/viewer/None)."""
        ...

    @abstractmethod
    async def set_user_access(self, report_id: str, user_id: str, level: str) -&gt; None: ...

    @abstractmethod
    async def set_group_access(self, report_id: str, group_id: str, level: str) -&gt; None: ...

    @abstractmethod
    async def remove_access(self, report_id: str, user_id: str | None, group_id: str | None) -&gt; None: ...

    @abstractmethod
    async def list_collaborators(self, report_id: str) -&gt; list[dict]: ...</pre>

<h3>IssueRepository</h3>
<pre class="pl-code">class IssueRepository(ABC):
    @abstractmethod
    async def create(self, issue: Issue) -&gt; Issue: ...

    @abstractmethod
    async def get_by_id(self, issue_id: str) -&gt; Issue | None: ...

    @abstractmethod
    async def update_status(self, issue_id: str, status: str) -&gt; None: ...

    @abstractmethod
    async def list_for_entity(self, entity_type: str, entity_id: str,
                              limit: int, offset: int) -&gt; list[Issue]: ...

    @abstractmethod
    async def list_open(self, limit: int, offset: int) -&gt; list[Issue]: ...

    @abstractmethod
    async def add_comment(self, issue_id: str, comment: Comment) -&gt; Comment: ...

    @abstractmethod
    async def get_comments(self, issue_id: str) -&gt; list[Comment]: ...

    @abstractmethod
    async def vote(self, issue_id: str, user_id: str, direction: str) -&gt; None: ...</pre>

<h3>ModerationRepository</h3>
<pre class="pl-code">class ModerationRepository(ABC):
    @abstractmethod
    async def add_flag(self, flag: Flag) -&gt; Flag: ...

    @abstractmethod
    async def count_flags(self, target_type: str, target_id: str) -&gt; int: ...

    @abstractmethod
    async def list_flagged(self, limit: int) -&gt; list[dict]: ...

    @abstractmethod
    async def resolve_flag(self, flag_id: str, action: str, moderator_id: str) -&gt; None: ...

    @abstractmethod
    async def add_sanction(self, sanction: Sanction) -&gt; Sanction: ...

    @abstractmethod
    async def get_active_sanction(self, user_id: str) -&gt; Sanction | None: ...

    @abstractmethod
    async def lift_sanction(self, sanction_id: str) -&gt; None: ...

    @abstractmethod
    async def get_moderation_log(self, limit: int, offset: int) -&gt; list[dict]: ...</pre>

<h3>GroupRepository</h3>
<pre class="pl-code">class GroupRepository(ABC):
    @abstractmethod
    async def create(self, group: Group) -&gt; Group: ...

    @abstractmethod
    async def get_by_id(self, group_id: str) -&gt; Group | None: ...

    @abstractmethod
    async def add_member(self, group_id: str, user_id: str) -&gt; None: ...

    @abstractmethod
    async def remove_member(self, group_id: str, user_id: str) -&gt; None: ...

    @abstractmethod
    async def get_members(self, group_id: str) -&gt; list[User]: ...

    @abstractmethod
    async def get_user_groups(self, user_id: str) -&gt; list[Group]: ...</pre>
</section>

<!-- ═══════════════════════════════════════════════════════════ -->
<section id="services" class="pl-s">
<h2>5. Service Layer</h2>
<p>Services contain all business logic. They receive repository ABCs via constructor injection.</p>

<h3>PermissionService</h3>
<pre class="pl-code">class PermissionService:
    LEVEL_HIERARCHY = ['viewer', 'commenter', 'editor', 'owner']

    def __init__(self, perms: PermissionRepository,
                 users: UserRepository, groups: GroupRepository):
        self._perms = perms
        self._users = users
        self._groups = groups

    async def check(self, user_id: str, report_id: str, required: str) -&gt; bool:
        """Can this user perform an action requiring `required` level?"""
        roles = await self._users.get_roles(user_id)
        if 'admin' in roles:
            return True

        # Check sanctions
        sanction = await self._users.get_active_sanction(user_id)
        if sanction and sanction.type in ('suspend', 'ban'):
            return False

        access = await self._perms.get_report_access(user_id, report_id)
        if access and self._gte(access, required):
            return True

        return False

    def _gte(self, have: str, need: str) -&gt; bool:
        return self.LEVEL_HIERARCHY.index(have) &gt;= self.LEVEL_HIERARCHY.index(need)</pre>

<h3>ReportService</h3>
<pre class="pl-code">class ReportService:
    def __init__(self, reports: ReportRepository,
                 perms: PermissionService):
        self._reports = reports
        self._perms = perms

    async def create(self, user_id: str, title: str) -&gt; Report:
        report = Report(title=title, created_by=user_id)
        report = await self._reports.create(report)
        await self._perms.set_user_access(report.id, user_id, 'owner')
        return report

    async def edit_section(self, user_id: str, section_id: str, content: dict):
        section = await self._reports.get_section(section_id)
        if not await self._perms.check(user_id, section.report_id, 'editor'):
            raise PermissionDenied()
        lock_holder = await self._reports.get_lock_holder(section_id)
        if lock_holder and lock_holder != user_id:
            raise SectionLocked(lock_holder)
        await self._reports.save_version(section_id, section.content_json, user_id)
        section.content_json = content
        await self._reports.update_section(section)</pre>

<h3>ModerationService</h3>
<pre class="pl-code">class ModerationService:
    AUTO_HIDE_THRESHOLD = 3

    def __init__(self, mod: ModerationRepository, users: UserRepository):
        self._mod = mod
        self._users = users

    async def flag(self, flagged_by: str, target_type: str, target_id: str,
                   reason: str, details: str | None) -&gt; Flag:
        flag = Flag(target_type=target_type, target_id=target_id,
                    reason=reason, details=details, flagged_by=flagged_by)
        flag = await self._mod.add_flag(flag)
        count = await self._mod.count_flags(target_type, target_id)
        if count &gt;= self.AUTO_HIDE_THRESHOLD:
            # auto-hide logic (mark content as hidden)
            pass
        return flag

    async def sanction(self, moderator_id: str, user_id: str,
                       sanction_type: str, reason: str, expires_at=None):
        roles = await self._users.get_roles(moderator_id)
        if sanction_type == 'ban' and 'admin' not in roles:
            raise PermissionDenied("Only admins can ban")
        if 'moderator' not in roles and 'admin' not in roles:
            raise PermissionDenied("Only moderators can sanction")
        return await self._mod.add_sanction(
            Sanction(user_id=user_id, type=sanction_type,
                     reason=reason, applied_by=moderator_id,
                     expires_at=expires_at)
        )</pre>
</section>

<!-- ═══════════════════════════════════════════════════════════ -->
<section id="api-surface" class="pl-s">
<h2>6. REST API Surface</h2>
<p>All endpoints under <code>/capi/</code> prefix (community API). The Vue frontend proxies <code>/capi/*</code> to <code>gmr-community-api</code>.</p>

<h3>Reports</h3>
<pre class="pl-code">POST   /capi/reports                          # Create report
GET    /capi/reports                          # List (my + shared + public)
GET    /capi/reports/{id}                     # Get report with sections
PUT    /capi/reports/{id}                     # Update title/abstract/visibility
DELETE /capi/reports/{id}                     # Delete (owner only)
POST   /capi/reports/{id}/sections            # Add section
PUT    /capi/reports/{id}/sections/{sid}      # Edit section content
DELETE /capi/reports/{id}/sections/{sid}      # Delete section
POST   /capi/reports/{id}/sections/{sid}/lock # Acquire edit lock
DELETE /capi/reports/{id}/sections/{sid}/lock # Release lock
GET    /capi/reports/{id}/sections/{sid}/versions # Version history</pre>

<h3>Sharing</h3>
<pre class="pl-code">GET    /capi/reports/{id}/access              # List collaborators
POST   /capi/reports/{id}/access              # Grant access (user or group)
DELETE /capi/reports/{id}/access/{access_id}  # Revoke access</pre>

<h3>Issues</h3>
<pre class="pl-code">POST   /capi/issues                           # Create issue
GET    /capi/issues                           # List (open, filterable)
GET    /capi/issues/{id}                      # Get issue + comments
PUT    /capi/issues/{id}/status               # Change status (moderator)
POST   /capi/issues/{id}/comments             # Add comment
POST   /capi/issues/{id}/vote                 # Upvote/downvote</pre>

<h3>Users & Groups</h3>
<pre class="pl-code">GET    /capi/users/me                         # Current user profile
GET    /capi/users/{id}                       # Public profile
POST   /capi/groups                           # Create group
GET    /capi/groups/{id}                      # Group detail + members
POST   /capi/groups/{id}/members              # Add member
DELETE /capi/groups/{id}/members/{uid}        # Remove member</pre>

<h3>Moderation</h3>
<pre class="pl-code">POST   /capi/flags                            # Flag content
GET    /capi/moderation/queue                 # Flagged items (moderator)
POST   /capi/moderation/queue/{id}/resolve    # Resolve flag
POST   /capi/moderation/sanctions             # Apply sanction
GET    /capi/moderation/log                   # Public moderation log</pre>
</section>

<!-- ═══════════════════════════════════════════════════════════ -->
<section id="auth" class="pl-s">
<h2>7. Authentication — Zitadel</h2>
<ul>
  <li><strong>Zitadel</strong> — single Go binary (~256MB), OIDC-certified, FranceConnect-ready.</li>
  <li><strong>Login options</strong>: magic link (email), FranceConnect, EU Login, GitHub.</li>
  <li><strong>Flow</strong>: Vue redirects to Zitadel → user authenticates → redirect back with code → exchange for tokens → FastAPI validates JWT on every <code>/capi/*</code> request.</li>
  <li><strong>User sync</strong>: on first login, gmr-community-api creates a row in PostgreSQL <code>users</code> table from the JWT claims (<code>sub</code>, <code>email</code>, <code>name</code>).</li>
  <li><strong>Shared PostgreSQL</strong>: Zitadel and gmr-community-api share the same PostgreSQL instance (different databases: <code>zitadel</code> and <code>gmr_app</code>).</li>
</ul>
</section>

<!-- ═══════════════════════════════════════════════════════════ -->
<section id="roles" class="pl-s">
<h2>8. Roles & Permissions</h2>

<h3>Global roles (RBAC, stored in PostgreSQL)</h3>
<table class="pl-table">
  <thead><tr><th>Role</th><th>Read public</th><th>Comment</th><th>Create reports</th><th>Raise issues</th><th>Moderate</th><th>Admin</th></tr></thead>
  <tbody>
    <tr><td><code>reader</code></td><td>Yes</td><td>No</td><td>No</td><td>No</td><td>No</td><td>No</td></tr>
    <tr><td><code>commenter</code></td><td>Yes</td><td>Yes</td><td>No</td><td>No</td><td>No</td><td>No</td></tr>
    <tr><td><code>contributor</code></td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td><td>No</td><td>No</td></tr>
    <tr><td><code>moderator</code></td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td><td>No</td></tr>
    <tr><td><code>admin</code></td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
  </tbody>
</table>

<h3>Report-level access</h3>
<p><code>owner &gt; editor &gt; commenter &gt; viewer &gt; none</code></p>
<p>Granted per-user or per-group. Effective = max(direct, any group, public default). Admin overrides all.</p>
<p>Resolved in a single SQL query (see PermissionService above).</p>

<h3>Trust levels (auto-progression)</h3>
<table class="pl-table">
  <thead><tr><th>Level</th><th>Name</th><th>Requirements</th></tr></thead>
  <tbody>
    <tr><td>0</td><td><code>new_user</code></td><td>Just registered</td></tr>
    <tr><td>1</td><td><code>commenter</code></td><td>Email verified + 24h</td></tr>
    <tr><td>2</td><td><code>contributor</code></td><td>1 approved report or 5 approved comments</td></tr>
    <tr><td>3</td><td><code>moderator</code></td><td>Manually granted</td></tr>
    <tr><td>4</td><td><code>admin</code></td><td>Manually granted</td></tr>
  </tbody>
</table>
</section>

<!-- ═══════════════════════════════════════════════════════════ -->
<section id="reports" class="pl-s">
<h2>9. Reports & Embeds</h2>
<ul>
  <li><strong>Tiptap</strong> rich text editor with custom node views for widget blocks.</li>
  <li><strong>Section-level locking</strong> (last-write-wins). No CRDT. Lock TTL = 5 min.</li>
  <li><strong>Widget embedding</strong>: any Vue component in the registry can be embedded. Config stored as JSONB in the <code>sections.content_json</code> column (Tiptap node attributes).</li>
  <li><strong>Component contract</strong>: <code>storeState() → JSON</code>, <code>restoreFromState(JSON) → render</code>.</li>
  <li><strong>Live data</strong>: embeds are queries, not snapshots. Widget config defines what to fetch from the graph API.</li>
  <li><strong>Visibility</strong>: Private / Group / Public (authenticated) / Public (open).</li>
</ul>
</section>

<!-- ═══════════════════════════════════════════════════════════ -->
<section id="community" class="pl-s">
<h2>10. Community Curation & Issues</h2>
<ul>
  <li><strong>Issues</strong> reference graph entities via <code>entity_type</code> + <code>entity_id</code> (external ID). The community API calls the graph API to resolve names.</li>
  <li><strong>Types</strong>: <code>incorrect_data</code>, <code>duplicate_entity</code>, <code>missing_connection</code>, <code>missing_entity</code>, <code>other</code>.</li>
  <li><strong>Lifecycle</strong>: open → under_review → resolved/rejected/closed.</li>
  <li><strong>Discussion</strong>: comments (Markdown), upvote/downvote.</li>
  <li><strong>Resolution</strong>: moderators resolve issues, which may trigger graph updates via the graph API (entity merge, property update, new relationship). Audit trail in PostgreSQL.</li>
</ul>
</section>

<!-- ═══════════════════════════════════════════════════════════ -->
<section id="moderation" class="pl-s">
<h2>11. Moderation & Bans</h2>
<ul>
  <li><strong>Flagging</strong>: reasons = inaccurate/spam/harassment/off_topic/other. 3 flags → auto-hide.</li>
  <li><strong>Sanctions</strong>: warning, mute (1-30d), suspend (1-365d), ban (permanent, admin only).</li>
  <li><strong>Public moderation log</strong>: every action logged and publicly visible.</li>
  <li><strong>Ban enforcement</strong>: auth middleware checks sanctions table. Banned user gets 401.</li>
</ul>
</section>

<!-- ═══════════════════════════════════════════════════════════ -->
<section id="unit-tests" class="pl-s">
<h2>12. Unit Test Plan</h2>
<p>All unit tests use <code>InMemoryXxxRepository</code> — no database, no I/O. Target: &lt;1 second for the full suite.</p>

<h3>Permission tests (PERM)</h3>
<table class="pl-table">
  <thead><tr><th>ID</th><th>Test</th></tr></thead>
  <tbody>
    <tr><td>PERM-01</td><td>Admin can access any report regardless of access list</td></tr>
    <tr><td>PERM-02</td><td>Owner has all permissions on their report</td></tr>
    <tr><td>PERM-03</td><td>Editor can edit but not change visibility</td></tr>
    <tr><td>PERM-04</td><td>Viewer cannot edit or comment</td></tr>
    <tr><td>PERM-05</td><td>Group access grants effective permission to all members</td></tr>
    <tr><td>PERM-06</td><td>Direct access overrides lower group access</td></tr>
    <tr><td>PERM-07</td><td>Suspended user is denied even if they have editor access</td></tr>
    <tr><td>PERM-08</td><td>Public report is readable by any authenticated user</td></tr>
    <tr><td>PERM-09</td><td>Private report is invisible to non-collaborators</td></tr>
    <tr><td>PERM-10</td><td>Removing last owner raises error</td></tr>
  </tbody>
</table>

<h3>Report lifecycle tests (RPT)</h3>
<table class="pl-table">
  <thead><tr><th>ID</th><th>Test</th></tr></thead>
  <tbody>
    <tr><td>RPT-01</td><td>Creating a report makes the creator the owner</td></tr>
    <tr><td>RPT-02</td><td>Adding a section increments the sort order</td></tr>
    <tr><td>RPT-03</td><td>Editing a section saves the previous content as a version</td></tr>
    <tr><td>RPT-04</td><td>Deleting a section does not affect other sections' order</td></tr>
    <tr><td>RPT-05</td><td>Section lock prevents concurrent edit</td></tr>
    <tr><td>RPT-06</td><td>Section lock expires after TTL</td></tr>
    <tr><td>RPT-07</td><td>Lock holder can save and release</td></tr>
    <tr><td>RPT-08</td><td>Version history returns most recent first</td></tr>
    <tr><td>RPT-09</td><td>Listing reports for user includes owned + shared + public</td></tr>
    <tr><td>RPT-10</td><td>Deleting a report cascades to sections and versions</td></tr>
  </tbody>
</table>

<h3>Issue tests (ISS)</h3>
<table class="pl-table">
  <thead><tr><th>ID</th><th>Test</th></tr></thead>
  <tbody>
    <tr><td>ISS-01</td><td>Creating an issue sets status to 'open'</td></tr>
    <tr><td>ISS-02</td><td>Adding a comment appends to the thread</td></tr>
    <tr><td>ISS-03</td><td>Voting updates the vote count</td></tr>
    <tr><td>ISS-04</td><td>Double-voting by the same user is idempotent</td></tr>
    <tr><td>ISS-05</td><td>Changing status to 'resolved' is only allowed for moderators</td></tr>
    <tr><td>ISS-06</td><td>Listing issues for an entity filters by entity_type + entity_id</td></tr>
    <tr><td>ISS-07</td><td>Closed issues cannot receive new comments</td></tr>
  </tbody>
</table>

<h3>Moderation tests (MOD)</h3>
<table class="pl-table">
  <thead><tr><th>ID</th><th>Test</th></tr></thead>
  <tbody>
    <tr><td>MOD-01</td><td>3 flags on a report triggers auto-hide</td></tr>
    <tr><td>MOD-02</td><td>Same user cannot flag the same content twice</td></tr>
    <tr><td>MOD-03</td><td>Only moderators can apply sanctions</td></tr>
    <tr><td>MOD-04</td><td>Only admins can ban</td></tr>
    <tr><td>MOD-05</td><td>Warning is a one-time event (no duration)</td></tr>
    <tr><td>MOD-06</td><td>Mute prevents commenting but allows reading</td></tr>
    <tr><td>MOD-07</td><td>Expired suspension no longer blocks the user</td></tr>
    <tr><td>MOD-08</td><td>Moderation log records every action with timestamp and actor</td></tr>
    <tr><td>MOD-09</td><td>Lifting a sanction updates the lifted_at timestamp</td></tr>
    <tr><td>MOD-10</td><td>Trust level auto-progression from new_user to commenter after 24h</td></tr>
  </tbody>
</table>

<h3>In-memory implementation pattern</h3>
<pre class="pl-code">class InMemoryReportRepository(ReportRepository):
    def __init__(self):
        self._reports: dict[str, Report] = {}
        self._sections: dict[str, Section] = {}
        self._locks: dict[str, tuple[str, float]] = {}  # section_id → (user_id, expires)
        self._versions: dict[str, list[SectionVersion]] = {}

    async def create(self, report: Report) -&gt; Report:
        report.id = str(uuid4())
        self._reports[report.id] = report
        return report

    async def get_by_id(self, report_id: str) -&gt; Report | None:
        return self._reports.get(report_id)

    async def acquire_lock(self, section_id: str, user_id: str, ttl: int) -&gt; bool:
        existing = self._locks.get(section_id)
        if existing and existing[0] != user_id and existing[1] &gt; time.time():
            return False  # locked by someone else
        self._locks[section_id] = (user_id, time.time() + ttl)
        return True
    # ... etc</pre>

<p><strong>Test fixture:</strong></p>
<pre class="pl-code">@pytest.fixture
def report_service():
    repo = InMemoryReportRepository()
    perms = PermissionService(
        InMemoryPermissionRepository(),
        InMemoryUserRepository(),
        InMemoryGroupRepository(),
    )
    return ReportService(repo, perms)

async def test_create_report_makes_creator_owner(report_service):
    report = await report_service.create(user_id="user-1", title="Test")
    assert report.id is not None
    assert report.created_by == "user-1"
    # Permission service should have set owner access
    # (checked via the permission repo)</pre>
</section>

<!-- ═══════════════════════════════════════════════════════════ -->
<section id="security-tests" class="pl-s">
<h2>13. Security Test Plan</h2>
<p>Run in CI as pytest against the real FastAPI app (TestClient) with InMemory repos. Failures block deployment.</p>

<h3>Authentication (AUTH-SEC)</h3>
<table class="pl-table">
  <thead><tr><th>ID</th><th>Test</th></tr></thead>
  <tbody>
    <tr><td>AUTH-SEC-01</td><td>No token → 401</td></tr>
    <tr><td>AUTH-SEC-02</td><td>Expired JWT → 401</td></tr>
    <tr><td>AUTH-SEC-03</td><td>Wrong issuer → 401</td></tr>
    <tr><td>AUTH-SEC-04</td><td>Tampered signature → 401</td></tr>
    <tr><td>AUTH-SEC-05</td><td>Banned user token → 401</td></tr>
  </tbody>
</table>

<h3>Privilege escalation (AUTHZ-SEC)</h3>
<table class="pl-table">
  <thead><tr><th>ID</th><th>Test</th></tr></thead>
  <tbody>
    <tr><td>AUTHZ-SEC-01</td><td>Reader cannot create report → 403</td></tr>
    <tr><td>AUTHZ-SEC-02</td><td>Viewer cannot edit report → 403</td></tr>
    <tr><td>AUTHZ-SEC-03</td><td>Editor cannot change visibility → 403</td></tr>
    <tr><td>AUTHZ-SEC-04</td><td>Editor cannot delete report → 403</td></tr>
    <tr><td>AUTHZ-SEC-05</td><td>Non-member cannot access group's private report → 403</td></tr>
    <tr><td>AUTHZ-SEC-06</td><td>Contributor cannot resolve issues → 403</td></tr>
    <tr><td>AUTHZ-SEC-07</td><td>Moderator cannot ban → 403</td></tr>
    <tr><td>AUTHZ-SEC-08</td><td>Suspended user cannot create → 403</td></tr>
    <tr><td>AUTHZ-SEC-09</td><td>Self-role-escalation via API → 403</td></tr>
    <tr><td>AUTHZ-SEC-10</td><td>IDOR: user A cannot access user B's private report → 404</td></tr>
    <tr><td>AUTHZ-SEC-11</td><td>IDOR: user A cannot edit user B's profile → 403</td></tr>
  </tbody>
</table>

<h3>Data integrity (DATA-SEC)</h3>
<table class="pl-table">
  <thead><tr><th>ID</th><th>Test</th></tr></thead>
  <tbody>
    <tr><td>DATA-SEC-01</td><td>XSS in report title is sanitized on read</td></tr>
    <tr><td>DATA-SEC-02</td><td>XSS in comment body is sanitized</td></tr>
    <tr><td>DATA-SEC-03</td><td>SQL injection in search params is prevented (parameterized)</td></tr>
    <tr><td>DATA-SEC-04</td><td>Section save validates lock ownership</td></tr>
    <tr><td>DATA-SEC-05</td><td>Widget config &gt;1MB is rejected</td></tr>
  </tbody>
</table>
</section>

<!-- ═══════════════════════════════════════════════════════════ -->
<section id="e2e-tests" class="pl-s">
<h2>14. E2E Test Plan (Playwright)</h2>
<table class="pl-table">
  <thead><tr><th>ID</th><th>Journey</th></tr></thead>
  <tbody>
    <tr><td>E2E-01</td><td>Sign up → create report → add text → add graph embed → save → view</td></tr>
    <tr><td>E2E-02</td><td>Share report with collaborator → collaborator edits a section</td></tr>
    <tr><td>E2E-03</td><td>Raise issue on entity → comment → moderator resolves</td></tr>
    <tr><td>E2E-04</td><td>Flag content → auto-hidden after 3 flags → moderator reviews</td></tr>
    <tr><td>E2E-05</td><td>Public report is readable without login</td></tr>
    <tr><td>E2E-06</td><td>Suspended user sees error on post attempt</td></tr>
  </tbody>
</table>
</section>

<!-- ═══════════════════════════════════════════════════════════ -->
<section id="phases" class="pl-s">
<h2>15. Implementation Phases</h2>

<div class="pl-phase">
  <h3>Phase 0 — Repo bootstrap + Zitadel (1 week)</h3>
  <ul>
    <li>Create <code>gmr-community-api</code> repo (FastAPI + SQLAlchemy + Alembic + pytest)</li>
    <li>Deploy PostgreSQL to k8s (shared instance, 2 databases)</li>
    <li>Deploy Zitadel to k8s, configure OIDC + FranceConnect</li>
    <li>JWT middleware in community API</li>
    <li>Vue OIDC login flow</li>
    <li>nginx proxy: <code>/capi/*</code> → community API</li>
    <li>Tests: AUTH-SEC-01 through AUTH-SEC-05</li>
  </ul>
  <p class="pl-gate">Gate: login works, JWT validated, user created in PostgreSQL</p>
</div>

<div class="pl-phase">
  <h3>Phase 1 — Repository + service layer scaffold (1 week)</h3>
  <ul>
    <li>Domain models (dataclasses)</li>
    <li>All 6 repository ABCs</li>
    <li>All InMemory implementations</li>
    <li>PermissionService + ReportService + ModerationService</li>
    <li>Unit tests: PERM-01 through PERM-10, RPT-01 through RPT-10</li>
  </ul>
  <p class="pl-gate">Gate: 37+ unit tests pass in &lt;1 second, 0 I/O</p>
</div>

<div class="pl-phase">
  <h3>Phase 2 — PostgreSQL implementations + CRUD API (2 weeks)</h3>
  <ul>
    <li>Alembic migrations for all tables</li>
    <li>PostgreSQL repository implementations (SQLAlchemy async)</li>
    <li>REST routers: reports, sections, users, groups</li>
    <li>Integration tests (real PostgreSQL)</li>
  </ul>
  <p class="pl-gate">Gate: create/edit/list/delete reports via API, Postgres repos pass same tests as InMemory</p>
</div>

<div class="pl-phase">
  <h3>Phase 3 — Report UI + Tiptap + widget embeds (2 weeks)</h3>
  <ul>
    <li>Tiptap integration in Vue</li>
    <li>Widget registry + WidgetRenderer component</li>
    <li>"Start a new analysis" entry point</li>
    <li>Graph explorer embed, data table embed</li>
    <li>Section locking UI</li>
    <li>Vitest: widget rendering, store/restore roundtrip</li>
  </ul>
  <p class="pl-gate">Gate: embed graph in report, renders live data on view</p>
</div>

<div class="pl-phase">
  <h3>Phase 4 — Sharing + permissions UI (1 week)</h3>
  <ul>
    <li>Sharing modal (add people, add groups, visibility)</li>
    <li>Permission enforcement on all endpoints</li>
    <li>Security tests: AUTHZ-SEC-01 through AUTHZ-SEC-11</li>
  </ul>
  <p class="pl-gate">Gate: all permission + security tests pass</p>
</div>

<div class="pl-phase">
  <h3>Phase 5 — Community: issues + moderation (2 weeks)</h3>
  <ul>
    <li>Issue CRUD + discussion + voting</li>
    <li>Flagging + auto-hide</li>
    <li>Sanctions + trust levels</li>
    <li>Public moderation log</li>
    <li>Unit tests: ISS-01 through ISS-07, MOD-01 through MOD-10</li>
    <li>E2E: E2E-01 through E2E-06</li>
  </ul>
  <p class="pl-gate">Gate: full community workflow end-to-end, all tests pass, deployed</p>
</div>

<p><strong>Total: ~9-10 weeks</strong> for a 2-person team. Phases are sequential.</p>
</section>

<!-- ═══════════════════════════════════════════════════════════ -->
<section id="stack" class="pl-s">
<h2>16. Technology Stack</h2>

<table class="pl-table">
  <thead><tr><th>Layer</th><th>Choice</th><th>Why</th></tr></thead>
  <tbody>
    <tr><td>IdP</td><td><strong>Zitadel</strong></td><td>Single Go binary, ~256MB, OIDC-certified, FranceConnect-ready</td></tr>
    <tr><td>App database</td><td><strong>PostgreSQL 16</strong></td><td>ACID, Alembic migrations, SQLAlchemy async, JSONB for widget configs</td></tr>
    <tr><td>Knowledge graph</td><td><strong>Neo4j (existing)</strong></td><td>Public data only. Unchanged. Consumed via graph API.</td></tr>
    <tr><td>ORM</td><td><strong>SQLAlchemy 2.0 (async)</strong></td><td>Type-safe, async support, Alembic integration</td></tr>
    <tr><td>Rich text</td><td><strong>Tiptap (ProseMirror)</strong></td><td>Vue 3 support, custom node views for widget blocks</td></tr>
    <tr><td>Collaboration</td><td><strong>Section-level locking</strong></td><td>No CRDT overhead. Upgrade to Yjs later if needed.</td></tr>
    <tr><td>Widget embedding</td><td><strong>Vue component registry</strong></td><td>Lazy-loaded, typed JSON config, storeState/restoreFromState</td></tr>
    <tr><td>Testing</td><td><strong>pytest (InMemory repos) + vitest + Playwright</strong></td><td>Unit tests &lt;1s, no I/O. E2E for critical paths.</td></tr>
  </tbody>
</table>

<h3>Deployment</h3>
<pre class="pl-code">Namespace: gmr
├── postgresql (new, 1 replica, 256Mi, PVC 10Gi)
│   ├── DB: zitadel
│   └── DB: gmr_app
├── zitadel (new, 1 replica, 256Mi)
├── gmr-community-api (new, 1 replica, 256Mi)
│   └── connects to: postgresql (gmr_app) + gmr-api (graph queries)
├── gmr-api (existing, unchanged — Neo4j public data)
├── gmr-web (existing, add /capi/* proxy + Tiptap + auth flow)
└── neo4j (existing, unchanged — public knowledge graph)</pre>
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
.pl-nav__link { display: block; width: 100%; padding: 5px 8px; font-size: 0.73rem; color: var(--muted); background: transparent; border: none; cursor: pointer; text-align: left; border-radius: 3px; line-height: 1.3; margin-bottom: 1px; }
.pl-nav__link:hover { color: var(--text); background: var(--bg); }
.pl-nav__link.active { color: var(--accent); font-weight: 600; }

.pl-main { flex: 1; max-width: 820px; padding: 1.5rem 2rem 4rem; }
.pl-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
.pl-header h1 { font-size: 1.4rem; font-weight: 800; }
.pl-sub { font-size: 0.82rem; color: var(--muted); margin-top: 0.2rem; }

.pl-s { margin-bottom: 3rem; }
.pl-s h2 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.75rem; padding-bottom: 0.3rem; border-bottom: 2px solid var(--accent); }
.pl-s h3 { font-size: 0.92rem; font-weight: 600; margin: 1.2rem 0 0.4rem; }
.pl-s p { font-size: 0.83rem; line-height: 1.6; margin-bottom: 0.6rem; }
.pl-s ul, .pl-s ol { font-size: 0.83rem; line-height: 1.6; padding-left: 1.25rem; margin-bottom: 0.6rem; }
.pl-s li { margin-bottom: 0.2rem; }

.pl-table { width: 100%; border-collapse: collapse; font-size: 0.76rem; margin: 0.5rem 0 1rem; }
.pl-table th { background: var(--surface); text-align: left; padding: 4px 7px; border: 1px solid var(--border); font-weight: 600; }
.pl-table td { padding: 3px 7px; border: 1px solid var(--border); vertical-align: top; }
.pl-table code { font-size: 0.85em; background: var(--bg); padding: 1px 3px; border-radius: 2px; }

.pl-code { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 10px 14px; overflow-x: auto; font-size: 0.74rem; line-height: 1.5; margin: 0.5rem 0 1rem; font-family: 'SFMono-Regular', Consolas, monospace; white-space: pre; }

.pl-three { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0.75rem 0; }
.pl-three__item { padding: 10px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); }
.pl-three__item strong { font-size: 0.85rem; display: block; margin-bottom: 4px; }
.pl-three__item p { font-size: 0.76rem; color: var(--muted); margin: 0; }

.pl-phase { padding: 1rem; border: 1px solid var(--border); border-radius: 6px; margin: 0.75rem 0; background: var(--surface); }
.pl-phase h3 { margin-top: 0; }
.pl-gate { font-size: 0.76rem; font-weight: 600; color: var(--accent); padding: 6px 10px; background: var(--bg); border-radius: 4px; border-left: 3px solid var(--accent); margin-top: 0.5rem; }

@media (max-width: 768px) {
  .pl { flex-direction: column; }
  .pl-nav { width: 100%; height: auto; position: static; border-right: none; border-bottom: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 2px; padding: 0.75rem; }
  .pl-nav__head { width: 100%; }
  .pl-main { padding: 1rem; }
  .pl-three { grid-template-columns: 1fr; }
}
</style>
