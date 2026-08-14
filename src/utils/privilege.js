/**
 * Who gets shown the admin area.
 *
 * A UX hint only — every admin endpoint is authorised server-side, and this
 * predicate deliberately mirrors the backend's `_is_admin` / `_is_moderator`
 * (src/services/authz/policy.py) rather than inventing its own rule: either
 * an explicit role assignment or a trust level at or above the bar.
 *
 * It lives in its own module because two surfaces show this link — the footer
 * and the profile menu — and a copy in each is a copy that drifts.
 *
 * `roles` is tolerated but not yet sent: /users/me returns trust_level only.
 * Reading it here means the day the self-view starts including roles, an
 * ops-promoted moderator whose trust_level column has not caught up starts
 * seeing the link with no further change.
 */
const PRIVILEGED = new Set(['moderator', 'admin'])

export function isPrivileged(user) {
  if (!user) return false
  if (PRIVILEGED.has(user.trust_level)) return true
  return (user.roles || []).some((role) => PRIVILEGED.has(role))
}
