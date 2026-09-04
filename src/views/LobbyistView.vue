<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { getLobbyist } from '../api/lobbyists.js'
import { fmtMoney } from '../utils/format.js'

const route = useRoute()
const disclosureId = computed(() => route.params.disclosureId)
const state = ref('loading')
const lobbyist = ref(null)

onMounted(async () => {
  try {
    lobbyist.value = await getLobbyist(disclosureId.value)
    state.value = 'ready'
  } catch (err) {
    state.value = /HTTP 404/.test(err.message) ? 'notfound' : 'error'
  }
})

/**
 * The register records a BAND, not a figure, and often only one end of
 * it. Rendering both ends where they are known, and one where only one
 * is, keeps the page as precise as the source and no more.
 *
 * Exact figures, not the compact default. The register's bands are
 * contiguous — 10,000–24,999, then 25,000–49,999 — so abbreviating
 * rounds 24,999 to "€25K" and makes the top of one band read as the
 * bottom of the next.
 */
const MONEY = { compact: false, decimals: 0 }

const spend = computed(() => {
  const s = lobbyist.value?.declared_spend
  if (!s) return null
  const lo = s.min_eur == null ? null : fmtMoney(s.min_eur, s.currency, MONEY)
  const hi = s.max_eur == null ? null : fmtMoney(s.max_eur, s.currency, MONEY)
  if (lo && hi) return `${lo} – ${hi}`
  return lo || hi
})

/** Rows that are simply label + value, skipped when the value is absent. */
const facts = computed(() => {
  const l = lobbyist.value
  if (!l) return []
  return [
    { key: 'category', label: 'lobbyist.category', value: l.category },
    { key: 'entity_form', label: 'lobbyist.entity_form', value: l.entity_form },
    { key: 'country', label: 'data_quality.country', value: l.country },
    { key: 'city', label: 'lobbyist.city', value: l.city },
    { key: 'spend', label: 'lobbyist.declared_spend', value: spend.value },
    { key: 'members', label: 'lobbyist.members_fte', value: l.members_fte },
    { key: 'registered', label: 'lobbyist.registered_on', value: l.registered_on },
    { key: 'updated', label: 'lobbyist.last_updated', value: l.last_updated },
  ].filter((f) => f.value !== null && f.value !== undefined && f.value !== '')
})
</script>

<template>
  <main class="lobbyist" data-testid="lobbyist-view">
    <p v-if="state === 'loading'" class="lb-msg">{{ $t('app.loading') }}</p>
    <p v-else-if="state === 'notfound'" class="lb-msg" data-testid="lobbyist-not-found">
      {{ $t('lobbyist.not_found') }}
    </p>
    <p v-else-if="state === 'error'" class="lb-msg lb-error" data-testid="lobbyist-error">
      {{ $t('lobbyist.not_found') }}
    </p>

    <template v-else>
      <p class="lb-eyebrow">{{ $t('lobbyist.lobbyist') }}</p>
      <h1 class="lb-name" data-testid="lobbyist-name">
        {{ lobbyist.name }}
        <span v-if="lobbyist.acronym" class="lb-acronym">({{ lobbyist.acronym }})</span>
      </h1>
      <p class="lb-id">
        {{ lobbyist.disclosure_id }}
        <span
          v-if="lobbyist.active !== null && lobbyist.active !== undefined"
          class="lb-chip"
        >{{ lobbyist.active ? $t('ticker_card.active') : $t('ticker_card.inactive') }}</span>
      </p>

      <dl v-if="facts.length" class="lb-facts" data-testid="lobbyist-facts">
        <template v-for="f in facts" :key="f.key">
          <dt>{{ $t(f.label) }}</dt>
          <dd :data-testid="`lobbyist-fact-${f.key}`">{{ f.value }}</dd>
        </template>
      </dl>

      <!-- Who filed this declaration. Most registrants resolve to
           nothing we hold, so the empty case is stated rather than
           hidden — a reader should be able to tell "no link recorded"
           from "we did not look". -->
      <section class="lb-section" data-testid="lobbyist-filed-for">
        <h2>{{ $t('lobbyist.filed_for') }}</h2>
        <ul v-if="lobbyist.filed_for.length" class="lb-filers">
          <li v-for="f in lobbyist.filed_for" :key="f.name">
            <router-link v-if="f.profile" :to="f.profile" data-testid="lobbyist-filer-link">
              {{ f.name }}
            </router-link>
            <span v-else>{{ f.name }}</span>
          </li>
        </ul>
        <p v-else class="lb-empty">{{ $t('lobbyist.no_filers') }}</p>
      </section>

      <section v-if="lobbyist.goals" class="lb-section">
        <h2>{{ $t('lobbyist.goals') }}</h2>
        <p class="lb-prose">{{ lobbyist.goals }}</p>
      </section>

      <section v-if="lobbyist.interests" class="lb-section">
        <h2>{{ $t('lobbyist.interests') }}</h2>
        <p class="lb-prose">{{ lobbyist.interests }}</p>
      </section>

      <p class="lb-links">
        <a
          v-if="lobbyist.website"
          :href="lobbyist.website"
          target="_blank"
          rel="noopener noreferrer nofollow"
          data-testid="lobbyist-website"
        >{{ $t('lobbyist.website') }}</a>
        <a
          v-if="lobbyist.register_url"
          :href="lobbyist.register_url"
          target="_blank"
          rel="noopener noreferrer nofollow"
          data-testid="lobbyist-register"
        >{{ $t('lobbyist.register_entry') }}</a>
      </p>
    </template>
  </main>
</template>

<style scoped>
.lobbyist { max-width: 52rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
.lb-msg { color: var(--muted); padding: 2rem 0; }
.lb-error { color: #dc2626; }
.lb-eyebrow {
  text-transform: uppercase; letter-spacing: 0.08em;
  font-size: 0.75rem; color: var(--muted); margin: 0 0 0.25rem;
}
.lb-name { font-size: 1.6rem; line-height: 1.25; margin: 0 0 0.35rem; }
.lb-acronym { color: var(--muted); font-weight: 400; }
.lb-id { font-size: 0.8rem; color: var(--muted); margin: 0 0 1.5rem; }
.lb-chip {
  margin-left: 0.5rem; padding: 0.1rem 0.45rem; border-radius: 999px;
  background: var(--surface-2, rgba(127, 127, 127, 0.15)); font-size: 0.72rem;
}
.lb-facts {
  display: grid; grid-template-columns: max-content 1fr;
  gap: 0.4rem 1.25rem; margin: 0 0 1.75rem;
}
.lb-facts dt { color: var(--muted); font-size: 0.85rem; }
.lb-facts dd { margin: 0; }
.lb-section { margin: 0 0 1.75rem; }
.lb-section h2 { font-size: 1rem; margin: 0 0 0.5rem; }
.lb-filers { list-style: none; margin: 0; padding: 0; }
.lb-filers li { padding: 0.2rem 0; }
.lb-empty { color: var(--muted); margin: 0; }
.lb-prose { margin: 0; white-space: pre-wrap; }
.lb-links { display: flex; gap: 1.25rem; flex-wrap: wrap; }
</style>
