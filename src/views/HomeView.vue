<script setup>
import TickerSearch from '../components/TickerSearch.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
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
        <TickerSearch />
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
