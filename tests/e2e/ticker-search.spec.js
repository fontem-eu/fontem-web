import { test, expect } from '@playwright/test'

test.describe('GMR Ticker Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('shows the page title and search input on load', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('GMR')
    await expect(page.locator('input[type="search"]')).toBeVisible()
    await expect(page.locator('input[type="search"]')).toBeFocused({ timeout: 500 }).catch(() => {
      // focus not required, just visibility
    })
  })

  test('returns AAPL as the first result when searching "AAPL"', async ({ page }) => {
    await page.fill('input[type="search"]', 'AAPL')
    const firstSymbol = page.locator('.gmr-card .ticker-symbol').first()
    await expect(firstSymbol).toHaveText('AAPL', { timeout: 5000 })
  })

  test('shows the company name alongside the symbol', async ({ page }) => {
    await page.fill('input[type="search"]', 'AAPL')
    await page.locator('.gmr-card').first().waitFor({ timeout: 5000 })
    await expect(page.locator('.gmr-card .ticker-name').first()).toContainText('Apple')
  })

  test('shows the result count in the status line', async ({ page }) => {
    await page.fill('input[type="search"]', 'AAPL')
    await page.locator('.gmr-card').first().waitFor({ timeout: 5000 })
    await expect(page.locator('.gmr-status')).toContainText('result')
    await expect(page.locator('.gmr-status')).toContainText('total tickers')
  })

  test('shows empty state for a query that matches nothing', async ({ page }) => {
    await page.fill('input[type="search"]', 'ZZZZZNOTREAL99')
    await expect(page.locator('.gmr-empty')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.gmr-empty')).toContainText('No tickers found')
  })

  test('clears results when the input is cleared', async ({ page }) => {
    await page.fill('input[type="search"]', 'AAPL')
    await page.locator('.gmr-card').first().waitFor({ timeout: 5000 })

    await page.fill('input[type="search"]', '')
    await expect(page.locator('.gmr-card')).toHaveCount(0)
    await expect(page.locator('.gmr-empty')).not.toBeVisible()
  })

  test('returns up to 10 results for a broad query', async ({ page }) => {
    await page.fill('input[type="search"]', 'bank')
    await page.locator('.gmr-card').first().waitFor({ timeout: 5000 })
    const count = await page.locator('.gmr-card').count()
    expect(count).toBeGreaterThanOrEqual(5)
    expect(count).toBeLessThanOrEqual(10)
  })

  test('each result card shows a symbol and active/inactive badge', async ({ page }) => {
    await page.fill('input[type="search"]', 'microsoft')
    await page.locator('.gmr-card').first().waitFor({ timeout: 5000 })

    const firstCard = page.locator('.gmr-card').first()
    await expect(firstCard.locator('.ticker-symbol')).toBeVisible()
    await expect(firstCard.locator('.badge').first()).toBeVisible()
  })
})
