<script setup>
import TickerSearch from '../components/TickerSearch.vue'
</script>

<template>
  <main>
    <header class="hero">
      <h1><span class="accent">GMR</span> Ticker Search</h1>
      <p>Search across 10,000+ SEC EDGAR-registered companies</p>
    </header>

    <TickerSearch />

    <footer class="site-footer">Data sourced from SEC EDGAR</footer>
  </main>
</template>
