<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import TickerSearch from '../components/TickerSearch.vue'
import TickerFinancials from '../components/TickerFinancials.vue'
import DataViewSelector from '../components/DataViewSelector.vue'
import ThemeToggle from '../components/ThemeToggle.vue'

const route = useRoute()
const router = useRouter()

const VIEWS = [
  { key: 'fundamentals', label: 'Fundamentals' },
  { key: 'gmr-long', label: 'GMR Long' },
]

const selectedTicker = computed(() => route.params.ticker || null)
const selectedView = computed(() => route.params.view || 'fundamentals')

function onTickerSelect(symbol) {
  router.push('/' + symbol + '/' + selectedView.value)
}

function onViewChange(view) {
  router.push('/' + selectedTicker.value + '/' + view)
}

function onClose() {
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen" style="background: var(--bg)">
    <!-- ── Banner ─────────────────────────────────────────── -->
    <header class="border-b" style="border-color: var(--border)">
      <div class="mx-auto flex w-full max-w-6xl items-center gap-6 px-6 py-4">
        <!-- Logo -->
        <div class="shrink-0">
          <h1 class="text-xl font-bold leading-none tracking-tight">
            <span style="color: var(--accent)">GMR</span>
            <span style="color: var(--text)"> Ticker Search</span>
          </h1>
          <p class="mt-1 text-xs font-medium uppercase tracking-widest" style="color: var(--muted)">
            10,000+ companies &middot; SEC EDGAR
          </p>
        </div>

        <!-- Search bar — fills remaining space -->
        <div class="flex-1">
          <TickerSearch :selected-symbol="selectedTicker" :compact="true" @select="onTickerSelect" />
        </div>

        <!-- Right controls -->
        <ThemeToggle />
      </div>
    </header>

    <!-- ── Content ────────────────────────────────────────── -->
    <div class="mx-auto w-full px-6" :class="selectedTicker ? 'max-w-6xl' : 'max-w-xl'">
      <main>
        <div v-if="selectedTicker" class="mt-6 flex items-start gap-4">
          <DataViewSelector
            :model-value="selectedView"
            :views="VIEWS"
            @update:model-value="onViewChange"
          />
          <TickerFinancials
            :symbol="selectedTicker"
            :view="selectedView"
            class="min-w-0 flex-1"
            @close="onClose"
          />
        </div>
      </main>

      <!-- ── Footer ──────────────────────────────────────── -->
      <footer class="pb-10 pt-12">
        <p class="text-xs tracking-wide" style="color: var(--muted)">Data sourced from SEC EDGAR</p>
      </footer>
    </div>
  </div>
</template>
