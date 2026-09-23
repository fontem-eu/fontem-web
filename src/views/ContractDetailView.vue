<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useBack } from '../composables/useBack.js'
import ThemeToggle from '../components/ThemeToggle.vue'
import { fmtEur, fmtMoney } from '../utils/format.js'
import { tedNoticeUrl } from '../utils/tedUrl.js'

const route = useRoute()
const { t, te } = useI18n()

// Back means back. Readers reach a contract from the feed, a briefing,
// a search or a shared link, and this used to send every one of them to
// /spending. When there is somewhere to return to we pop the history
// entry; when there is not — a shared link opened cold — /spending is
// still the honest destination, so it stays as the fallback.
const { goBack, cameFromApp } = useBack('/spending')

/**
 * Plain left-click goes back; anything the reader meant for a new tab
 * or window is left to the browser, which is why this stays an <a> with
 * a real href rather than becoming a button.
 */
function onBackClick(event) {
  if (event.defaultPrevented) return
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  goBack()
}

const noticeId = computed(() => route.params.noticeId)
const state = ref('loading')
const contract = ref(null)

// Which load is current. A reader who follows one contract to another before
// the first answers must not have the slower, older answer painted over the
// newer one.
let latestLoad = 0

async function load() {
  const mine = ++latestLoad
  state.value = 'loading'
  contract.value = null
  try {
    const res = await fetch(`/api/contracts/${encodeURIComponent(noticeId.value)}`)
    if (mine !== latestLoad) return
    if (res.status === 404) { state.value = 'notfound'; return }
    if (!res.ok) { state.value = 'error'; return }
    const body = await res.json()
    if (mine !== latestLoad) return
    contract.value = body
    state.value = 'ready'
  } catch {
    if (mine === latestLoad) state.value = 'error'
  }
}

onMounted(load)
// The view is reused when one contract links to another (only the kept-alive
// feeds are re-created per path; see viewKey), so a new notice id reloads.
watch(noticeId, (next, previous) => { if (next !== previous) load() })

const integrity = computed(() => contract.value?.integrity || {})
// The investigative red flags, in display order with human labels.
const flags = computed(() => {
  const i = integrity.value
  return [
    { key: 'is_single_bidder', label: 'contract_detail.single_bidder', on: i.is_single_bidder,
      hint: 'contract_detail.single_bidder_hint' },
    { key: 'is_non_open', label: 'contract_detail.non_open_procedure', on: i.is_non_open,
      hint: 'contract_detail.non_open_hint' },
    { key: 'is_no_call', label: 'contract_detail.no_call_for_bids', on: i.is_no_call,
      hint: 'contract_detail.no_call_hint' },
    { key: 'is_price_only', label: 'contract_detail.lowest_price_only', on: i.is_price_only,
      hint: 'contract_detail.price_only_hint' },
  ].filter((f) => f.on !== undefined && f.on !== null)
})
const redFlagCount = computed(() => integrity.value.integrity_red_flags ?? 0)

// The suppliers the notice named that the cleaning stage refused to
// mint a company for: the name field held a sentence, a web address, a
// placeholder (data-backlog Part 5, C2). Such a contract has no
// contractor to link, and an empty cell read as if the page had lost
// it. When these are the only trace of a supplier, the honest label is
// "not disclosed in the notice", with the published text kept as a
// pointer to where the real award lives.
const withheld = computed(() => (
  Array.isArray(contract.value?.suppliers_withheld)
    ? contract.value.suppliers_withheld.filter((w) => w && w.name_raw)
    : []
))
const supplierNotDisclosed = computed(
  () => !contract.value?.contractor && withheld.value.length > 0,
)
// One short explanation per cleaning rule id (`it.notice_text_in_
// supplier_name` -> contract.withheld_reason.it_notice_text_in_supplier
// _name). A rule this build has no words for still gets a truthful
// generic line rather than a raw id or a blank.
function withheldReason(reason) {
  const key = `contract.withheld_reason.${String(reason || '').replace(/\./g, '_')}`
  return te(key) ? t(key) : t('contract.withheld_reason.unknown')
}
// The framework agreement this award belongs to. The key behind it is
// eForms OPT-100 (efac:SettledContract/cac:NoticeDocumentReference/cbc:ID),
// which the framework-establishing notice and every call-off under it
// carry identically — a grouping key, not a pointer. ~80% of the time it
// names a call for competition, which this platform does not ingest, so
// the sibling list is other awards we happen to hold under the same key
// and nothing in the data ranks them. Every field may be missing on its
// own, so each is guarded separately and the panel degrades to nothing.
const framework = computed(() => contract.value?.framework || null)
// Capacity terms of the agreement, in display order. The value is
// pre-formatted here so the template does not have to fork per term.
const frameworkTerms = computed(() => {
  const f = framework.value
  if (!f) return []
  return [
    { key: 'max-value', label: 'contract.framework.max_value',
      value: f.max_value_eur != null ? fmtEur(f.max_value_eur) : null },
    { key: 'reestimated-value', label: 'contract.framework.reestimated_value',
      value: f.reestimated_value_eur != null ? fmtEur(f.reestimated_value_eur) : null },
    { key: 'duration', label: 'contract.framework.duration_months',
      value: f.duration_months != null ? String(f.duration_months) : null },
    { key: 'max-operators', label: 'contract.framework.max_operators',
      value: f.max_operators != null ? String(f.max_operators) : null },
  ].filter((term) => term.value !== null)
})
// A ceiling is what the agreement may buy, not what was paid. Wherever
// one of the two value terms is on screen the caption saying so goes
// with it, or a reader adds it to spend.
const showsFrameworkCeiling = computed(
  () => framework.value != null
    && (framework.value.max_value_eur != null || framework.value.reestimated_value_eur != null),
)
const frameworkSiblingCount = computed(() => framework.value?.sibling_count ?? 0)
const frameworkSiblings = computed(() => framework.value?.siblings || [])
// The API returns at most ten; say how many were left out rather than
// letting the list pass for the whole cluster (the largest real one has
// 148 award notices).
const frameworkSiblingsHidden = computed(
  () => Math.max(0, frameworkSiblingCount.value - frameworkSiblings.value.length),
)
// A contract flagged as framework but with no published key and no terms
// has nothing to show, and "no framework" would be a lie for every
// pre-2024 notice, which carries no key at all. Show nothing instead.
const showFramework = computed(() => (
  framework.value != null
  && (frameworkTerms.value.length > 0
    || !!framework.value.ted_url
    || frameworkSiblingCount.value >= 1)
))

