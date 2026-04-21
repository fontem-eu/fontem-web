<script setup>
import { computed } from 'vue'

/**
 * Global footer, rendered on every non-login page.
 *
 * Link set:
 *   - Data sources attribution (static)
 *   - Privacy policy           (always)
 *   - Data quality             (always — public surface)
 *   - Admin                    (trust_level in {moderator, admin})
 *
 * The trust_level check is a UX hint only; the backend still enforces
 * authorization on every admin endpoint.
 */
const PRIVILEGED = new Set(['moderator', 'admin'])

const user = computed(() => {
  if (typeof localStorage === 'undefined') return null
  try { return JSON.parse(localStorage.getItem('gmr-user') || 'null') }
  catch { return null }
})
const isPrivileged = computed(() => PRIVILEGED.has(user.value?.trust_level))
</script>

<template>
  <footer class="app-footer" data-testid="app-footer">
    <p class="app-footer-sources">
      Data sourced from SEC EDGAR, ESMA ESEF, GLEIF &amp; TED (EU Procurement)
    </p>
    <nav class="app-footer-links" aria-label="Footer">
      <router-link to="/privacy" data-testid="footer-privacy">Privacy</router-link>
      <span aria-hidden="true">&middot;</span>
      <router-link to="/data-quality" data-testid="footer-data-quality">Data quality</router-link>
      <span aria-hidden="true">&middot;</span>
      <router-link to="/sparql" data-testid="footer-sparql">SPARQL</router-link>
      <template v-if="isPrivileged">
        <span aria-hidden="true">&middot;</span>
        <router-link to="/admin" data-testid="footer-admin">Admin</router-link>
      </template>
    </nav>
  </footer>
</template>

<style scoped>
.app-footer {
  max-width: 72rem;
  margin: 0 auto;
  padding: 1.75rem 1rem 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  border-top: 1px solid var(--border);
  margin-top: 2rem;
}
.app-footer-sources {
  margin: 0;
  font-size: 0.72rem;
  color: var(--muted);
  letter-spacing: 0.01em;
  text-align: center;
}
.app-footer-links {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: var(--muted);
}
.app-footer-links a {
  color: var(--accent);
  text-decoration: none;
}
.app-footer-links a:hover {
  text-decoration: underline;
}
</style>
