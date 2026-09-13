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

/**
 * Who gets shown the admin-only tools inside the admin area, such as the
 * user directory. Mirrors the backend's `_is_admin` exactly — the admin
 * trust level or an explicit admin role — and NOT moderator, which
 * isPrivileged above deliberately includes: the directory is every account's
 * email address, and moderating content does not need it.
 *
 * Still only a hint. /admin/users is authorised server-side, and anyone who
 * reaches the page without the right is shown the server's refusal.
 */
export function isAdmin(user) {
  if (!user) return false
  if (user.trust_level === 'admin') return true
  return (user.roles || []).includes('admin')
}
