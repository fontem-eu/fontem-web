/**
 * Build a nested tree from a flat list of nodes.
 *
 * Each node is `{ id, title, parent_id }`. A node whose `parent_id` is null,
 * missing, unknown, or its own id becomes a root. Sibling order follows input
 * order. Returns new node objects (`{ ...node, children: [] }`) — the input is
 * never mutated. Designed for the dossier TreeNav, but generic.
 */
export function buildTree(nodes) {
  const list = Array.isArray(nodes) ? nodes : []
  const byId = new Map(list.map((n) => [n.id, { ...n, children: [] }]))
  const roots = []
  for (const n of list) {
    const node = byId.get(n.id)
    const parent = n.parent_id != null && n.parent_id !== n.id ? byId.get(n.parent_id) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

/** Flatten a tree (depth-first) back to a list of ids — handy for tests/assertions. */
export function flattenIds(roots) {
  const out = []
  const walk = (n) => { out.push(n.id); (n.children || []).forEach(walk) }
  ;(roots || []).forEach(walk)
  return out
}
