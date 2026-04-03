<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import ThemeToggle from '../components/ThemeToggle.vue'
import { features, categories, statusColors } from '../data/roadmap-features.js'

const router = useRouter()
onMounted(() => { document.title = 'Mission & Roadmap — GMR' })

const activeTab = ref('all')
const tabs = [
  { key: 'all', label: 'All' },
  { key: 'insight', label: 'Insight Tools' },
  { key: 'data-source', label: 'Data Sources' },
  { key: 'platform', label: 'Platform' },
]

const filteredFeatures = computed(() => {
  if (activeTab.value === 'all') return features
  return features.filter((f) => f.category === activeTab.value)
})

function openFeature(id) {
  router.push(`/admin/roadmap/${id}`)
}
</script>

<template>
  <div class="rm">
    <nav class="rm-nav">
      <div class="rm-nav__header">
        <router-link to="/admin" class="rm-back">&larr; Admin</router-link>
        <h2>Roadmap</h2>
      </div>

      <div class="rm-nav__section">
        <router-link class="rm-nav__link" to="/admin/roadmap#mission">Mission</router-link>
        <router-link class="rm-nav__link" to="/admin/roadmap#vision">Vision</router-link>
      </div>

      <div class="rm-nav__divider"></div>
      <div class="rm-nav__label">Features</div>

      <div class="rm-nav__section">
        <button
          v-for="f in features"
          :key="f.id"
          class="rm-nav__link"
          @click="openFeature(f.id)"
        >
          <span class="rm-nav__dot" :style="{ background: statusColors[f.status]?.bg }"></span>
          {{ f.title }}
        </button>
      </div>
    </nav>

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
        <p>We don't take sides. We surface facts. The graph speaks for itself.</p>
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
          Existing fact-checking organizations do excellent work on individual claims.
          What's missing is the underlying infrastructure: a connected knowledge graph that lets
          anyone explore the relationships between public entities, follow the money, and verify
          structural claims like "company X is linked to politician Y."
        </p>

        <h3>From data to insight</h3>
        <p>
          Having the data is necessary but not sufficient. The platform must help users — journalists,
          researchers, decision-makers, and citizens — draw conclusions from the graph.
          That's why the roadmap prioritizes <strong>insight tools</strong> alongside data sources:
          collaborative reports, anomaly detection, watchlists, natural language queries, and
          entity dashboards.
        </p>

        <h3>Concentric circles</h3>
        <div class="rm-circles">
          <div class="rm-circle">
            <div class="rm-circle__num">1</div>
            <div>
              <strong>France 2027</strong> — Full coverage of companies, associations, officials,
              procurement, lobbying, campaign finance, and elections. The reference for the upcoming elections.
            </div>
          </div>
          <div class="rm-circle">
            <div class="rm-circle__num">2</div>
            <div>
              <strong>EU institutions</strong> — Parliament votes, lobbying register, EU funds,
              cross-border corporate groups. The Brussels dimension.
            </div>
          </div>
          <div class="rm-circle">
            <div class="rm-circle__num">3</div>
            <div>
              <strong>EU member states</strong> — Replicate the French model across the Union.
              Data sources differ but the graph model is universal.
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ FEATURES ═══════════════════════════════════ -->
      <section class="rm-section">
        <h2>Roadmap</h2>
        <p class="rm-sub">
          {{ features.length }} proposed features across {{ Object.keys(categories).length }} categories.
          Click any card for full details, data model, and implementation plan.
        </p>

        <!-- Category tabs -->
        <div class="rm-tabs">
          <button
            v-for="t in tabs"
            :key="t.key"
            class="rm-tab"
            :class="{ 'rm-tab--active': activeTab === t.key }"
            @click="activeTab = t.key"
          >
            {{ t.label }}
            <span v-if="t.key !== 'all'" class="rm-tab__count">
              {{ features.filter((f) => f.category === t.key).length }}
            </span>
          </button>
        </div>

        <!-- Feature cards -->
        <div class="rm-grid">
          <div
            v-for="f in filteredFeatures"
            :key="f.id"
            class="rm-fcard"
            @click="openFeature(f.id)"
          >
            <div class="rm-fcard__top">
              <span class="rm-cat">{{ categories[f.category]?.label }}</span>
              <span
                class="rm-status"
                :style="{ background: statusColors[f.status]?.bg, color: statusColors[f.status]?.text }"
              >{{ f.status }}</span>
            </div>
            <h3>{{ f.title }}</h3>
            <p>{{ f.summary }}</p>
            <div class="rm-fcard__meta">
              <span v-if="f.effort">{{ f.effort }} effort</span>
              <span v-if="f.coverage">{{ f.coverage }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ STATUS ═════════════════════════════════════ -->
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
          ESMA ESEF (EU financials), TED (EU procurement 2023-2026), French directors (RNE).
          The graph explorer, path finding, and entity resolution are operational.
        </p>
      </section>
    </main>
  </div>
</template>

<style scoped>
.rm { display: flex; min-height: 100vh; }

/* ── Sidebar ──────────────────────────── */
.rm-nav { width: 250px; flex-shrink: 0; padding: 1.5rem 0.75rem; border-right: 1px solid var(--border); background: var(--surface); position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.rm-nav__header { margin-bottom: 1rem; padding: 0 0.5rem; }
.rm-nav__header h2 { font-size: 1rem; font-weight: 700; margin-top: 0.25rem; }
.rm-back { font-size: 0.78rem; color: var(--accent); text-decoration: none; }
.rm-nav__section { display: flex; flex-direction: column; gap: 1px; }
.rm-nav__link { display: flex; align-items: center; gap: 5px; padding: 4px 8px; font-size: 0.75rem; color: var(--muted); background: transparent; border: none; cursor: pointer; text-align: left; border-radius: 3px; line-height: 1.3; text-decoration: none; }
.rm-nav__link:hover { color: var(--text); background: var(--bg); }
.rm-nav__dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.rm-nav__divider { height: 1px; background: var(--border); margin: 0.6rem 0; }
.rm-nav__label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 600; padding: 0 8px; margin-bottom: 3px; }

/* ── Main ─────────────────────────────── */
.rm-main { flex: 1; max-width: 860px; padding: 1.5rem 2rem 4rem; }
.rm-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
.rm-header h1 { font-size: 1.4rem; font-weight: 800; }
.rm-section { margin-bottom: 2.5rem; }
.rm-section h2 { font-size: 1.15rem; font-weight: 700; margin-bottom: 0.75rem; padding-bottom: 0.3rem; border-bottom: 2px solid var(--accent); display: inline-block; }
.rm-section h3 { font-size: 0.95rem; font-weight: 600; margin: 1rem 0 0.4rem; }
.rm-section p { font-size: 0.85rem; line-height: 1.6; color: var(--text); margin-bottom: 0.6rem; }
.rm-sub { color: var(--muted); margin-bottom: 1rem; }
.rm-card { padding: 1rem 1.25rem; border-radius: 6px; margin-bottom: 1rem; border: 1px solid var(--border); }
.rm-card--accent { border-left: 4px solid var(--accent); background: var(--surface); }
.rm-lead { font-size: 0.95rem; font-weight: 600; line-height: 1.45; margin: 0; }

/* Circles */
.rm-circles { display: flex; flex-direction: column; gap: 10px; margin: 0.75rem 0; }
.rm-circle { display: flex; gap: 10px; font-size: 0.83rem; line-height: 1.5; }
.rm-circle__num { width: 26px; height: 26px; flex-shrink: 0; border-radius: 50%; background: var(--accent); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; }

/* Tabs */
.rm-tabs { display: flex; gap: 4px; margin-bottom: 1rem; }
.rm-tab { padding: 4px 12px; font-size: 0.78rem; font-weight: 600; border: 1px solid var(--border); background: transparent; color: var(--muted); cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 4px; }
.rm-tab:hover { border-color: var(--accent); color: var(--accent); }
.rm-tab--active { background: var(--accent); color: white; border-color: var(--accent); }
.rm-tab__count { font-size: 0.65rem; opacity: 0.7; }

/* Feature cards grid */
.rm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.rm-fcard { padding: 1rem; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); cursor: pointer; transition: border-color 0.15s; }
.rm-fcard:hover { border-color: var(--accent); }
.rm-fcard__top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.rm-fcard h3 { font-size: 0.88rem; font-weight: 700; margin: 0 0 6px; }
.rm-fcard p { font-size: 0.78rem; line-height: 1.5; color: var(--muted); margin: 0 0 8px; }
.rm-fcard__meta { display: flex; gap: 10px; font-size: 0.7rem; color: var(--muted); }
.rm-cat { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); font-weight: 600; }
.rm-status { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; padding: 1px 6px; border-radius: 8px; }

/* Stats */
.rm-stats { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 0.75rem; }
.rm-stat { text-align: center; padding: 6px 12px; border: 1px solid var(--border); border-radius: 5px; min-width: 70px; }
.rm-stat__val { font-size: 1rem; font-weight: 800; color: var(--accent); }
.rm-stat__lbl { font-size: 0.6rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }

@media (max-width: 768px) {
  .rm { flex-direction: column; }
  .rm-nav { width: 100%; height: auto; position: static; border-right: none; border-bottom: 1px solid var(--border); }
  .rm-nav__section { flex-direction: row; flex-wrap: wrap; gap: 2px; }
  .rm-main { padding: 1rem; }
  .rm-grid { grid-template-columns: 1fr; }
}
</style>
