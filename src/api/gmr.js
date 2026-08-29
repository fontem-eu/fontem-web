import { withLang } from './_lang.js'
import { fetchRetrying } from './_retry.js'

/**
 * Fetch the GMR financial data for a ticker.
 * Endpoint: GET /api/<ticker>/gmr_data
 *
 * @param {string} ticker
 * @param {number} years  — number of historical fiscal years (default 10)
 */
export async function fetchGmrData(ticker, years = 10) {
  const res = await fetchRetrying(withLang(`/api/${encodeURIComponent(ticker)}/gmr_data?years=${years}`))
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

/**
 * Fetch the fundamentals data for a ticker.
 * Endpoint: GET /api/<ticker>/fundamentals
 *
 * @param {string} ticker
 * @param {number} years  — number of historical fiscal years (default 10)
 */
export async function fetchFundamentals(ticker, years = 10) {
  const res = await fetchRetrying(withLang(`/api/${encodeURIComponent(ticker)}/fundamentals?years=${years}`))
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

/**
 * Fetch the enterprise valuation data for a ticker.
 * Endpoint: GET /api/<ticker>/valuation
 *
 * @param {string} ticker
 * @param {number} years  — number of historical fiscal years (default 10)
 */
export async function fetchValuation(ticker, years = 10) {
  const res = await fetchRetrying(withLang(`/api/${encodeURIComponent(ticker)}/valuation?years=${years}`))
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

/**
 * Fetch daily OHLCV price history for a ticker.
 * Endpoint: GET /api/<ticker>/prices?period=<period>
 *
 * @param {string} ticker
 * @param {string} period  — one of: 1m, 6m, 1y, 3y, 5y, all
 */
export async function fetchPriceHistory(ticker, period = '1y') {
  const res = await fetchRetrying(
    withLang(`/api/${encodeURIComponent(ticker)}/prices?period=${encodeURIComponent(period)}`),
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}
