import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const VIEW = fs.readFileSync(
  path.join(ROOT, 'src', 'views', 'EntityResolutionView.vue'),
  'utf8',
)

// Approving a candidate asserts owl:sameAs and keeps BOTH records. It
// used to merge the two nodes, deleting one — which is why the old UI
// had to ask WHICH to keep, and why an approved pair could never
// afterwards be corrected: :NOT_SAME_AS can only undo something that
// still exists.
//
// The labels are the part users act on, so they are what must not drift
// back. "Merge — keep A (B is removed)" promised a deletion that no
// longer happens.
describe('entity resolution decisions', () => {
  it('sends the verdicts the consolidator now expects', () => {
    expect(VIEW).toContain("decide('approve'")
    expect(VIEW).toContain("decide('decline'")
    expect(VIEW).toContain("decide('keep_as_related'")
  })

  it('no longer offers a directional merge', () => {
    expect(VIEW).not.toContain('merge_keep_a_b_is_removed')
    expect(VIEW).not.toContain('merge_keep_b_a_is_removed')
    expect(VIEW).toContain('approve_same_entity')
  })

  it('does not promise that a record is removed', () => {
    const sameAsBlock = VIEW.slice(
      VIEW.indexOf("selected._mode === 'same_as'"),
    ).slice(0, 1800)
    expect(sameAsBlock).not.toMatch(/is_removed/)
  })

  it('offers exactly one approve action, since the assertion is symmetric', () => {
    const approvals = VIEW.match(/decide\('approve'/g) || []
    expect(approvals).toHaveLength(1)
  })
})
