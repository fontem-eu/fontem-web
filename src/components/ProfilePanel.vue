<script setup>
import { ref, watch, computed } from 'vue'
import ContractsPanel from './ContractsPanel.vue'
import PocketButton from './PocketButton.vue'
import { fmtMoney } from '../utils/format.js'

const props = defineProps({
  symbol: { type: String, required: true },
  data: { type: Object, default: null },
  gmrId: { type: String, default: null },
  companyName: { type: String, default: null },
})

const pocketConfig = computed(() => ({ entityId: props.gmrId || props.symbol }))
const pocketName = computed(() => `${props.companyName || props.symbol} — Profile`)
const rootRef = ref(null)
const captureTarget = () => rootRef.value

const profile = ref(null)
const profileState = ref('loading')
const groupExpanded = ref(false)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function loadProfile(id) {
  if (!id) {
    profileState.value = 'none'
    return
  }
  profileState.value = 'loading'
  try {
    const res = await fetch(`/api/companies/${encodeURIComponent(id)}`)
    if (!res.ok) {
      profileState.value = 'none'
      return
    }
    profile.value = await res.json()
    profileState.value = 'done'
  } catch {
    profileState.value = 'none'
  }
}

watch(() => props.gmrId, (id) => { if (id) loadProfile(id) }, { immediate: true })
// Also try with symbol if it's a UUID
watch(() => props.symbol, (sym) => {
  if (!props.gmrId && UUID_RE.test(sym)) loadProfile(sym)
}, { immediate: true })
</script>

<template>
  <div ref="rootRef" class="profile-panel" data-testid="profile-panel">
    <!-- Company info card -->
    <div class="pp-header">
      <div class="pp-header-top">
        <h2 class="pp-name">{{ companyName || profile?.company_name || symbol }}</h2>
        <PocketButton
          widget-type="entity_profile"
          :config="pocketConfig"
          :default-name="pocketName"
          :capture-target="captureTarget"
        />
      </div>
      <div class="pp-meta">
        <span v-if="data?.data_source" class="pp-tag">{{ data.data_source.toUpperCase() }}</span>
        <span v-if="profile?.country" class="pp-tag">{{ profile.country }}</span>
        <span v-if="data?.ticker && !UUID_RE.test(data.ticker)" class="pp-tag pp-tag--accent">{{ data.ticker }}</span>
      </div>
    </div>

    <!-- Financial snapshot (if available from parent data) -->
    <div v-if="data?.ratios_summary" class="pp-section">
      <h3>{{ $t('profile.financial_overview') }}</h3>
      <div class="pp-stats">
        <div v-if="data.market_snapshot?.current_price" class="pp-stat">
          <span class="pp-stat__num">{{ fmtMoney(data.market_snapshot.current_price) }}</span>
          <span class="pp-stat__label">{{ $t('profile.current_price') }}</span>
        </div>
        <div v-if="data.market_snapshot?.market_cap" class="pp-stat">
          <span class="pp-stat__num">{{ fmtMoney(data.market_snapshot.market_cap) }}</span>
          <span class="pp-stat__label">{{ $t('profile.market_cap') }}</span>
        </div>
        <div v-if="data.ratios_summary?.avg_roe" class="pp-stat">
          <span class="pp-stat__num">{{ data.ratios_summary.avg_roe.toFixed(1) }}%</span>
          <span class="pp-stat__label">{{ $t('profile.avg_roe') }}</span>
        </div>
        <div v-if="data.ratios_summary?.avg_npm" class="pp-stat">
          <span class="pp-stat__num">{{ data.ratios_summary.avg_npm.toFixed(1) }}%</span>
          <span class="pp-stat__label">{{ $t('profile.avg_net_margin') }}</span>
        </div>
      </div>
    </div>

    <!-- Corporate Group -->
    <div v-if="profile?.group" class="pp-section">
      <h3>{{ $t('profile.corporate_group') }}</h3>
      <p class="pp-group-header">{{ $t('profile.part_of') }}<strong>{{ profile.group.root_name }}</strong>
        ({{ profile.group.entity_count }} {{ $t('profile_panel.entities') }})
      </p>
      <div class="pp-group-tree">
        <div
          v-for="m in (groupExpanded ? profile.group.members : profile.group.members.slice(0, 10))"
          :key="m.gmr_id"
          class="pp-group-member"
          :class="{ 'pp-group-member--current': m.gmr_id === gmrId }"
        >
          <router-link :to="`/company/${m.gmr_id}`" class="pp-group-link">
            {{ m.name }}
          </router-link>
          <span class="pp-group-country">{{ m.country }}</span>
          <span v-if="m.contracts > 0" class="pp-group-contracts">{{ m.contracts }} {{ $t('profile_panel.contracts') }}</span>
        </div>
        <button
          v-if="!groupExpanded && profile.group.members.length > 10"
          class="pp-group-expand"
          @click="groupExpanded = true"
        >
          {{ $t('profile_panel.show_all') }} {{ profile.group.members.length }} {{ $t('profile_panel.entities') }}
        </button>
      </div>
    </div>

    <!-- Directors (from Neo4j Person nodes) -->
    <div v-if="profile?.directors?.length" class="pp-section">
      <h3>{{ $t('profile.directors_amp_officers') }}</h3>
      <div class="pp-directors">
        <div v-for="d in profile.directors" :key="d.person_id" class="pp-director">
          <span class="pp-director__name">{{ d.first_name }} {{ d.name }}</span>
          <span class="pp-director__role">{{ d.role }}</span>
          <span v-if="d.current === false" class="pp-director__former">{{ $t('profile_panel.former') }}</span>
        </div>
      </div>
    </div>

    <!-- Procurement data (always shown) -->
    <div class="pp-section">
      <h3>{{ $t('app.eu_public_procurement') }}</h3>
      <div v-if="profile && profile.contract_count > 0" class="pp-procurement-summary">
        <span class="pp-stat__num">{{ profile.contract_count.toLocaleString() }} {{ $t('profile_panel.contracts') }}</span>
        <span> &middot; </span>
        <span class="pp-stat__num">{{ fmtMoney(profile.total_contract_value_eur) }} EUR</span>
      </div>
      <ContractsPanel :symbol="gmrId || symbol" />
    </div>
  </div>
