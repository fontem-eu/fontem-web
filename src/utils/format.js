/**
 * Shared formatting utilities for monetary values.
 *
 * Locale-aware via Intl.NumberFormat. Supports any ISO 4217 currency.
 *
 * Functions:
 *   fmtMoney(n, currency, opts)  — generic money formatter
 *   fmtEur(n, opts)              — EUR shorthand
 *   fmtUsd(n, opts)              — USD shorthand (US filings/market data)
 *   fmtPrice(n, currency)        — exact price for stock data
 *   fmtCompact(n, currency)      — compact (1.2M, 1.5B) for charts
 *   fmtDual(orig, ccy, eur)      — "1.2M PLN (€280K)" for contract displays
 */

// Symbol overrides for currencies where Intl gives ugly output
const SYMBOL_OVERRIDES = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  CHF: 'CHF\u00A0',
  JPY: '¥',
  CNY: '¥',
}

/**
 * Compact money formatter — uses K/M/B/T suffixes for big numbers.
 * Always uses en-US locale for consistency on charts.
 */
export function fmtCompact(n, currency = 'EUR', decimals = 1) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  n = Number(n)
  const sym = SYMBOL_OVERRIDES[currency] || `${currency}\u00A0`
  const neg = n < 0
  const abs = Math.abs(n)
  const sign = neg ? '-' : ''
  if (abs >= 1e12) return `${sign}${sym}${(abs / 1e12).toFixed(decimals)}T`
  if (abs >= 1e9) return `${sign}${sym}${(abs / 1e9).toFixed(decimals)}B`
  if (abs >= 1e6) return `${sign}${sym}${(abs / 1e6).toFixed(decimals)}M`
  if (abs >= 1e3) return `${sign}${sym}${(abs / 1e3).toFixed(0)}K`
  return `${sign}${sym}${abs.toLocaleString('en-US')}`
}

/**
 * Generic money formatter — defaults to EUR compact (K/M/B/T).
 *
 * This is a euro-denominated platform: procurement values, cohesion
 * budgets and lobbying declarations are all EUR, and every one of them
 * used to render with a '$' because the default said USD. A caller
 * whose figures really are another currency passes it explicitly — the
 * North-America market panels do (see ValuationPanel, ProfilePanel).
 *
 * Two calling styles supported:
 *   fmtMoney(n)                                  → '€1.5B'
 *   fmtMoney(n, decimals)                        → legacy positional (deprecated)
 *   fmtMoney(n, decimals, currency)              → legacy positional (deprecated)
 *   fmtMoney(n, currency, { compact: false })    → new style with Intl
 *
 * @param {number|string} n
 * @param {string|number} arg2  - currency code or (legacy) decimals
 * @param {string|object} arg3  - opts object or (legacy) currency code
 */
export function fmtMoney(n, arg2 = 'EUR', arg3 = {}) {
  if (n == null || Number.isNaN(Number(n))) return '—'

  // Legacy positional: fmtMoney(n, decimals, currency)
  if (typeof arg2 === 'number') {
    const currency = typeof arg3 === 'string' ? arg3 : 'EUR'
    return fmtCompact(n, currency, arg2)
  }

  // New style: fmtMoney(n, currency, opts)
  const currency = arg2
  const opts = arg3 || {}
  if (opts.compact !== false) return fmtCompact(n, currency, opts.decimals ?? 1)

  // Coerce n to a number once so the type is unambiguous downstream
  const num = Number(n)
  const locale = opts.locale || (typeof navigator !== 'undefined' && navigator.language) || 'en-US'
  const decimals = opts.decimals ?? (Math.abs(num) >= 1000 ? 0 : 2)
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num)
  } catch {
    return fmtCompact(num, currency, decimals)
  }
}

/**
 * Format a value in USD (compact: $1.5B).
 *
 * For the North-America financial statements and market data — revenue,
 * assets, equity, cashflow, EBITDA, market cap — which come from the US
 * price/filing feeds and are dollars. Everything euro-denominated uses
 * the default; this shorthand exists so a dollar figure has to say so.
 */
export function fmtUsd(n, decimalsOrOpts = 1) {
  if (typeof decimalsOrOpts === 'number') {
    return fmtCompact(n, 'USD', decimalsOrOpts)
  }
  return fmtMoney(n, 'USD', { compact: true, ...decimalsOrOpts })
}

/** Format a value in EUR (compact: €1.5B). */
export function fmtEur(n, decimalsOrOpts = 1) {
  if (typeof decimalsOrOpts === 'number') {
    return fmtCompact(n, 'EUR', decimalsOrOpts)
  }
  return fmtMoney(n, 'EUR', { compact: true, ...decimalsOrOpts })
}

/** Format a stock price (always 2 decimals). */
export function fmtPrice(n, currency = 'USD') {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const sym = SYMBOL_OVERRIDES[currency] || `${currency}\u00A0`
  return `${sym}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Dual-currency formatter for contract displays.
 * Returns "1.2M PLN (€280K)" — original first, EUR in parentheses.
 * If the original already is EUR, returns just "€1.2M".
 */
export function fmtDual(originalValue, currency, eurValue) {
  if (originalValue == null && eurValue == null) return '—'
  if (currency === 'EUR' || !currency) {
    return fmtCompact(originalValue ?? eurValue, 'EUR')
  }
  const orig = fmtCompact(originalValue, currency)
  if (eurValue == null) return orig
  const eur = fmtCompact(eurValue, 'EUR')
  return `${orig} (${eur})`
}
