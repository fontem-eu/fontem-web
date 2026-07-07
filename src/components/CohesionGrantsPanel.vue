<script setup>
import { ref, watch, computed } from 'vue'
import { fmtEur } from '../utils/format.js'

// EU cohesion (Kohesio) grants a company has *attained*, mirroring
// ContractsPanel on the funding side. The granting side is carried by the
// fund (ERDF/ESF+) + programme on each grant — Kohesio doesn't model the
// managing authority as a separate entity.
const props = defineProps({
  gmrId: { type: String, required: true },
})

const state = ref('idle')
const data = ref(null)

async function load(gid) {
  if (!gid) return
  state.value = 'loading'
  data.value = null
  try {
    const res = await fetch(
      `/api/companies/${encodeURIComponent(gid)}/cohesion-grants?limit=100`,
    )
    if (!res.ok) { state.value = 'error'; return }
    data.value = await res.json()
    state.value = 'done'
  } catch {
    state.value = 'error'
  }
}
watch(() => props.gmrId, load, { immediate: true })

const grants = computed(() => data.value?.grants || [])
const hasGrants = computed(() => (data.value?.grant_count || 0) > 0)
</script>

<template>
  <section
    v-if="hasGrants"
    class="cohesion-panel"
    data-testid="cohesion-grants-panel"
  >
    <h2>{{ $t('cohesion_grants_panel.eu_cohesion_grants') }}</h2>
    <p class="cg-sub" data-testid="cohesion-grants-summary">
      {{ data.grant_count.toLocaleString() }}
      {{ $t('cohesion_grants_panel.grant') }}{{ data.grant_count === 1 ? '' : 's' }} {{ $t('cohesion_grants_panel.attained') }}
      · {{ fmtEur(data.total_eu_contribution) }} {{ $t('cohesion_grants_panel.eu_contribution') }}
    </p>
    <div class="cg-scroll">
      <table class="cg-table">
        <thead>
          <tr>
            <th>{{ $t('cohesion_grants_panel.project') }}</th>
            <th>{{ $t('cohesion_grants_panel.fund') }}</th>
            <th>{{ $t('cohesion_grants_panel.programme') }}</th>
            <th class="num">{{ $t('cohesion_grants_panel.eu_euro') }}</th>
            <th>{{ $t('cohesion_grants_panel.period') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(g, i) in grants"
            :key="i"
            :data-testid="`cohesion-grant-${i}`"
          >
            <td class="cg-title">{{ g.title || '—' }}</td>
            <td><span class="cg-fund">{{ g.fund || '—' }}</span></td>
            <td>{{ g.programme || '—' }}</td>
            <td class="num">{{ g.eu_contribution ? fmtEur(g.eu_contribution) : '—' }}</td>
            <td class="nowrap">
              {{ (g.start_date || '').substring(0, 10) || g.year || '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.cohesion-panel { margin: 1.5rem 0; }
.cohesion-panel h2 { font-size: 1.1rem; margin: 0 0 .25rem; }
.cg-sub { color: var(--muted, #6b7280); margin: 0 0 .75rem; font-size: .9rem; }
.cg-scroll { overflow-x: auto; }
.cg-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
.cg-table th, .cg-table td {
  text-align: left; padding: .4rem .6rem;
  border-bottom: 1px solid var(--border, #e5e7eb); vertical-align: top;
}
.cg-table th { color: var(--muted, #6b7280); font-weight: 600; }
.num { text-align: right; white-space: nowrap; }
.nowrap { white-space: nowrap; }
.cg-title { max-width: 28rem; }
.cg-fund {
  display: inline-block; padding: .1rem .4rem; border-radius: 4px;
  background: var(--chip-bg, #eef2ff); color: var(--chip-fg, #3730a3);
  font-size: .78rem; white-space: nowrap;
}
</style>
