/**
 * Tests for the pure time-series aggregation helpers shared by the
 * zoomable chart family (bucketing, grouping, labels).
 */
import { describe, it, expect } from 'vitest'
import {
  getBucket, aggregateData, formatDateLabel, tickFormat,
} from '../../src/components/charts/timeSeriesAggregation.js'

const daily = (n, start = '2024-01-01') => Array.from({ length: n }, (_, i) => {
  const d = new Date(start); d.setUTCDate(d.getUTCDate() + i)
  return { date: d.toISOString().slice(0, 10), value: 1 }
})

describe('getBucket', () => {
  it('defaults to day for tiny inputs', () => {
    expect(getBucket(null, 800, 1)).toBe('day')
    expect(getBucket([], 800, 1)).toBe('day')
    expect(getBucket([{ date: '2024-01-01' }], 800, 1)).toBe('day')
  })

  it('classifies by median gap: yearly, monthly, weekly series', () => {
    const yearly = [{ date: '2020-01-01' }, { date: '2021-01-01' }, { date: '2022-01-01' }]
    expect(getBucket(yearly, 800, 1)).toBe('year')
    const monthly = [{ date: '2024-01-01' }, { date: '2024-02-01' }, { date: '2024-03-01' }]
    expect(getBucket(monthly, 800, 1)).toBe('month')
    const weekly = [{ date: '2024-01-01' }, { date: '2024-01-08' }, { date: '2024-01-15' }]
    expect(getBucket(weekly, 800, 1)).toBe('week')
  })

  it('falls back to pixel density for dense daily data', () => {
    // 30 daily points at 800px → ~27 px/day → day
    expect(getBucket(daily(30), 800, 1)).toBe('day')
    // 200 daily points at 800px → 4 px/day → week
    expect(getBucket(daily(200), 800, 1)).toBe('week')
    // 730 daily points at 800px → ~1.1 px/day → month
    expect(getBucket(daily(730), 800, 1)).toBe('month')
    // 3650 daily points at 800px → ~0.2 px/day → year
    expect(getBucket(daily(3650), 800, 1)).toBe('year')
  })

  it('zooming in (transformK) raises the effective width', () => {
    // 200 daily points at 800px is week; at 4x zoom it is day again
    expect(getBucket(daily(200), 800, 4)).toBe('day')
    // transformK 0 falls back to 1
    expect(getBucket(daily(200), 800, 0)).toBe('week')
  })
})

describe('aggregateData', () => {
  it('returns [] for empty input', () => {
    expect(aggregateData(null, 'day')).toEqual([])
    expect(aggregateData([], 'day')).toEqual([])
  })

  it('day bucket passes points through', () => {
    const out = aggregateData([{ date: '2024-03-05', value: 7 }], 'day')
    expect(out).toHaveLength(1)
    expect(out[0].value).toBe(7)
    expect(out[0].key.toISOString().slice(0, 10)).toBe('2024-03-05')
  })

  it('month bucket sums values inside the month', () => {
    const out = aggregateData([
      { date: '2024-03-05', value: 1 },
      { date: '2024-03-20', value: 2 },
      { date: '2024-04-01', value: 4 },
    ], 'month')
    expect(out).toHaveLength(2)
    expect(out[0].value).toBe(3)
    expect(out[0].key.getMonth()).toBe(2)
    expect(out[1].value).toBe(4)
  })

  it('year bucket sums the whole year', () => {
    const out = aggregateData([
      { date: '2023-01-01', value: 1 },
      { date: '2023-12-31', value: 2 },
      { date: '2024-06-01', value: 5 },
    ], 'year')
    expect(out.map((d) => d.value)).toEqual([3, 5])
    expect(out[0].key.getFullYear()).toBe(2023)
  })

  it('week bucket groups onto the Monday', () => {
    // Wed 2024-03-06 and Thu 2024-03-07 share Monday 2024-03-04
    const out = aggregateData([
      { date: '2024-03-06', value: 1 },
      { date: '2024-03-07', value: 2 },
      { date: '2024-03-12', value: 9 },
    ], 'week')
    expect(out).toHaveLength(2)
    expect(out[0].value).toBe(3)
    expect(out[0].key.toISOString().slice(0, 10)).toBe('2024-03-04')
  })
})

describe('labels', () => {
  const d = new Date('2024-03-04T00:00:00Z')
  it('formats per bucket', () => {
    expect(formatDateLabel(d, 'year')).toBe('2024')
    expect(formatDateLabel(d, 'month')).toBe('Mar 2024')
    expect(formatDateLabel(d, 'week')).toMatch(/^W\d\d? 2024$/)
    expect(formatDateLabel(d, 'day')).toBe('04 Mar 2024')
  })

  it('tickFormat maps buckets with a day fallback', () => {
    expect(tickFormat('year')).toBe('%Y')
    expect(tickFormat('month')).toBe('%b %y')
    expect(tickFormat('week')).toBe('%d %b')
    expect(tickFormat('day')).toBe('%d %b')
    expect(tickFormat('nonsense')).toBe('%d %b')
  })
})
