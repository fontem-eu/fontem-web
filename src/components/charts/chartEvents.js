/**
 * Event-annotation layout for line charts (gitops#290 story feature).
 *
 * Events are context, not data: rendered as thin dotted verticals with a
 * short label. Labels must never overlap — this assigns each label to the
 * first "lane" (stacked label rows above the plot) where it fits, greedily
 * left→right. Pure function so the collision logic is unit-testable.
 */

export const EVENT_LABEL_MAX = 26
export const LANE_H = 13          // px per label lane
const CHAR_W = 5.2                // ~width of one char at font-size 9.5

export function truncateLabel(label) {
  const s = String(label || '')
  return s.length > EVENT_LABEL_MAX ? s.slice(0, EVENT_LABEL_MAX - 1) + '…' : s
}

/**
 * @param events [{ x: pixelX, label, detail? }] — x already in SVG px
 * @param plotLeft/plotRight — drawable label span in px
 * @returns [{ x, label, detail, lane, anchor: 'start'|'end' }...], laneCount
 */
export function layoutEventLabels(events, plotLeft, plotRight) {
  const sorted = [...(events || [])]
    .filter((e) => Number.isFinite(e.x))
    .sort((a, b) => a.x - b.x)
  const lanes = []           // per lane: rightmost occupied px
  const placed = sorted.map((e) => {
    const label = truncateLabel(e.label)
    const w = label.length * CHAR_W + 6
    // anchor text to the right of the line unless it would overflow
    const anchor = e.x + w > plotRight ? 'end' : 'start'
    const x0 = anchor === 'start' ? e.x + 3 : e.x - w - 3
    const x1 = x0 + w
    let lane = lanes.findIndex((right) => x0 > right + 4)
    if (lane === -1) { lane = lanes.length; lanes.push(-Infinity) }
    lanes[lane] = x1
    return { ...e, label, lane, anchor }
  })
  return { placed, laneCount: lanes.length }
}
