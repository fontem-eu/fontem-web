<script setup>
/**
 * A contracting authority: who they are, and what they have awarded.
 *
 * Built so the authority sitemap shards can be advertised. They exist in
 * fontem-api already but stayed out of the index because there was no
 * page here to land on — the SPA catch-all answered 200 with a
 * not-found view, which would have made ~16,000 sitemap entries into
 * ~16,000 soft-404s.
 *
 * A real id that is not in the graph is a genuine 404 for the same
 * reason: `state = 'missing'` renders as not-found rather than as an
 * empty authority, so a crawler is told the page is absent instead of
 * being handed a plausible blank.
 */
import { ref, onMounted, onServerPrefetch, computed } from 'vue'
import { useRoute } from 'vue-router'
import ThemeToggle from '../components/ThemeToggle.vue'
import { fmtMoney } from '../utils/format.js'
import { apiOrigin } from '../api/_origin.js'

const route = useRoute()
const authorityId = computed(() => route.params.authority_id)

const state = ref('loading')
const profile = ref(null)

async function load() {
  try {
    const res = await fetch(
      `${apiOrigin()}/api/authorities/${encodeURIComponent(authorityId.value)}`)
    if (res.status === 404) { state.value = 'missing'; return }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    profile.value = await res.json()
    state.value = 'done'
  } catch {
    state.value = 'error'
  }
}

// Server-side too: onMounted does not run under renderToString, and a
// crawler that executes no JavaScript would otherwise get an empty
// shell on a URL the sitemap advertises.
onServerPrefetch(load)

onMounted(async () => {
  document.title = `${profile.value?.authority_name || authorityId.value} | Fontem`
  if (profile.value) return
  await load()
  document.title = `${profile.value?.authority_name || authorityId.value} | Fontem`
})

const contracts = computed(() => profile.value?.recent_contracts || [])
</script>

<template>
  <div class="ap">
    <header class="ap-header">
      <div>
        <router-link to="/" class="ap-back">{{ $t('nav.back_home') }}</router-link>
        <h1 v-if="profile">{{ profile.authority_name || authorityId }}</h1>
        <h1 v-else>{{ $t('authority_profile.authority_profile') }}</h1>
        <div v-if="profile" class="ap-meta">
          <span v-if="profile.country" class="ap-tag">{{ profile.country }}</span>
          <span v-if="profile.contract_count" class="ap-tag">
            {{ profile.contract_count.toLocaleString() }} contracts
          </span>
          <span v-if="profile.total_spend_eur" class="ap-tag">
            {{ fmtMoney(profile.total_spend_eur) }} EUR
          </span>
        </div>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="state === 'loading'" class="ap-msg">
      {{ $t('authority_profile.loading_authority_profile') }}
    </div>
    <div v-else-if="state === 'missing' || state === 'error'" class="ap-msg">
      {{ $t('authority_profile.authority_not_found') }}
    </div>

    <div v-else-if="profile">
      <h2 class="ap-section">{{ $t('app.eu_public_procurement') }}</h2>
      <p v-if="!contracts.length" class="ap-msg">
        {{ $t('authority_profile.no_contracts') }}
      </p>
      <ul v-else class="ap-contracts" data-testid="authority-contracts">
        <li v-for="c in contracts" :key="c.ted_notice_id" class="ap-contract">
          <router-link :to="`/contract/${c.ted_notice_id}`" class="ap-contract-title">
            {{ c.title }}
          </router-link>
          <div class="ap-contract-meta">
            <span v-if="c.value_eur">{{ fmtMoney(c.value_eur) }} EUR</span>
            <span v-if="c.publication_date">{{ c.publication_date }}</span>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.ap { max-width: 1100px; margin: 0 auto; padding: 0 1rem 4rem; }
.ap-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border);
  margin-bottom: 1.5rem;
}
.ap-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0.3rem 0 0; }
.ap-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.ap-back:hover { text-decoration: underline; }
.ap-meta { display: flex; gap: 0.5rem; margin-top: 0.4rem; flex-wrap: wrap; }
.ap-tag {
  font-size: 0.75rem; padding: 0.15rem 0.5rem;
  background: var(--surface, #f6f8fa);
  border: 1px solid var(--border);
  border-radius: 4px; color: var(--muted);
}
.ap-msg { text-align: center; padding: 4rem 1rem; color: var(--muted); }
.ap-section {
  font-size: 0.9rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--muted); margin: 2rem 0 0.75rem;
}
.ap-contracts { list-style: none; padding: 0; margin: 0; }
.ap-contract {
  padding: 0.75rem 0; border-bottom: 1px solid var(--border);
}
.ap-contract-title { color: var(--accent); text-decoration: none; font-weight: 600; }
.ap-contract-title:hover { text-decoration: underline; }
.ap-contract-meta {
  display: flex; gap: 1rem; margin-top: 0.25rem;
  font-size: 0.8rem; color: var(--muted);
}
</style>
