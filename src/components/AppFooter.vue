<script setup>
import { computed } from 'vue'
import { currentUser } from '../api/session.js'
import { isPrivileged as privilegedUser } from '../utils/privilege.js'

/**
 * Global footer, rendered on every non-login page.
 *
 * Link set:
 *   - Data sources attribution (static)
 *   - Privacy policy           (always)
 *   - Data quality             (always — public surface)
 *   - Support                  (always — links to /donate)
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
    <nav class="app-footer-links" :aria-label="$t('app_footer.footer')">
      <router-link to="/privacy" data-testid="footer-privacy">{{ $t('app.privacy') }}</router-link>
      <span aria-hidden="true">&middot;</span>
      <router-link to="/data-quality" data-testid="footer-data-quality">{{ $t('app_footer.data_quality') }}</router-link>
      <span aria-hidden="true">&middot;</span>
      <router-link to="/sparql" data-testid="footer-sparql">{{ $t('app_footer.sparql') }}</router-link>
      <span aria-hidden="true">&middot;</span>
      <router-link to="/about" data-testid="footer-about">{{ $t('app_footer.about') }}</router-link>
      <span aria-hidden="true">&middot;</span>
      <!-- Help shipped as a route nothing linked to, so it existed and no
           user could find it. The footer is where people look for it. -->
      <router-link to="/help" data-testid="footer-help">{{ $t('app_footer.help') }}</router-link>
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