const tedHref = computed(() => contract.value && tedNoticeUrl(contract.value))
</script>

<template>
  <main class="contract-detail" data-testid="contract-detail-view">
    <header class="cd-head">
      <a
        href="/spending"
        class="cd-back"
        data-testid="contract-back"
        @click="onBackClick"
      >&larr; {{ cameFromApp ? $t('contract_detail.back') : $t('contract_detail.public_spending') }}</a>
      <ThemeToggle />
    </header>

    <p v-if="state === 'loading'" class="cd-state">{{ $t('contract_detail.loading') }}</p>
    <p v-else-if="state === 'notfound'" class="cd-state" data-testid="contract-notfound">
      {{ $t('contract_detail.contract_not_found') }}
    </p>
    <p v-else-if="state === 'error'" class="cd-state">{{ $t('contract_detail.couldnt_load_this_contract') }}</p>

    <article v-else-if="state === 'ready'" data-testid="contract-detail">
      <div class="cd-titlerow">
        <h1 class="cd-title">{{ contract.title || $t('contract_detail.untitled_contract') }}</h1>
        <!-- Deliberately beside the title and not in .cd-flags below:
             that list is the red-flag row and a framework agreement is a
             procurement instrument, not a risk. The wording is "part of"
             because is_framework (the lot's ContractingSystemTypeCode
             starting `fa`) is carried by establishing notices and
             call-offs alike — 344 of 351 sampled call-offs have it — so
             the data cannot say which this one is. -->
        <span
          v-if="integrity.is_framework"
          class="badge badge-tag cd-fw-badge"
          data-testid="framework-badge"
          :title="$t('contract.framework.badge_hint')"
        >{{ $t('contract.framework.badge') }}</span>
      </div>

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
              :data-testid="`flag-${f.key}`" :title="$t(f.hint)">
            <span class="dot" :class="{ on: f.on }"></span>{{ $t(f.label) }}
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
        <dt>{{ $t('contract_detail.buyer') }}</dt>
        <dd>
          <!-- Linked on the same terms as the supplier below: only when
               the record carries an id, so a buyer we cannot resolve
               stays plain text rather than offering a dead click. -->
          <RouterLink
            v-if="contract.authority?.authority_id"
            :to="`/authority/${contract.authority.authority_id}`"
            data-testid="contract-authority-link"
          >{{ contract.authority.name }}</RouterLink>
          <span v-else>{{ contract.authority?.name }}</span>
          <template v-if="contract.authority?.country"> ({{ contract.authority.country }})</template>
        </dd>
        <dt>{{ $t('contract_detail.contractor') }}</dt>
        <dd>
          <RouterLink
