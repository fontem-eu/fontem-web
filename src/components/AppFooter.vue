<script setup>
import { computed } from 'vue'
import { currentUser } from '../api/session.js'
import { isPrivileged as privilegedUser } from '../utils/privilege.js'

/**
 * Global footer, rendered on every non-login page.
 *
 * Link set:
 *   - Privacy policy           (always)
 *   - SPARQL                   (always — public query surface)
 *   - About                    (always)
 *   - Development              (always — open-source shop window)
 *   - Admin                    (moderators and admins)
 *
 * The privilege check is a UX hint only; the backend still enforces
 * authorization on every admin endpoint.
 *
 * This used to parse `gmr-user` out of localStorage. The session has written
 * `fontem-user` since the rename and only ever *clears* the old key, so the
 * admin link had quietly shown to nobody. Read the session store instead —
 * it is reactive, so the link now appears on sign-in rather than on reload.
 */
const user = computed(() => currentUser.value)
const isPrivileged = computed(() => privilegedUser(user.value))
</script>

<template>
  <footer class="app-footer" data-testid="app-footer">
    <p class="app-footer-sources">{{ $t('app_footer.data_sourced_from_sec_edgar_esma_esef_gl') }}</p>
    <!-- Kept intentionally minimal: the everyday surfaces (Dashboards, Help)
         live in the left rail now, so the footer carries only the three
         links people look for HERE. Admin stays but is privilege-gated, so
         it is invisible to the public. -->
    <nav class="app-footer-links" :aria-label="$t('app_footer.footer')">
      <router-link to="/privacy" data-testid="footer-privacy">{{ $t('app.privacy') }}</router-link>
      <span aria-hidden="true">&middot;</span>
      <router-link to="/sparql" data-testid="footer-sparql">{{ $t('app_footer.sparql') }}</router-link>
      <span aria-hidden="true">&middot;</span>
      <router-link to="/about" data-testid="footer-about">{{ $t('app_footer.about') }}</router-link>
      <span aria-hidden="true">&middot;</span>
      <router-link to="/development" data-testid="footer-development">{{ $t('app_footer.development') }}</router-link>
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
  flex-wrap: wrap;
  justify-content: center;
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
