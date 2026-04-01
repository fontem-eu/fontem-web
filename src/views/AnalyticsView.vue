<script setup>
import { onMounted, ref } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

onMounted(() => { document.title = 'Analytics — GMR' })

const iframeError = ref(false)
function onIframeLoad(e) {
  // If the iframe loaded but shows a blank page, the proxy didn't work
  try {
    const doc = e.target.contentDocument
    if (doc && doc.body && doc.body.children.length < 2) {
      iframeError.value = true
    }
  } catch {
    // Cross-origin — can't inspect, but it loaded something
  }
}
</script>

<template>
  <div class="an">
    <header class="an-header">
      <div>
        <router-link to="/admin" class="an-back">&larr; Admin</router-link>
        <h1>Analytics</h1>
        <p class="an-sub">Visitor metrics powered by Umami</p>
      </div>
      <ThemeToggle />
    </header>

    <div class="an-content">
      <div v-if="iframeError" class="an-fallback">
        <p>The analytics dashboard cannot be embedded directly.</p>
        <a href="/admin/analytics/" target="_blank" rel="noopener" class="an-btn">
          Open Analytics Dashboard &rarr;
        </a>
      </div>

      <div class="an-links">
        <a href="/admin/analytics/" target="_blank" rel="noopener" class="an-link-card">
          <h2>Full Dashboard</h2>
          <p>Login to Umami for full access — visitors, page views, events, and more.</p>
        </a>
      </div>

      <div class="an-frame-wrap" :class="{ 'an-frame-wrap--hidden': iframeError }">
        <iframe
          src="/admin/analytics/"
          class="an-frame"
          title="Analytics dashboard"
          @load="onIframeLoad"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<style scoped>
.an { max-width: 100%; margin: 0 auto; padding: 0 1rem 0; height: 100vh; display: flex; flex-direction: column; }
.an-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1rem 0 0.75rem; flex-shrink: 0; }
.an-header h1 { font-size: 1.2rem; font-weight: 700; margin: 0.2rem 0 0; }
.an-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.an-sub { font-size: 0.8rem; color: var(--muted); margin-top: 0.1rem; }
.an-content { flex: 1; display: flex; flex-direction: column; gap: 1rem; }

.an-links { display: flex; gap: 1rem; flex-wrap: wrap; }
.an-link-card { display: block; padding: 1rem 1.25rem; background: var(--surface, #f6f8fa); border: 1px solid var(--border); border-radius: 8px; text-decoration: none; color: inherit; transition: border-color 0.15s; flex: 1; min-width: 200px; }
.an-link-card:hover { border-color: var(--accent); }
.an-link-card h2 { font-size: 0.95rem; font-weight: 700; color: var(--accent); margin-bottom: 0.3rem; }
.an-link-card p { font-size: 0.82rem; color: var(--muted); margin: 0; }

.an-fallback { text-align: center; padding: 2rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
.an-fallback p { color: var(--muted); margin-bottom: 1rem; }
.an-btn { display: inline-block; padding: 0.5rem 1.25rem; background: var(--accent); color: #fff; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 0.9rem; }

.an-frame-wrap { flex: 1; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-bottom: 1rem; min-height: 400px; }
.an-frame-wrap--hidden { display: none; }
.an-frame { width: 100%; height: 100%; border: none; }
</style>
