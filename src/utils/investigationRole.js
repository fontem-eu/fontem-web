/**
 * Investigation membership roles: viewer < contributor < admin < owner.
 * A single linear role replaces the old capability-flag grid.
 */
export const ROLES = ['viewer', 'contributor', 'admin', 'owner']
export const ROLE_RANK = { viewer: 0, contributor: 1, admin: 2, owner: 3 }

const LABELS = { viewer: 'Viewer', contributor: 'Contributor', admin: 'Admin', owner: 'Owner' }

/** Short display label for a membership's role. */
export function roleLabel(membership) {
  return LABELS[membership?.role] || 'Viewer'
}

/** True if the membership's role is at or above `min`. */
export function roleAtLeast(membership, min) {
  return (ROLE_RANK[membership?.role] ?? -1) >= ROLE_RANK[min]
}

/** Can this member add/edit stories + viz in the investigation (contributor+). */
export function canContribute(membership) {
  return roleAtLeast(membership, 'contributor')
}