v-if="contract.contractor?.gmr_id"
            :to="`/company/${contract.contractor.gmr_id}`">{{ contract.contractor.name }}</RouterLink>
          <span v-else-if="contract.contractor">{{ contract.contractor.name }}</span>
          <!-- No company, but the notice did put something in the name
               field: say so, and let the reader see exactly what was
               published and why it was not taken for a name. -->
          <details
            v-else-if="supplierNotDisclosed"
            class="cd-withheld"
            data-testid="supplier-not-disclosed"
          >
            <summary :title="withheld[0].name_raw">{{ $t('contract.supplier_not_disclosed') }}</summary>
            <p class="cd-note">{{ $t('contract.supplier_not_disclosed_note') }}</p>
            <ul class="cd-withheld-list">
              <li v-for="(w, i) in withheld" :key="i" :data-testid="`withheld-supplier-${i}`">
                <span class="cd-withheld-why">{{ withheldReason(w.reason) }}</span>
                <blockquote class="cd-withheld-raw">{{ w.name_raw }}</blockquote>
              </li>
            </ul>
          </details>
          <span v-else>—</span>
        </dd>
        <dt>CPV</dt><dd>{{ contract.cpv_main || '—' }}</dd>
        <dt>{{ $t('contract_detail.award_date') }}</dt><dd>{{ contract.award_date || '—' }}</dd>
      </dl>

      <section v-if="showFramework" class="cd-framework" data-testid="framework-panel">
        <h2 class="cd-fw-head">{{ $t('contract.framework.heading') }}</h2>
        <dl v-if="frameworkTerms.length" class="cd-facts cd-fw-facts">
          <template v-for="term in frameworkTerms" :key="term.key">
            <dt>{{ $t(term.label) }}</dt>
            <dd :data-testid="`framework-${term.key}`">{{ term.value }}</dd>
          </template>
        </dl>
        <p v-if="showsFrameworkCeiling" class="cd-note">{{ $t('contract.framework.ceiling_note') }}</p>

        <a
v-if="framework.ted_url" :href="framework.ted_url"
           target="_blank" rel="noopener noreferrer"
           class="cd-ted cd-fw-ted" data-testid="framework-ted-link">
          {{ $t('contract.framework.ted_link') }}<template
            v-if="framework.framework_id"> ({{ framework.framework_id }})</template> &nearr;
        </a>

        <template v-if="frameworkSiblingCount >= 1">
          <h3 class="cd-fw-sub">
            {{ $t('contract.framework.siblings_heading', { n: frameworkSiblingCount }) }}
          </h3>
          <ul class="cd-fw-siblings" data-testid="framework-siblings">
            <li
v-for="(sib, i) in frameworkSiblings" :key="sib.ted_notice_id || i"
                :data-testid="`framework-sibling-${i}`">
              <!-- Linked only when there is somewhere to link to, like
                   every other contract link in the app: a row without a
                   notice id would otherwise be a click to /contract/undefined. -->
              <RouterLink
                v-if="sib.ted_notice_id"
                :to="`/contract/${sib.ted_notice_id}`"
              >{{ sib.title || $t('contract_detail.untitled_contract') }}</RouterLink>
              <span v-else>{{ sib.title || $t('contract_detail.untitled_contract') }}</span>
              <span class="cd-fw-meta">
                <span v-if="sib.supplier">{{ sib.supplier }}</span>
                <span v-if="sib.country">{{ sib.country }}</span>
                <span v-if="sib.value_eur != null">{{ fmtEur(sib.value_eur) }}</span>
                <span v-if="sib.publication_date">{{ String(sib.publication_date).substring(0, 10) }}</span>
              </span>
            </li>
          </ul>
          <p
v-if="frameworkSiblingsHidden > 0" class="cd-note"
             data-testid="framework-siblings-more">
            {{ $t('contract.framework.siblings_more', { n: frameworkSiblingsHidden }) }}
          </p>
          <p class="cd-note">{{ $t('contract.framework.siblings_note') }}</p>
        </template>
      </section>

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
.cd-titlerow { display: flex; flex-wrap: wrap; align-items: baseline; gap: .5rem; margin-bottom: 1rem; }
.cd-title { font-size: 1.4rem; margin: 0; }
.cd-fw-badge { border-radius: 999px; }
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
.cd-framework { border: 1px solid var(--border, #e5e7eb); border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem; }
.cd-fw-head { font-size: 1rem; font-weight: 700; margin: 0 0 .6rem; }
.cd-fw-facts { margin-bottom: 0; }
.cd-fw-ted { margin-top: .75rem; }
.cd-fw-sub { font-size: .9rem; font-weight: 700; margin: 1rem 0 .4rem; }
.cd-fw-siblings { list-style: none; padding: 0; margin: 0; }
.cd-fw-siblings li { padding: .35rem 0; border-top: 1px solid var(--border, #e5e7eb); }
.cd-fw-siblings a { color: var(--accent, #2563eb); text-decoration: none; }
.cd-fw-meta { display: flex; flex-wrap: wrap; gap: .5rem; font-size: .8rem; color: var(--muted, #6b7280); }
.cd-withheld > summary { cursor: pointer; color: var(--muted, #6b7280); font-style: italic; }
.cd-withheld-list { list-style: none; padding: 0; margin: .35rem 0 0; }
.cd-withheld-why { font-size: .8rem; color: var(--muted, #6b7280); }
.cd-withheld-raw { margin: .15rem 0 .5rem; padding: .35rem .6rem; border-left: 3px solid var(--border, #e5e7eb); font-size: .9rem; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
