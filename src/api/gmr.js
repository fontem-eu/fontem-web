/**
 * Fetch the GMR financial data for a ticker.
 * Endpoint: GET /api/<ticker>/gmr_data
 */
export async function fetchGmrData(ticker) {
  const res = await fetch(`/api/${encodeURIComponent(ticker)}/gmr_data`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
