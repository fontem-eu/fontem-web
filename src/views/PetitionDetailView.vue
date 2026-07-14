<script setup>
/**
 * Petition detail — what it's about, how many citizens signed, and the
 * legislation that followed. Legislation buckets mirror the API:
 * REGISTERED_BY (registration decision), ANSWERED_BY (Commission
 * response), LED_TO (resulting acts). Unresolved answer refs render as
 * "documented, not yet linkable" — never silently dropped.
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { fetchPetitionDetail } from '../api/petitions.js'

const route = useRoute()
const { t } = useI18n()

const detail = ref(null)
const error = ref('')
const NUM = new Intl.NumberFormat()

const petition = computed(() => detail.value?.petition || {})
const buckets = computed(() => {
  const out = { REGISTERED_BY: [], ANSWERED_BY: [], LED_TO: [] }
  for (const a of detail.value?.legislation || []) {
    if (out[a.rel]) out[a.rel].push(a)
  }
  return out
})
const unresolved = computed(() => detail.value?.unresolved_answer_refs || [])
const organizers = computed(() => {
  const names = petition.value.organizer_names || []
  const roles = petition.value.organizer_roles || []
  return names.map((n, i) => ({ name: n, role: roles[i] || '' }))
})
const milestones = computed(() => [
  ['registration_date', t('petitions.milestone.registered')],
  ['collection_start_date', t('petitions.milestone.collection')],
  ['closed_date', t('petitions.milestone.closed')],
  ['submitted_date', t('petitions.milestone.submitted')],
  ['answered_date', t('petitions.milestone.answered')],
].filter(([k]) => petition.value[k]).map(([k, label]) => ({ label, date: petition.value[k] })))

function statusLabel(s) {
  if (!s) return ''
  const key = `petitions.status.${s.toLowerCase()}`
  const label = t(key)
  return label === key ? s : label
}

onMounted(async () => {
  try {
    detail.value = await fetchPetitionDetail(route.params.id)
  } catch (e) {
    error.value = e?.message || String(e)
  }
})
</script>

<template>
  <main class="petition-detail" data-testid="petition-detail">
    <p v-if="error" class="pd-error" data-testid="petition-error">{{ error }}</p>
    <template v-else-if="detail">
      <header class="pd-head">
        <span class="pd-badge" :data-status="petition.status">{{ statusLabel(petition.status) }}</span>
        <h1>{{ petition.title }}</h1>
        <div class="pd-hero" data-testid="petition-supporters-hero">
          <strong>{{ NUM.format(petition.total_supporters || 0) }}</strong>
          <span>{{ t('petitions.supporters') }}</span>
        </div>
      </header>

      <section v-if="petition.objectives" class="pd-section">
        <h2>{{ t('petitions.about') }}</h2>
        <p class="pd-objectives">{{ petition.objectives }}</p>
        <a
          v-if="petition.support_link"
          :href="petition.support_link"
          target="_blank" rel="noopener"
          class="pd-external"
        >{{ t('petitions.official_page') }} ↗</a>
      </section>

      <section v-if="milestones.length" class="pd-section">
        <h2>{{ t('petitions.timeline') }}</h2>
        <ul class="pd-timeline">
          <li v-for="m in milestones" :key="m.label">
            <span class="pd-tl-date">{{ m.date }}</span> {{ m.label }}
          </li>
        </ul>
      </section>

      <section class="pd-section" data-testid="petition-legislation">
        <h2>{{ t('petitions.legislation') }}</h2>
        <template v-for="(bucket, rel) in buckets" :key="rel">
          <div v-if="bucket.length" class="pd-bucket">
            <h3>{{ t(`petitions.rel.${rel.toLowerCase()}`) }}</h3>
            <ul>
              <li v-for="a in bucket" :key="a.celex">
                <a :href="a.eurlex_url" target="_blank" rel="noopener">
                  {{ a.title_en || a.celex }}
                </a>
                <span class="pd-act-meta">{{ a.doc_type }} · {{ a.date }} · {{ a.celex }}</span>
              </li>
            </ul>
          </div>
        </template>
        <p v-if="unresolved.length" class="pd-unresolved" data-testid="unresolved-refs">
          {{ t('petitions.answer_documented') }}: {{ unresolved.join(', ') }}
        </p>
        <p
          v-if="!unresolved.length && !buckets.REGISTERED_BY.length
            && !buckets.ANSWERED_BY.length && !buckets.LED_TO.length"
          class="pd-none"
        >{{ t('petitions.no_legislation') }}</p>
      </section>

      <section v-if="organizers.length" class="pd-section">
        <h2>{{ t('petitions.organizers') }}</h2>
        <ul class="pd-organizers">
          <li v-for="o in organizers" :key="o.name">
            {{ o.name }} <span v-if="o.role" class="pd-role">{{ o.role }}</span>
          </li>
        </ul>
      </section>

      <section v-if="petition.funding_sponsor_count" class="pd-section">
        <h2>{{ t('petitions.funding') }}</h2>
        <p>
          {{ NUM.format(petition.funding_total_eur || 0) }} EUR ·
          {{ petition.funding_sponsor_count }} {{ t('petitions.sponsors') }}
        </p>
      </section>
    </template>
  </main>
</template>

<style scoped>
.petition-detail { max-width: 780px; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
.pd-head h1 { margin: 0.35rem 0; }
.pd-badge {
  text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.03em;
  border: 1px solid var(--border); border-radius: 6px; padding: 0.15rem 0.45rem;
}
.pd-badge[data-status="ANSWERED"] { border-color: var(--accent); color: var(--accent); }
.pd-hero { display: flex; align-items: baseline; gap: 0.5rem; margin: 0.5rem 0 0; }
.pd-hero strong { font-size: 2rem; font-variant-numeric: tabular-nums; }
.pd-hero span { opacity: 0.7; }
.pd-section { margin-top: 1.75rem; }
.pd-section h2 { font-size: 1.05rem; margin-bottom: 0.5rem; }
.pd-objectives { white-space: pre-line; line-height: 1.55; }
.pd-external { display: inline-block; margin-top: 0.5rem; color: var(--accent); }
.pd-timeline { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.pd-tl-date { font-variant-numeric: tabular-nums; opacity: 0.7; margin-right: 0.5rem; }
.pd-bucket h3 { font-size: 0.9rem; opacity: 0.8; margin: 0.75rem 0 0.3rem; }
.pd-bucket ul { margin: 0; padding-left: 1.1rem; }
.pd-act-meta { display: block; font-size: 0.8rem; opacity: 0.6; }
.pd-unresolved, .pd-none { opacity: 0.7; font-size: 0.9rem; margin-top: 0.6rem; }
.pd-organizers { list-style: none; padding: 0; margin: 0; }
.pd-role { opacity: 0.6; font-size: 0.82rem; text-transform: lowercase; }
.pd-error { color: #c0392b; }
</style>