</template>

<style scoped>
.profile-panel { padding: 0.5rem 0; }

.pp-header { margin-bottom: 1.25rem; }
.pp-header-top { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.pp-name { font-size: 1.1rem; font-weight: 700; margin: 0; }
.pp-meta { display: flex; gap: 0.4rem; margin-top: 0.4rem; flex-wrap: wrap; }
.pp-tag {
  font-size: 0.7rem; padding: 0.1rem 0.4rem;
  background: var(--surface, #f6f8fa);
  border: 1px solid var(--border);
  border-radius: 3px; color: var(--muted);
  font-weight: 600; text-transform: uppercase;
}
.pp-tag--accent { color: var(--accent); border-color: var(--accent); }

.pp-section { margin-bottom: 1.5rem; }
.pp-section h3 {
  font-size: 0.8rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--muted);
  margin-bottom: 0.6rem; padding-bottom: 0.3rem;
  border-bottom: 1px solid var(--border);
}

.pp-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.6rem; margin-bottom: 1rem;
}
.pp-stat {
  display: flex; flex-direction: column;
  padding: 0.5rem 0.7rem;
  background: var(--surface, #f6f8fa);
  border: 1px solid var(--border);
  border-radius: 6px;
}
.pp-stat__num { font-size: 1rem; font-weight: 700; color: var(--accent); }
.pp-stat__label { font-size: 0.7rem; color: var(--muted); }

.pp-procurement-summary {
  font-size: 0.9rem; margin-bottom: 0.75rem; color: var(--text);
}

.pp-group-header { font-size: 0.9rem; margin-bottom: 0.6rem; }
.pp-group-tree { display: flex; flex-direction: column; gap: 0.2rem; }
.pp-group-member {
  display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
  padding: 0.3rem 0.5rem; border-radius: 4px; font-size: 0.85rem;
}
.pp-group-member--current { background: var(--surface, #f6f8fa); font-weight: 600; }
.pp-group-link { color: var(--accent); text-decoration: none; }
.pp-group-link:hover { text-decoration: underline; }
.pp-group-country { font-size: 0.75rem; color: var(--muted); }
.pp-group-contracts { font-size: 0.75rem; color: var(--muted); }
.pp-group-expand {
  margin-top: 0.4rem; padding: 0.3rem 0.8rem; font-size: 0.8rem;
  background: none; border: 1px solid var(--border); border-radius: 4px;
  color: var(--accent); cursor: pointer; align-self: flex-start;
}

.pp-directors { display: flex; flex-direction: column; gap: 0.3rem; }
.pp-director {
  display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
  padding: 0.35rem 0; border-bottom: 1px solid var(--border);
  font-size: 0.85rem;
}
.pp-director:last-child { border-bottom: none; }
.pp-director__name { font-weight: 600; }
.pp-director__role { color: var(--muted); font-size: 0.8rem; }
.pp-director__former { color: var(--muted); font-size: 0.75rem; font-style: italic; }
</style>
