import { describe, it, expect } from 'vitest'
import { layoutEventLabels, truncateLabel, EVENT_LABEL_MAX } from '../../src/components/charts/chartEvents.js'

describe('layoutEventLabels', () => {
  it('stacks colliding labels into separate lanes', () => {
    const { placed, laneCount } = layoutEventLabels([
      { x: 100, label: 'CZE: VAW law notified' },
      { x: 104, label: 'FRA: VAW law notified' },
      { x: 108, label: 'ROU: VAW law notified' },
    ], 60, 740)
    expect(laneCount).toBe(3)
    expect(placed.map((p) => p.lane)).toEqual([0, 1, 2])
  })

  it('reuses lane 0 when labels are far apart', () => {
    const { placed, laneCount } = layoutEventLabels([
      { x: 100, label: 'A' }, { x: 400, label: 'B' }, { x: 700, label: 'C' },
    ], 60, 740)
    expect(laneCount).toBe(1)
    expect(placed.every((p) => p.lane === 0)).toBe(true)
  })

  it('end-anchors labels that would overflow the right edge', () => {
    const { placed } = layoutEventLabels(
      [{ x: 730, label: 'EU: VAW directive adopted' }], 60, 740)
    expect(placed[0].anchor).toBe('end')
  })

  it('sorts by x and drops non-finite positions', () => {
    const { placed } = layoutEventLabels(
      [{ x: 500, label: 'B' }, { x: NaN, label: 'bad' }, { x: 100, label: 'A' }], 60, 740)
    expect(placed.map((p) => p.label)).toEqual(['A', 'B'])
  })

  it('truncates long labels with an ellipsis', () => {
    const long = 'X'.repeat(EVENT_LABEL_MAX + 10)
    expect(truncateLabel(long).length).toBe(EVENT_LABEL_MAX)
    expect(truncateLabel(long).endsWith('…')).toBe(true)
  })
})
