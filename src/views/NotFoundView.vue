<script setup>
import { onMounted } from 'vue'

onMounted(() => { document.title = 'Page not found — Fontem' })
</script>

<template>
  <div class="notfound">
    <h1 class="notfound-code">404</h1>
    <h2 class="notfound-title">Page not found</h2>
    <p class="notfound-desc">
      The page you're looking for doesn't exist or has been moved.
    </p>
    <router-link to="/" class="notfound-link">Back to home</router-link>
  </div>
</template>

<style scoped>
.notfound {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 200px);
  padding: 2rem;
  text-align: center;
}
.notfound-code {
  font-size: 5rem;
  font-weight: 700;
  color: var(--muted);
  margin: 0 0 0.5rem;
  line-height: 1;
}
.notfound-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 0.75rem;
}
.notfound-desc {
  color: var(--muted);
  margin: 0 0 1.5rem;
  max-width: 32rem;
}
.notfound-link {
  display: inline-block;
  padding: 0.6rem 1.2rem;
  background: var(--accent);
  color: #fff;
  text-decoration: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  transition: opacity 0.15s;
}
.notfound-link:hover {
  opacity: 0.9;
}
</style>
