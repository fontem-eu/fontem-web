/**
 * Shared formatting utilities for financial display values.
 */

export function fmtMoney(n, decimals = 1) {
  if (n == null) return '—'
  const neg = n < 0
  const abs = Math.abs(n)
  const sign = neg ? '-' : ''
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(decimals)}T`
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(decimals)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(decimals)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`
  return `${sign}$${abs.toLocaleString()}`
}

export function fmtPrice(n) {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
