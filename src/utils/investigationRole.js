/**
 * Map an investigation membership's capability flags to a short display
 * label. Membership is capability flags (not a linear role), so this is a
 * lossy, presentation-only summary for the list/detail UI.
 */
export function roleLabel(membership) {
  if (!membership) return 'Viewer'
  if (membership.is_owner) return 'Owner'
  if (membership.can_administer) return 'Admin'
  if (membership.can_write_stories || membership.can_add_viz) return 'Contributor'
  return 'Member'
}
