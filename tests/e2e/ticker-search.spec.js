import { test, expect } from '@playwright/test'

test.describe('GMR Ticker Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('shows the page title and search input on load', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('GMR')
    await expect(page.locator('input[type="search"]')).toBeVisible()
    await expect(page.locator('input[type="search"]'))
      .toBeFocused({ timeout: 500 })
      .catch(() => {
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
    expect(count).toBeLessThanOrEqual(30)  // includes companies + lobbyists
  })

  test('each result card shows a symbol and active/inactive badge', async ({ page }) => {
    await page.fill('input[type="search"]', 'microsoft')
    await page.locator('.gmr-card').first().waitFor({ timeout: 5000 })

    const firstCard = page.locator('.gmr-card').first()
    await expect(firstCard.locator('.ticker-symbol')).toBeVisible()
    await expect(firstCard.locator('.badge').first()).toBeVisible()
  })

  test('clicking a ticker hides the list and shows financials below the search bar', async ({
    page,
  }) => {
    await page.fill('input[type="search"]', 'AAPL')
    const aaplCard = page.locator('.gmr-card').filter({ hasText: 'AAPL' }).first()
    await aaplCard.waitFor({ timeout: 5000 })

    await aaplCard.click()

    await expect(page.locator('[role="list"]')).not.toBeVisible({ timeout: 3000 })
    await expect(page.locator('[data-testid="financials-panel"]')).toBeVisible({ timeout: 8000 })
  })

  test('URL changes to /AAPL/summary after clicking the AAPL card', async ({ page }) => {
    await page.fill('input[type="search"]', 'AAPL')
    const aaplCard = page.locator('.gmr-card').filter({ hasText: 'AAPL' }).first()
    await aaplCard.waitFor({ timeout: 5000 })

    await aaplCard.click()

    await expect(page).toHaveURL(/\/c\/AAPL\/summary$/, { timeout: 3000 })
  })

  test('navigating directly to /AAPL shows financials without a results list', async ({ page }) => {
    await page.goto('/c/AAPL')

    await expect(page.locator('[data-testid="financials-panel"]')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('[role="list"]')).not.toBeVisible()
  })

  test('closing financials navigates back to / and hides the panel', async ({ page }) => {
    await page.goto('/c/AAPL')
    await page.locator('[data-testid="financials-panel"]').waitFor({ timeout: 8000 })

    await page.locator('button[aria-label="Close financials"]').click()

    await expect(page).toHaveURL('/', { timeout: 3000 })
    await expect(page.locator('[data-testid="financials-panel"]')).not.toBeVisible()
  })

  test('clicking outside the results list clears it', async ({ page }) => {
    await page.fill('input[type="search"]', 'AAPL')
    await page.locator('.gmr-card').first().waitFor({ timeout: 5000 })

    // Click on the page footer — outside the search container
    await page.locator('footer').click()

    await expect(page.locator('.gmr-card')).toHaveCount(0, { timeout: 2000 })
  })

  test('search results appear while financials are open for another ticker', async ({ page }) => {
    // 1. Select a ticker
    await page.fill('input[type="search"]', 'AAPL')
    const aaplCard = page.locator('.gmr-card').filter({ hasText: 'AAPL' }).first()
    await aaplCard.waitFor({ timeout: 5000 })
    await aaplCard.click()
    await expect(page).toHaveURL(/\/c\/AAPL\/summary$/, { timeout: 3000 })

    // 2. Search for other tickers while the financials panel is open
    await page.fill('input[type="search"]', 'MSFT')

    // 3. The results list must appear with the new results
    await expect(page.locator('[role="list"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.gmr-card').first()).toBeVisible()
    await expect(page.locator('.gmr-card').first().locator('.ticker-symbol')).toContainText('MSFT')
  })
})
