<script setup>
import { computed } from 'vue'

/**
 * Global footer, rendered on every non-login page.
 *
 * Link set:
 *   - Data sources attribution (static)
 *   - Privacy policy           (always)
 *   - Data quality             (always — public surface)
 *   - Support                  (always — links to /donate)
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
    <p class="app-footer-sources">{{ $t('app_footer.data_sourced_from_sec_edgar_esma_esef_gl') }}</p>
    <nav class="app-footer-links" :aria-label="$t('app_footer.footer')">
      <router-link to="/privacy" data-testid="footer-privacy">{{ $t('app.privacy') }}</router-link>
      <span aria-hidden="true">&middot;</span>
      <router-link to="/data-quality" data-testid="footer-data-quality">{{ $t('app_footer.data_quality') }}</router-link>
      <span aria-hidden="true">&middot;</span>
      <router-link to="/sparql" data-testid="footer-sparql">{{ $t('app_footer.sparql') }}</router-link>
      <span aria-hidden="true">&middot;</span>
      <router-link to="/about" data-testid="footer-about">{{ $t('app_footer.about') }}</router-link>
      <span aria-hidden="true">&middot;</span>
      <router-link to="/donate" data-testid="footer-donate">{{ $t('app_footer.support') }}</router-link>
      <template v-if="isPrivileged">
        <span aria-hidden="true">&middot;</span>
        <router-link to="/admin" data-testid="footer-admin">{{ $t('app.admin') }}</router-link>
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
