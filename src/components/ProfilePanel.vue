<script setup>
import { ref, watch } from 'vue'
import ContractsPanel from './ContractsPanel.vue'
import { fmtMoney } from '../utils/format.js'

const props = defineProps({
  symbol: { type: String, required: true },
  data: { type: Object, default: null },
  gmrId: { type: String, default: null },
  companyName: { type: String, default: null },
})

const profile = ref(null)
const profileState = ref('loading')

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
  <div class="profile-panel" data-testid="profile-panel">
    <!-- Company info card -->
    <div class="pp-header">
      <h2 class="pp-name">{{ companyName || profile?.company_name || symbol }}</h2>
      <div class="pp-meta">
        <span v-if="data?.data_source" class="pp-tag">{{ data.data_source.toUpperCase() }}</span>
        <span v-if="profile?.country" class="pp-tag">{{ profile.country }}</span>
        <span v-if="data?.ticker && !UUID_RE.test(data.ticker)" class="pp-tag pp-tag--accent">{{ data.ticker }}</span>
      </div>
    </div>

    <!-- Financial snapshot (if available from parent data) -->
    <div v-if="data?.ratios_summary" class="pp-section">
      <h3>Financial Overview</h3>
      <div class="pp-stats">
        <div v-if="data.market_snapshot?.current_price" class="pp-stat">
          <span class="pp-stat__num">{{ fmtMoney(data.market_snapshot.current_price) }}</span>
          <span class="pp-stat__label">Current Price</span>
        </div>
        <div v-if="data.market_snapshot?.market_cap" class="pp-stat">
          <span class="pp-stat__num">{{ fmtMoney(data.market_snapshot.market_cap) }}</span>
          <span class="pp-stat__label">Market Cap</span>
        </div>
        <div v-if="data.ratios_summary?.avg_roe" class="pp-stat">
          <span class="pp-stat__num">{{ data.ratios_summary.avg_roe.toFixed(1) }}%</span>
          <span class="pp-stat__label">Avg ROE</span>
        </div>
        <div v-if="data.ratios_summary?.avg_npm" class="pp-stat">
          <span class="pp-stat__num">{{ data.ratios_summary.avg_npm.toFixed(1) }}%</span>
          <span class="pp-stat__label">Avg Net Margin</span>
        </div>
      </div>
    </div>

    <!-- Directors (from Neo4j Person nodes) -->
    <div v-if="profile?.directors?.length" class="pp-section">
      <h3>Directors &amp; Officers</h3>
      <div class="pp-directors">
        <div v-for="d in profile.directors" :key="d.person_id" class="pp-director">
          <span class="pp-director__name">{{ d.first_name }} {{ d.name }}</span>
          <span class="pp-director__role">{{ d.role }}</span>
          <span v-if="d.current === false" class="pp-director__former">(former)</span>
        </div>
      </div>
    </div>

    <!-- Procurement data (always shown) -->
    <div class="pp-section">
      <h3>EU Public Procurement</h3>
      <div v-if="profile && profile.contract_count > 0" class="pp-procurement-summary">
        <span class="pp-stat__num">{{ profile.contract_count.toLocaleString() }} contracts</span>
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
