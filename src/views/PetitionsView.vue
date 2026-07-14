<script setup>
/**
 * Petitions list — first-class civic data, same level as data stories.
 * Status filter chips are driven by the backend's per-status counts, so
 * the vocabulary always matches what the register actually contains.
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { fetchPetitions } from '../api/petitions.js'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const counts = ref({})
const results = ref([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

const activeStatus = computed(() => route.query.status || '')

const NUM = new Intl.NumberFormat()

const statuses = computed(() =>
  Object.entries(counts.value).sort((a, b) => b[1] - a[1]))

function statusLabel(s) {
  const key = `petitions.status.${s.toLowerCase()}`
  const label = t(key)
  return label === key ? s : label
}

function setStatus(s) {
  router.push({ path: '/petitions', query: s ? { status: s } : {} })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await fetchPetitions({ status: activeStatus.value || undefined })
    counts.value = data.counts || {}
    results.value = data.results || []
    total.value = data.total || 0
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}

watch(() => route.query.status, load)
onMounted(load)
</script>

<template>
  <main class="petitions-view" data-testid="petitions-view">
    <header class="pt-head">
      <h1>{{ t('petitions.title') }}</h1>
      <p class="pt-sub">{{ t('petitions.subtitle') }}</p>
    </header>

    <div class="pt-filters" data-testid="petitions-filters">
      <button
        type="button"
        class="pt-chip"
        :class="{ 'pt-chip--on': !activeStatus }"
        data-testid="filter-all"
        @click="setStatus('')"
      >{{ t('petitions.all') }} <span class="pt-count">{{ NUM.format(total) }}</span></button>
      <button
        v-for="[s, n] in statuses"
        :key="s"
        type="button"
        class="pt-chip"
        :class="{ 'pt-chip--on': activeStatus === s }"
        :data-testid="`filter-${s}`"
        @click="setStatus(s)"
      >{{ statusLabel(s) }} <span class="pt-count">{{ NUM.format(n) }}</span></button>
    </div>

    <p v-if="error" class="pt-error" data-testid="petitions-error">{{ error }}</p>
    <p v-else-if="loading && !results.length" class="pt-status">{{ t('petitions.loading') }}</p>
    <p v-else-if="!results.length" class="pt-status" data-testid="petitions-empty">
      {{ t('petitions.empty') }}
    </p>

    <ul class="pt-list">
      <li v-for="r in results" :key="r.petition_id" class="pt-card" data-testid="petition-card">
        <RouterLink
          class="pt-title"
          :to="`/petitions/${encodeURIComponent(r.petition_id)}`"
        >{{ r.title || r.petition_id }}</RouterLink>
        <div class="pt-meta">
          <span class="pt-badge" :data-status="r.status">{{ statusLabel(r.status) }}</span>
          <span class="pt-supporters" data-testid="petition-supporters">
            {{ NUM.format(r.total_supporters || 0) }} {{ t('petitions.supporters') }}
          </span>
          <span v-if="r.registration_date" class="pt-date">{{ r.registration_date }}</span>
        </div>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.petitions-view { max-width: 900px; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
.pt-head h1 { margin: 0 0 0.25rem; }
.pt-sub { color: var(--text); opacity: 0.7; margin: 0 0 1rem; }
.pt-filters { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1rem; }
.pt-chip {
  border: 1px solid var(--border); border-radius: 999px; background: none;
  color: var(--text); padding: 0.3rem 0.75rem; cursor: pointer; font-size: 0.85rem;
}
.pt-chip--on { background: var(--accent); color: #fff; border-color: var(--accent); }
.pt-count { opacity: 0.65; font-variant-numeric: tabular-nums; margin-left: 0.25rem; }
.pt-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.pt-card { border: 1px solid var(--border); border-radius: 10px; padding: 0.85rem; background: var(--surface, transparent); }
.pt-title { font-weight: 600; color: var(--text); text-decoration: none; }
.pt-title:hover { color: var(--accent); text-decoration: underline; }
.pt-meta { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.4rem; font-size: 0.85rem; align-items: center; }
.pt-badge {
  text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.03em;
  border: 1px solid var(--border); border-radius: 6px; padding: 0.1rem 0.4rem; opacity: 0.85;
}
.pt-badge[data-status="ANSWERED"] { border-color: var(--accent); color: var(--accent); }
.pt-supporters { font-variant-numeric: tabular-nums; }
.pt-date, .pt-status { opacity: 0.65; }
.pt-error { color: #c0392b; }
</style>
