<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import TickerSearch from '../components/TickerSearch.vue'
import TickerFinancials from '../components/TickerFinancials.vue'
import ThemeToggle from '../components/ThemeToggle.vue'

const route = useRoute()
const router = useRouter()

const selectedTicker = computed(() => route.params.ticker || null)

function onTickerSelect(symbol) {
  router.push('/' + symbol)
}

function onClose() {
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen" style="background: var(--bg)">
    <div class="mx-auto w-full max-w-xl px-6">

      <!-- ── Header ──────────────────────────────────────── -->
      <header class="flex items-start justify-between pt-12 pb-8">
        <div>
          <h1 class="text-2xl font-bold tracking-tight leading-none">
            <span style="color: var(--accent)">GMR</span>
            <span style="color: var(--text)"> Ticker Search</span>
          </h1>
          <p
            class="mt-1.5 text-xs font-medium uppercase tracking-widest"
            style="color: var(--muted)"
          >
            10,000+ companies &middot; SEC EDGAR
          </p>
        </div>
        <ThemeToggle />
      </header>

      <!-- ── Search ──────────────────────────────────────── -->
      <main>
        <TickerSearch
          :selected-symbol="selectedTicker"
          @select="onTickerSelect"
        />
        <TickerFinancials
          v-if="selectedTicker"
          :symbol="selectedTicker"
          class="mt-2"
          @close="onClose"
        />
      </main>

      <!-- ── Footer ──────────────────────────────────────── -->
      <footer class="pb-10 pt-12">
        <p class="text-xs tracking-wide" style="color: var(--muted)">
          Data sourced from SEC EDGAR
        </p>
      </footer>

    </div>
  </div>
</template>
