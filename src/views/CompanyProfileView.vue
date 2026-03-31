<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import ThemeToggle from '../components/ThemeToggle.vue'
import ContractsPanel from '../components/ContractsPanel.vue'
import { fmtMoney } from '../utils/format.js'

const route = useRoute()
const gmrId = computed(() => route.params.gmr_id)

const state = ref('loading')
const profile = ref(null)

onMounted(async () => {
  try {
    const res = await fetch(`/api/companies/${encodeURIComponent(gmrId.value)}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    profile.value = await res.json()
    document.title = `${profile.value.company_name || gmrId.value} | GMR`
    state.value = 'done'
  } catch {
    state.value = 'error'
  }
})
</script>

<template>
  <div class="cp">
    <header class="cp-header">
      <div>
        <router-link to="/" class="cp-back">&larr; Home</router-link>
        <h1 v-if="profile">{{ profile.company_name || gmrId }}</h1>
        <h1 v-else>Company Profile</h1>
        <div v-if="profile" class="cp-meta">
          <span v-if="profile.country" class="cp-tag">{{ profile.country }}</span>
          <span v-if="profile.contract_count" class="cp-tag">
            {{ profile.contract_count.toLocaleString() }} contracts
          </span>
          <span v-if="profile.total_contract_value_eur" class="cp-tag">
            {{ fmtMoney(profile.total_contract_value_eur) }} EUR
          </span>
        </div>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="state === 'loading'" class="cp-msg">Loading company profile...</div>
    <div v-else-if="state === 'error'" class="cp-msg">Company not found.</div>

    <div v-else-if="profile">
      <!-- Contracts panel (reuses the existing component) -->
      <h2 class="cp-section">EU Public Procurement</h2>
      <ContractsPanel :symbol="gmrId" />
    </div>
  </div>
</template>

<style scoped>
.cp { max-width: 1100px; margin: 0 auto; padding: 0 1rem 4rem; }

.cp-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border);
  margin-bottom: 1.5rem;
}
.cp-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0.3rem 0 0; }
.cp-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.cp-back:hover { text-decoration: underline; }
.cp-meta { display: flex; gap: 0.5rem; margin-top: 0.4rem; flex-wrap: wrap; }
.cp-tag {
  font-size: 0.75rem; padding: 0.15rem 0.5rem;
  background: var(--surface, #f6f8fa);
  border: 1px solid var(--border);
  border-radius: 4px; color: var(--muted);
}
.cp-msg { text-align: center; padding: 4rem 1rem; color: var(--muted); }
.cp-section {
  font-size: 0.9rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--muted); margin: 1.5rem 0 0.5rem;
}
</style>
