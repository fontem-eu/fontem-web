<script setup>
import { onMounted } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

onMounted(() => { document.title = 'Analytics — GMR' })
</script>

<template>
  <div class="an">
    <header class="an-header">
      <div>
        <router-link to="/admin" class="an-back">&larr; Admin</router-link>
        <h1>Analytics</h1>
        <p class="an-sub">
          Visitor metrics powered by Umami &mdash;
          <a href="/admin/analytics/" target="_blank" rel="noopener">open in new tab</a>
        </p>
      </div>
      <ThemeToggle />
    </header>
    <div class="an-frame-wrap">
      <iframe
        src="/admin/analytics/"
        class="an-frame"
        title="Analytics dashboard"
      ></iframe>
    </div>
  </div>
</template>

<style scoped>
.an { max-width: 100%; margin: 0 auto; padding: 0 1rem 0; height: 100vh; display: flex; flex-direction: column; }
.an-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1rem 0 0.75rem; flex-shrink: 0; }
.an-header h1 { font-size: 1.2rem; font-weight: 700; margin: 0.2rem 0 0; }
.an-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.an-sub { font-size: 0.8rem; color: var(--muted); margin-top: 0.1rem; }
.an-sub a { color: var(--accent); }
.an-frame-wrap { flex: 1; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-bottom: 1rem; }
.an-frame { width: 100%; height: 100%; border: none; }
</style>
