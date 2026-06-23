import { describe, it, expect } from 'vitest'
import { buildTree, flattenIds } from '../../src/utils/buildTree.js'

const n = (id, title, parent_id = null) => ({ id, title, parent_id })

describe('buildTree', () => {
  it('empty list -> no roots', () => {
    expect(buildTree([])).toEqual([])
    expect(buildTree(undefined)).toEqual([])
    expect(buildTree(null)).toEqual([])
  })

  it('single root', () => {
    const t = buildTree([n('a', 'A')])
    expect(t).toHaveLength(1)
    expect(t[0].id).toBe('a')
    expect(t[0].children).toEqual([])
  })

  it('multiple roots keep input order', () => {
    const t = buildTree([n('a', 'A'), n('b', 'B'), n('c', 'C')])
    expect(t.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('nests children under parents', () => {
    const t = buildTree([n('a', 'A'), n('b', 'B', 'a'), n('c', 'C', 'b')])
    expect(t).toHaveLength(1)
    expect(t[0].children.map((x) => x.id)).toEqual(['b'])
    expect(t[0].children[0].children.map((x) => x.id)).toEqual(['c'])
    expect(flattenIds(t)).toEqual(['a', 'b', 'c'])
  })

  it('preserves sibling order', () => {
    const t = buildTree([n('p', 'P'), n('c2', 'C2', 'p'), n('c1', 'C1', 'p')])
    expect(t[0].children.map((x) => x.id)).toEqual(['c2', 'c1'])
  })

  it('orphan (unknown parent) becomes a root', () => {
    const t = buildTree([n('a', 'A'), n('x', 'X', 'ghost')])
    expect(t.map((r) => r.id).sort()).toEqual(['a', 'x'])
  })

  it('self-parent becomes a root (no infinite loop)', () => {
    const t = buildTree([n('a', 'A', 'a')])
    expect(t).toHaveLength(1)
    expect(t[0].id).toBe('a')
    expect(t[0].children).toEqual([])
  })

  it('handles a deep chain', () => {
    const chain = ['a', 'b', 'c', 'd', 'e'].map((id, i, arr) => n(id, id, i ? arr[i - 1] : null))
    expect(flattenIds(buildTree(chain))).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('does not mutate the input nodes', () => {
    const input = [n('a', 'A'), n('b', 'B', 'a')]
    buildTree(input)
    expect(input[0]).not.toHaveProperty('children')
    expect(input[1].parent_id).toBe('a')
  })

  it('multiple roots each with their own subtrees', () => {
    const t = buildTree([n('r1', 'R1'), n('r2', 'R2'), n('a', 'A', 'r1'), n('b', 'B', 'r2')])
    expect(t.map((r) => r.id)).toEqual(['r1', 'r2'])
    expect(t[0].children[0].id).toBe('a')
    expect(t[1].children[0].id).toBe('b')
  })
})
