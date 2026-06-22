import { describe, it, expect } from 'vitest'
import {
  CHART_TYPES,
  VALUE_FORMATTERS,
  resolveFormatter,
  serializeChartProps,
} from '../../src/widgets/chartSnapshot.js'

describe('chartSnapshot helpers', () => {
  it('exposes the supported chart types', () => {
    expect(CHART_TYPES).toEqual(['stat', 'bar_h', 'gauge', 'ts_bar', 'ts_line'])
  })

  it('resolves named formatters and ignores unknown ones', () => {
    expect(resolveFormatter('pct')(40)).toBe('40%')
    expect(typeof VALUE_FORMATTERS.eur(1000)).toBe('string')
    expect(resolveFormatter('nope')).toBeNull()
    expect(resolveFormatter(undefined)).toBeNull()
  })

  it('drops functions but keeps data + the format string', () => {
    const out = serializeChartProps({
      data: [{ label: 'A', value: 1 }],
      format: 'eur',
      color: '#fff',
      formatValue: (v) => `$${v}`,
      missing: undefined,
    })
    expect(out.data).toEqual([{ label: 'A', value: 1 }])
    expect(out.format).toBe('eur')
    expect(out.color).toBe('#fff')
    expect(out.formatValue).toBeUndefined()
    expect('missing' in out).toBe(false)
  })

  it('returns a detached (JSON-safe) copy', () => {
    const data = [{ label: 'A', value: 1 }]
    const out = serializeChartProps({ data })
    out.data[0].value = 99
    expect(data[0].value).toBe(1) // original untouched
  })
})
