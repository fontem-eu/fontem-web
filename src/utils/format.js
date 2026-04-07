/**
 * Shared formatting utilities for financial display values.
 *
 * fmtMoney — general purpose, defaults to $ (stock market data)
 * fmtEur   — procurement/lobbying data, always in EUR (€)
 * fmtPrice — share prices, defaults to $
 */

const CURRENCY_SYMBOLS = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF ' }

export function fmtMoney(n, decimals = 1, currency = 'USD') {
  if (n == null) return '—'
  const sym = CURRENCY_SYMBOLS[currency] || `${currency} `
  const neg = n < 0
  const abs = Math.abs(n)
  const sign = neg ? '-' : ''
  if (abs >= 1e12) return `${sign}${sym}${(abs / 1e12).toFixed(decimals)}T`
  if (abs >= 1e9) return `${sign}${sym}${(abs / 1e9).toFixed(decimals)}B`
  if (abs >= 1e6) return `${sign}${sym}${(abs / 1e6).toFixed(decimals)}M`
  if (abs >= 1e3) return `${sign}${sym}${(abs / 1e3).toFixed(0)}K`
  return `${sign}${sym}${abs.toLocaleString()}`
}

/** Format a value in EUR — for procurement, subsidies, lobbying data. */
export function fmtEur(n, decimals = 1) {
  return fmtMoney(n, decimals, 'EUR')
}

export function fmtPrice(n, currency = 'USD') {
  if (n == null) return '—'
  const sym = CURRENCY_SYMBOLS[currency] || `${currency} `
  return `${sym}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
