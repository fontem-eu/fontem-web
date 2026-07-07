<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import ThemeToggle from '../components/ThemeToggle.vue'
import { fmtMoney } from '../utils/format.js'
import { tedNoticeUrl } from '../utils/tedUrl.js'

const route = useRoute()
const noticeId = computed(() => route.params.noticeId)
const state = ref('loading')
const contract = ref(null)

onMounted(async () => {
  try {
    const res = await fetch(`/api/contracts/${encodeURIComponent(noticeId.value)}`)
    if (res.status === 404) { state.value = 'notfound'; return }
    if (!res.ok) { state.value = 'error'; return }
    contract.value = await res.json()
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
})

const integrity = computed(() => contract.value?.integrity || {})
// The investigative red flags, in display order with human labels.
const flags = computed(() => {
  const i = integrity.value
  return [
    { key: 'is_single_bidder', label: 'Single bidder', on: i.is_single_bidder,
      hint: 'Only one tender received — the EC Single Market Scoreboard headline risk.' },
    { key: 'is_non_open', label: 'Non-open procedure', on: i.is_non_open,
      hint: 'Awarded without a fully open competition.' },
    { key: 'is_no_call', label: 'No call for bids', on: i.is_no_call,
      hint: 'Direct-ish award with no public call.' },
    { key: 'is_price_only', label: 'Lowest-price only', on: i.is_price_only,
      hint: 'No quality criteria — price was the sole award criterion.' },
  ].filter((f) => f.on !== undefined && f.on !== null)
})
const redFlagCount = computed(() => integrity.value.integrity_red_flags ?? 0)
const tedHref = computed(() => contract.value && tedNoticeUrl(contract.value))
</script>

<template>
  <main class="contract-detail" data-testid="contract-detail-view">
    <header class="cd-head">
      <RouterLink to="/spending" class="cd-back">&larr; {{ $t('contract_detail.public_spending') }}</RouterLink>
      <ThemeToggle />
    </header>

    <p v-if="state === 'loading'" class="cd-state">{{ $t('contract_detail.loading') }}</p>
    <p v-else-if="state === 'notfound'" class="cd-state" data-testid="contract-notfound">
      {{ $t('contract_detail.contract_not_found') }}
    </p>
    <p v-else-if="state === 'error'" class="cd-state">{{ $t('contract_detail.couldnt_load_this_contract') }}</p>

    <article v-else-if="state === 'ready'" data-testid="contract-detail">
      <h1 class="cd-title">{{ contract.title || $t('contract_detail.untitled_contract') }}</h1>

      <!-- Integrity profile — the investigative lede -->
      <section class="cd-integrity" data-testid="integrity-profile">
        <div
class="cd-flagcount" :class="{ alert: redFlagCount > 0 }"
             data-testid="red-flag-count">
          {{ redFlagCount }} {{ $t('contract_detail.red_flag') }}{{ redFlagCount === 1 ? '' : 's' }}
        </div>
        <ul class="cd-flags">
          <li
v-for="f in flags" :key="f.key" :class="{ on: f.on }"
              :data-testid="`flag-${f.key}`" :title="f.hint">
            <span class="dot" :class="{ on: f.on }"></span>{{ f.label }}
          </li>
          <li
v-if="integrity.tenders_received != null"
              data-testid="bidder-count">{{ integrity.tenders_received }} {{ $t('contract_detail.bidder_s') }}</li>
        </ul>
        <p class="cd-note">
          {{ $t('contract_detail.risk_indicators_note') }}
        </p>
      </section>

      <dl class="cd-facts">
        <dt>{{ $t('contract_detail.value') }}</dt><dd>{{ fmtMoney(contract.value_eur) }}</dd>
        <dt>{{ $t('contract_detail.procedure') }}</dt><dd>{{ integrity.procedure_type || '—' }}</dd>
        <dt>{{ $t('contract_detail.award_criteria') }}</dt><dd>{{ integrity.award_criterion_type || '—' }}</dd>
        <dt>{{ $t('contract_detail.eu_funded') }}</dt><dd>{{ integrity.eu_funded ? $t('contract_detail.yes') : '—' }}</dd>
        <dt>{{ $t('contract_detail.buyer') }}</dt><dd>{{ contract.authority?.name }} ({{ contract.authority?.country }})</dd>
        <dt>{{ $t('contract_detail.contractor') }}</dt>
        <dd>
          <RouterLink
v-if="contract.contractor?.gmr_id"
            :to="`/company/${contract.contractor.gmr_id}`">{{ contract.contractor.name }}</RouterLink>
          <span v-else>{{ contract.contractor?.name }}</span>
        </dd>
        <dt>CPV</dt><dd>{{ contract.cpv_main || '—' }}</dd>
        <dt>{{ $t('contract_detail.award_date') }}</dt><dd>{{ contract.award_date || '—' }}</dd>
      </dl>

      <!-- The outward link to the original TED notice -->
      <a
v-if="tedHref" :href="tedHref" target="_blank" rel="noopener noreferrer"
         class="cd-ted" data-testid="ted-outlink">
        {{ $t('contract_detail.view_original_notice_on_ted') }} &nearr;
      </a>
    </article>
  </main>
</template>

<style scoped>
.contract-detail { max-width: 760px; margin: 0 auto; padding: 1.5rem 1rem; }
.cd-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.cd-back { color: var(--accent, #2563eb); text-decoration: none; }
.cd-state { color: var(--muted, #6b7280); padding: 2rem 0; }
.cd-title { font-size: 1.4rem; margin: 0 0 1rem; }
.cd-integrity { border: 1px solid var(--border, #e5e7eb); border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem; }
.cd-flagcount { font-weight: 700; }
.cd-flagcount.alert { color: #b91c1c; }
.cd-flags { list-style: none; padding: 0; margin: .5rem 0; display: flex; flex-wrap: wrap; gap: .5rem 1rem; }
.cd-flags li { display: flex; align-items: center; gap: .4rem; color: var(--muted, #6b7280); }
.cd-flags li.on { color: #b45309; font-weight: 600; }
.dot { width: .6rem; height: .6rem; border-radius: 50%; background: var(--border, #d1d5db); }
.dot.on { background: #b45309; }
.cd-note { font-size: .8rem; color: var(--muted, #6b7280); margin: .5rem 0 0; }
.cd-facts { display: grid; grid-template-columns: max-content 1fr; gap: .35rem 1rem; margin-bottom: 1.25rem; }
.cd-facts dt { color: var(--muted, #6b7280); }
.cd-ted { display: inline-block; color: var(--accent, #2563eb); text-decoration: none; font-weight: 600; }
</style>
