<script setup>
/**
 * Generic theme landing for every theme except procurement (which has a
 * richer composed page). Driven by themeConfig: a question-first framing,
 * the operational pipeline panel + drill-link for each constituent source,
 * and an honest "deeper insights" note for the cross-source analytics
 * still to come. Themes are the investigative lens; per-source dashboards
 * remain the operational/health layer this links down into.
 */
import { computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import ThemeToggle from '../../components/ThemeToggle.vue'
import SourcePipelinePanel from '../../components/SourcePipelinePanel.vue'
import { THEMES, SCAFFOLD } from './themeConfig.js'

const { t } = useI18n()
const route = useRoute()
const themeId = computed(() => route.params.themeId)
const meta = computed(() => THEMES.find(t => t.id === themeId.value) || null)
const cfg = computed(() => SCAFFOLD[themeId.value] || null)

function setTitle() {
  document.title = meta.value ? `${t(meta.value.title)} — Fontem` : 'Theme — Fontem'
}
onMounted(setTitle)
watch(themeId, setTitle)
</script>

<template>
  <div class="theme">
    <header class="theme-hdr">
      <div>
        <router-link to="/data-quality" class="theme-back">{{ $t('nav.back_data_quality') }}</router-link>
        <h1 v-if="meta">{{ meta.icon }} {{ $t(meta.title) }}</h1>
        <h1 v-else>{{ $t('theme_scaffold.unknown_theme') }}</h1>
        <p v-if="meta" class="theme-sub">{{ $t(meta.blurb) }}</p>
      </div>
      <ThemeToggle />
    </header>

    <template v-if="cfg">
      <section v-if="cfg.questions?.length" class="theme-section">
        <h2>{{ $t('theme_scaffold.questions_this_answers') }}</h2>
        <ul class="theme-q">
          <li v-for="(q, i) in cfg.questions" :key="i">{{ $t(q) }}</li>
        </ul>
      </section>

      <section class="theme-section">
        <h2>{{ $t('theme_scaffold.sources_and_pipeline_health') }}</h2>
        <div v-for="src in cfg.sources" :key="src.id" class="theme-src">
          <SourcePipelinePanel :source-id="src.id" :title="$t(src.label)" />
          <router-link v-if="src.route" :to="src.route" class="theme-drill">
            {{ $t('theme_scaffold.open_the') }} {{ $t(src.label) }} {{ $t('theme_scaffold.dashboard_arrow') }}
          </router-link>
          <p v-else class="theme-hint">{{ $t('theme_scaffold.no_dedicated_dashboard_yet') }}</p>
        </div>
      </section>

      <section v-if="cfg.soon" class="theme-section theme-soon">
        <h2>{{ $t('theme_scaffold.deeper_insights') }} <span class="theme-badge">{{ $t('theme_scaffold.coming_soon') }}</span></h2>
        <p class="theme-hint">{{ $t(cfg.soon) }}</p>
      </section>
    </template>
    <p v-else class="theme-hint">{{ $t('theme_scaffold.no_configuration_yet') }}</p>
  </div>
</template>

<style scoped>
.theme { max-width: 960px; margin: 0 auto; padding: 0 1rem 4rem; }
.theme-hdr { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.theme-hdr h1 { font-size: 1.5rem; font-weight: 700; margin: 0.3rem 0 0; }
.theme-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.theme-sub { font-size: 0.9rem; color: var(--muted); margin-top: 0.3rem; max-width: 60ch; }
.theme-section { margin-bottom: 1.75rem; }
.theme-section h2 { font-size: 1rem; font-weight: 700; margin: 0 0 0.5rem; }
.theme-q { margin: 0; padding-left: 1.1rem; color: var(--text); font-size: 0.9rem; }
.theme-q li { margin-bottom: 0.25rem; }
.theme-src { margin-bottom: 0.5rem; }
.theme-hint { font-size: 0.82rem; color: var(--muted); margin: 0.2rem 0 0; }
.theme-soon { opacity: 0.75; }
.theme-badge { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 0.1rem 0.5rem; margin-left: 0.4rem; vertical-align: middle; }
.theme-drill { display: inline-block; margin: 0.1rem 0 0.4rem; font-size: 0.85rem; color: var(--accent); text-decoration: none; font-weight: 600; }
</style>
