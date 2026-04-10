import { describe, it, expect } from 'vitest'
import { fmtMoney, fmtEur, fmtPrice, fmtCompact, fmtDual } from '../../src/utils/format.js'

describe('fmtMoney', () => {
  // null / undefined guard
  it('returns dash for null', () => {
    expect(fmtMoney(null)).toBe('—')
  })

  it('returns dash for undefined', () => {
    expect(fmtMoney(undefined)).toBe('—')
  })

  // Default currency is USD ($)
  it('formats a small positive number with $', () => {
    expect(fmtMoney(42)).toBe('$42')
  })

  // Negative values produce "-" prefix
  it('formats a negative number with - prefix', () => {
    expect(fmtMoney(-5000)).toBe('-$5K')
  })

  it('positive number has no - prefix', () => {
    expect(fmtMoney(5000)).toBe('$5K')
  })

  // Boundary: exactly 1e12
  it('formats exactly 1e12 as T', () => {
    expect(fmtMoney(1e12)).toBe('$1.0T')
  })

  it('formats above 1e12 as T', () => {
    expect(fmtMoney(2.5e12)).toBe('$2.5T')
  })

  it('formats just below 1e12 as B', () => {
    expect(fmtMoney(999_999_999_999)).toBe('$1000.0B')
  })

  // Boundary: exactly 1e9
  it('formats exactly 1e9 as B', () => {
    expect(fmtMoney(1e9)).toBe('$1.0B')
  })

  it('formats just below 1e9 as M', () => {
    expect(fmtMoney(999_999_999)).toBe('$1000.0M')
  })

  // Boundary: exactly 1e6
  it('formats exactly 1e6 as M', () => {
    expect(fmtMoney(1e6)).toBe('$1.0M')
  })

  it('formats just below 1e6 as K', () => {
    expect(fmtMoney(999_999)).toBe('$1000K')
  })

  // Boundary: exactly 1e3
  it('formats exactly 1e3 as K', () => {
    expect(fmtMoney(1000)).toBe('$1K')
  })

  it('formats 999 without suffix', () => {
    expect(fmtMoney(999)).toBe('$999')
  })

  // Custom decimals
  it('respects custom decimals for T', () => {
    expect(fmtMoney(1.234e12, 2)).toBe('$1.23T')
  })

  it('respects custom decimals for B', () => {
    expect(fmtMoney(1.234e9, 2)).toBe('$1.23B')
  })

  it('respects custom decimals for M', () => {
    expect(fmtMoney(1.234e6, 2)).toBe('$1.23M')
  })

  // K always uses toFixed(0)
  it('K suffix uses 0 decimal places regardless', () => {
    expect(fmtMoney(1500, 3)).toBe('$2K')
  })

  // Truly unknown currency falls back to "{CCY}\u00A0" prefix
  it('falls back to currency code + nbsp for unknown currency', () => {
    expect(fmtMoney(1e6, 1, 'XYZ')).toBe('XYZ\u00A01.0M')
  })

  // Known currencies
  it('uses € for EUR', () => {
    expect(fmtMoney(1e6, 1, 'EUR')).toBe('€1.0M')
  })

  it('uses £ for GBP', () => {
    expect(fmtMoney(1e6, 1, 'GBP')).toBe('£1.0M')
  })

  it('uses "CHF" with nbsp for CHF', () => {
    expect(fmtMoney(1e6, 1, 'CHF')).toBe('CHF\u00A01.0M')
  })

  it('uses ¥ for JPY', () => {
    expect(fmtMoney(1e6, 1, 'JPY')).toBe('¥1.0M')
  })

  // Negative with each tier
  it('negative trillion', () => {
    expect(fmtMoney(-2e12)).toBe('-$2.0T')
  })

  it('negative billion', () => {
    expect(fmtMoney(-3e9)).toBe('-$3.0B')
  })

  it('negative million', () => {
    expect(fmtMoney(-4e6)).toBe('-$4.0M')
  })

  it('negative thousand', () => {
    expect(fmtMoney(-5000)).toBe('-$5K')
  })

  it('negative small number', () => {
    expect(fmtMoney(-42)).toBe('-$42')
  })

  // Zero
  it('formats zero without - prefix', () => {
    expect(fmtMoney(0)).toBe('$0')
  })
})

describe('fmtEur', () => {
  it('delegates to fmtMoney with EUR currency', () => {
    expect(fmtEur(1e6)).toBe('€1.0M')
  })

  it('passes decimals through', () => {
    expect(fmtEur(1.234e9, 2)).toBe('€1.23B')
  })

  it('returns dash for null', () => {
    expect(fmtEur(null)).toBe('—')
  })
})

describe('fmtPrice', () => {
  it('returns dash for null', () => {
    expect(fmtPrice(null)).toBe('—')
  })

  it('returns dash for undefined', () => {
    expect(fmtPrice(undefined)).toBe('—')
  })

  it('formats with $ and 2 decimal places by default', () => {
    expect(fmtPrice(123.4)).toBe('$123.40')
  })

  it('formats integer with .00', () => {
    expect(fmtPrice(50)).toBe('$50.00')
  })

  it('uses EUR symbol when specified', () => {
    expect(fmtPrice(99.9, 'EUR')).toBe('€99.90')
  })

  it('falls back to currency code for unknown currency', () => {
    expect(fmtPrice(10, 'XYZ')).toBe('XYZ\u00A010.00')
  })

  it('uses ¥ for JPY', () => {
    expect(fmtPrice(10, 'JPY')).toBe('¥10.00')
  })

  it('formats with thousands separator', () => {
    expect(fmtPrice(1234567.89)).toBe('$1,234,567.89')
  })
})

describe('fmtCompact', () => {
  it('formats EUR billions', () => {
    expect(fmtCompact(2.5e9, 'EUR')).toBe('€2.5B')
  })

  it('formats PLN millions', () => {
    expect(fmtCompact(5e6, 'PLN')).toBe('PLN\u00A05.0M')
  })

  it('uses 0 decimals for K', () => {
    expect(fmtCompact(1500)).toBe('€2K')
  })

  it('returns dash for null', () => {
    expect(fmtCompact(null)).toBe('—')
  })
})

describe('fmtDual', () => {
  it('returns just EUR for EUR-denominated values', () => {
    expect(fmtDual(1e6, 'EUR', 1e6)).toBe('€1.0M')
  })

  it('shows original first, EUR in parens for non-EUR', () => {
    expect(fmtDual(5e6, 'PLN', 1.17e6)).toBe('PLN\u00A05.0M (€1.2M)')
  })

  it('returns just original when EUR is null', () => {
    expect(fmtDual(5e6, 'PLN', null)).toBe('PLN\u00A05.0M')
  })

  it('returns dash when both null', () => {
    expect(fmtDual(null, 'PLN', null)).toBe('—')
  })

  it('handles SEK billion', () => {
    expect(fmtDual(2e9, 'SEK', 1.8e8)).toBe('SEK\u00A02.0B (€180.0M)')
  })
})
