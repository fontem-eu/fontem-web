/**
 * Shared time-series aggregation helpers used by the zoomable chart
 * family (bar + line). Pulled out of ZoomableBarChart.vue so a second
 * visual mode can reuse the same bucketing/labelling logic without
 * forking the aggregation.
 *
 * All functions are pure; no Vue, no DOM.
 */
import * as d3 from 'd3'

/** Decide aggregation level based on actual time span and available width. */
export function getBucket(data, innerWidth, transformK) {
  if (!data || data.length < 2) return 'day'

  const dates = data.map((d) => new Date(d.date).getTime())
  const minMs = Math.min(...dates)
  const maxMs = Math.max(...dates)
  const spanDays = (maxMs - minMs) / 86400000

  const sorted = [...dates].sort((a, b) => a - b)
  const gaps = []
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1])
  gaps.sort((a, b) => a - b)
  const medianGapDays = gaps[Math.floor(gaps.length / 2)] / 86400000

  if (medianGapDays > 200) return 'year'
  if (medianGapDays > 25) return 'month'
  if (medianGapDays > 4) return 'week'

  const effectiveWidth = innerWidth * (transformK || 1)
  const pixelsPerDay = effectiveWidth / spanDays
  if (pixelsPerDay > 8) return 'day'
  if (pixelsPerDay > 3) return 'week'
  if (pixelsPerDay > 0.8) return 'month'
  return 'year'
}

/** Group raw {date,value} rows into {key: Date, value: number} at the given bucket. */
export function aggregateData(rawData, bucket) {
  if (!rawData || rawData.length === 0) return []

  const parsed = rawData.map((d) => ({
    date: new Date(d.date),
    value: d.value,
  }))

  if (bucket === 'day') return parsed.map((d) => ({ key: d.date, value: d.value }))

  const groups = d3.groups(parsed, (d) => {
    if (bucket === 'week') {
      const monday = d3.timeMonday(d.date)
      return monday.toISOString().slice(0, 10)
    }
    if (bucket === 'month') {
      return `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`
    }
    return String(d.date.getFullYear())
  })

  return groups.map(([key, items]) => {
    let keyDate
    if (bucket === 'year') keyDate = new Date(`${key}-01-01`)
    else if (bucket === 'month') keyDate = new Date(`${key}-01`)
    else if (bucket === 'week') keyDate = new Date(key)
    else keyDate = items[0].date
    return { key: keyDate, value: d3.sum(items, (d) => d.value) }
  })
}

export function formatDateLabel(date, bucket) {
  if (bucket === 'year') return d3.timeFormat('%Y')(date)
  if (bucket === 'month') return d3.timeFormat('%b %Y')(date)
  if (bucket === 'week') return `W${d3.timeFormat('%V')(date)} ${d3.timeFormat('%Y')(date)}`
  return d3.timeFormat('%d %b %Y')(date)
}

const TICK_FORMATS = { year: '%Y', month: '%b %y', week: '%d %b', day: '%d %b' }
export function tickFormat(bucket) {
  return TICK_FORMATS[bucket] || '%d %b'
}

const BUCKET_LABELS = { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }
export function bucketLabel(bucket) {
  return BUCKET_LABELS[bucket] || 'Daily'
}
