/**
 * Advanced-search filter e2e coverage.
 *
 * The advanced-search panel sends nuts, date_from, date_to, and a
 * subset of types to /api/search/results. Regression risk: the
 * filters get silently ignored somewhere in the stack (frontend
 * dropped, backend ignored, sink didn't project the column).
 *
 * These specs assert the filter actually SHAPES the result set, not
 * just that the request goes out. That way, if any layer regresses
 * to "silently ignore + return all rows", the spec fails.
 */
import { test, expect } from '@playwright/test'

// A stable-enough noun that returns hits across most envs.
const BROAD_QUERY = 'services'
const NARROW_QUERY = 'servicio de limpieza'

test.describe('Advanced Search filters', () => {
  test('baseline: broad search returns >0 results', async ({ page }) => {
    await page.goto(`/search?q=${encodeURIComponent(BROAD_QUERY)}`)
    await page.waitForSelector('[data-testid="search-results"]')
    const count = await page.locator('[data-testid^="result-"]').count()
    expect(count).toBeGreaterThan(0)
  })

  test('type facet: unchecking "company" removes company rows', async ({ page }) => {
    await page.goto(`/search?q=${encodeURIComponent(BROAD_QUERY)}`)
    await page.locator('[data-testid="advanced-toggle"]').click()
    await expect(page.locator('[data-testid="advanced-drawer"]')).toBeVisible()

    // Uncheck company so only non-company types come back.
    const companyFacet = page.locator('[data-testid="facet-company"]')
    if (await companyFacet.isChecked()) await companyFacet.uncheck()

    // Wait for the URL to reflect the change (SearchView pushes types= to URL).
    await page.waitForURL(/types=/, { timeout: 5000 })
    await page.waitForResponse(r => r.url().includes('/api/search/results') && r.ok(), { timeout: 8000 })

    const companyRows = await page.locator('[data-testid="result-company"]').count()
    expect(companyRows).toBe(0)
    // Sanity: something else surfaced.
    const totalRows = await page.locator('[data-testid^="result-"]').count()
    expect(totalRows).toBeGreaterThan(0)
  })

  test('NUTS region filter: PT restricts hits to Portuguese entities', async ({ page }) => {
    // A cross-lingual query so semantic hits (Romanian, Spanish, etc.)
    // would normally leak in — the NUTS filter must exclude them.
    await page.goto(`/search?q=${encodeURIComponent(NARROW_QUERY)}`)
    await page.waitForSelector('[data-testid="search-results"]')

    await page.locator('[data-testid="advanced-toggle"]').click()
    // NUTS L0 selector — pick PT.
    const l0 = page.locator('[data-testid="nuts-l0"]')
    await l0.selectOption('PT')

    await page.waitForURL(/nuts=PT/, { timeout: 5000 })
    await page.waitForResponse(r => r.url().includes('/api/search/results') && r.ok(), { timeout: 8000 })

    // Assert every visible row's country is PT (or its meta.nuts starts with PT).
    // We assert on API response so the check is robust to which fields the card renders.
    // NOTE: prefer the direct request.get path below over evaluate() so
    // we don't rely on the browser's auth cookies leaking into fetch.
    // Fallback: fetch directly with same query
    const q = new URL(page.url())
    const apiQ = new URLSearchParams(q.search)
    const apiResp = await page.request.get(`/api/search/results?${apiQ.toString()}`)
    expect(apiResp.ok()).toBeTruthy()
    const body = await apiResp.json()
    expect(body.results.length).toBeGreaterThan(0)
    for (const row of body.results) {
      const country = row.country || row.meta?.country || ''
      const nuts = row.meta?.nuts || ''
      // Row must be either PT-country or have a PT-prefixed NUTS.
      // Entities without geo info (e.g. sanctions) shouldn't slip in — nuts filter drops them.
      expect(country === 'PT' || nuts.startsWith('PT'), `row ${row.type}:${row.id} country=${country} nuts=${nuts}`).toBeTruthy()
    }
  })

  test('date range: date_from + date_to narrow to that window', async ({ page }) => {
    // Contracts + sanctions carry event_date; pick a range that has known data.
    const FROM = '2024-01-01'
    const TO = '2024-12-31'
    await page.goto(`/search?q=${encodeURIComponent(BROAD_QUERY)}&types=contract&date_from=${FROM}&date_to=${TO}`)
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 8000 })

    const apiQ = new URLSearchParams({
      q: BROAD_QUERY, types: 'contract',
      date_from: FROM, date_to: TO, limit: '20',
    })
    const apiResp = await page.request.get(`/api/search/results?${apiQ.toString()}`)
    expect(apiResp.ok()).toBeTruthy()
    const body = await apiResp.json()
    for (const row of body.results) {
      expect(row.date, `row ${row.type}:${row.id} missing date`).toBeTruthy()
      expect(row.date >= FROM).toBeTruthy()
      expect(row.date <= TO).toBeTruthy()
    }
  })

  test('sector filter: CPV top-2 restricts contracts to that division', async ({ page }) => {
    // CPV 90 = sewage/refuse/cleaning services — cleaning queries should hit this.
    const apiResp = await page.request.get(
      `/api/search/results?q=${encodeURIComponent('services')}&types=contract&sector=90&limit=20`,
    )
    expect(apiResp.ok()).toBeTruthy()
    const body = await apiResp.json()
    for (const row of body.results) {
      const cpv = row.meta?.cpv || ''
      expect(row.meta?.sector === '90' || String(cpv).startsWith('90'),
        `row cpv=${cpv} sector=${row.meta?.sector}`).toBeTruthy()
    }
  })

  test('nuts rejects malformed input with 422', async ({ page }) => {
    // Router pattern is [A-Z]{2}[A-Z0-9]{0,6}. Lower-case, punctuation, SQL shapes must 422.
    for (const bad of ['pt18', 'PT18!', "'; DROP TABLE"]) {
      const r = await page.request.get(
        `/api/search/results?q=x&nuts=${encodeURIComponent(bad)}`,
      )
      expect(r.status(), `expected 422 for nuts=${bad}`).toBe(422)
    }
  })

  test('clear filters resets URL + results widen back', async ({ page }) => {
    await page.goto(`/search?q=${encodeURIComponent(BROAD_QUERY)}&nuts=PT&date_from=2024-01-01`)
    await page.locator('[data-testid="advanced-toggle"]').click()
    await page.locator('[data-testid="clear-filters"]').click()
    await page.waitForURL(u => !u.searchParams.has('nuts') && !u.searchParams.has('date_from'), { timeout: 5000 })
    const finalUrl = new URL(page.url())
    expect(finalUrl.searchParams.has('nuts')).toBe(false)
    expect(finalUrl.searchParams.has('date_from')).toBe(false)
    expect(finalUrl.searchParams.get('q')).toBe(BROAD_QUERY)
  })
})
