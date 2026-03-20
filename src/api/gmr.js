/**
 * Fetch the GMR financial data for a ticker.
 * Endpoint: GET /api/<ticker>/gmr_data
 */
export async function fetchGmrData(ticker) {
  const res = await fetch(`/api/${encodeURIComponent(ticker)}/gmr_data`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * Fetch the fundamentals data for a ticker.
 * Endpoint: GET /api/<ticker>/fundamentals
 */
export async function fetchFundamentals(ticker) {
  const res = await fetch(`/api/${encodeURIComponent(ticker)}/fundamentals`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * Fetch the enterprise valuation data for a ticker.
 * Endpoint: GET /api/<ticker>/valuation
 */
export async function fetchValuation(ticker) {
  const res = await fetch(`/api/${encodeURIComponent(ticker)}/valuation`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
