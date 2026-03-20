import { test, expect } from '@playwright/test'

test.describe('Data view selection', () => {
  test('navigating to /:ticker redirects to /:ticker/fundamentals', async ({ page }) => {
    await page.goto('/AAPL')
    await expect(page).toHaveURL(/\/AAPL\/fundamentals$/, { timeout: 5000 })
  })

  test('shows the DataViewSelector when a ticker is loaded', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    await expect(page.locator('[data-testid="view-selector"]')).toBeVisible({ timeout: 5000 })
  })

  test('"Fundamentals" option is active by default', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    const btn = page.locator('[data-testid="view-opt-fundamentals"]')
    await expect(btn).toBeVisible({ timeout: 5000 })
    await expect(btn).toHaveClass(/gmr-view-sel__item--active/)
  })

  test('"GMR Long" option is not active on fundamentals route', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    const btn = page.locator('[data-testid="view-opt-gmr-long"]')
    await expect(btn).toBeVisible({ timeout: 5000 })
    await expect(btn).not.toHaveClass(/gmr-view-sel__item--active/)
  })

  test('clicking "GMR Long" changes URL to /:ticker/gmr-long', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    await page.locator('[data-testid="view-opt-gmr-long"]').waitFor({ timeout: 5000 })

    await page.locator('[data-testid="view-opt-gmr-long"]').click()

    await expect(page).toHaveURL(/\/AAPL\/gmr-long$/, { timeout: 3000 })
  })

  test('"GMR Long" becomes active after clicking it', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    await page.locator('[data-testid="view-opt-gmr-long"]').click()

    await expect(page.locator('[data-testid="view-opt-gmr-long"]')).toHaveClass(
      /gmr-view-sel__item--active/,
      { timeout: 3000 }
    )
    await expect(page.locator('[data-testid="view-opt-fundamentals"]')).not.toHaveClass(
      /gmr-view-sel__item--active/
    )
  })

  test('clicking "Fundamentals" after GMR Long switches back', async ({ page }) => {
    await page.goto('/AAPL/gmr-long')
    await page.locator('[data-testid="view-opt-fundamentals"]').waitFor({ timeout: 5000 })

    await page.locator('[data-testid="view-opt-fundamentals"]').click()

    await expect(page).toHaveURL(/\/AAPL\/fundamentals$/, { timeout: 3000 })
    await expect(page.locator('[data-testid="view-opt-fundamentals"]')).toHaveClass(
      /gmr-view-sel__item--active/
    )
  })

  test('direct navigation to /:ticker/gmr-long shows GMR Long as active', async ({ page }) => {
    await page.goto('/MSFT/gmr-long')
    await expect(page.locator('[data-testid="view-opt-gmr-long"]')).toHaveClass(
      /gmr-view-sel__item--active/,
      { timeout: 5000 }
    )
    await expect(page.locator('[data-testid="view-opt-fundamentals"]')).not.toHaveClass(
      /gmr-view-sel__item--active/
    )
  })

  test('financials panel reloads when switching views', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    await page.locator('[data-testid="financials-panel"]').waitFor({ timeout: 8000 })

    await page.locator('[data-testid="view-opt-gmr-long"]').click()

    // Panel should go into loading and then reload
    await expect(page.locator('[data-testid="financials-panel"]')).toBeVisible({ timeout: 8000 })
    await expect(page).toHaveURL(/\/AAPL\/gmr-long$/)
  })

  test('selecting a ticker from search preserves the current view', async ({ page }) => {
    await page.goto('/AAPL/gmr-long')
    await page.locator('[data-testid="view-selector"]').waitFor({ timeout: 5000 })

    // Search for another ticker
    await page.fill('input[type="search"]', 'MSFT')
    const msftCard = page.locator('.gmr-card').filter({ hasText: 'MSFT' }).first()
    await msftCard.waitFor({ timeout: 5000 })
    await msftCard.click()

    await expect(page).toHaveURL(/\/MSFT\/gmr-long$/, { timeout: 3000 })
    await expect(page.locator('[data-testid="view-opt-gmr-long"]')).toHaveClass(
      /gmr-view-sel__item--active/
    )
  })

  test('DataViewSelector is not shown on the root route', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="view-selector"]')).not.toBeVisible()
  })

  test('closing financials hides the DataViewSelector', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    await page.locator('[data-testid="financials-panel"]').waitFor({ timeout: 8000 })

    await page.locator('button[aria-label="Close financials"]').click()

    await expect(page).toHaveURL('/', { timeout: 3000 })
    await expect(page.locator('[data-testid="view-selector"]')).not.toBeVisible()
  })

  test('"Valuation" option is present in the view selector', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    const btn = page.locator('[data-testid="view-opt-valuation"]')
    await expect(btn).toBeVisible({ timeout: 5000 })
  })

  test('clicking "Valuation" changes URL to /:ticker/valuation', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    await page.locator('[data-testid="view-opt-valuation"]').waitFor({ timeout: 5000 })

    await page.locator('[data-testid="view-opt-valuation"]').click()

    await expect(page).toHaveURL(/\/AAPL\/valuation$/, { timeout: 3000 })
  })

  test('"Valuation" becomes active after clicking it', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    await page.locator('[data-testid="view-opt-valuation"]').click()

    await expect(page.locator('[data-testid="view-opt-valuation"]')).toHaveClass(
      /gmr-view-sel__item--active/,
      { timeout: 3000 }
    )
    await expect(page.locator('[data-testid="view-opt-fundamentals"]')).not.toHaveClass(
      /gmr-view-sel__item--active/
    )
  })

  test('direct navigation to /:ticker/valuation shows Valuation as active', async ({ page }) => {
    await page.goto('/MSFT/valuation')
    await expect(page.locator('[data-testid="view-opt-valuation"]')).toHaveClass(
      /gmr-view-sel__item--active/,
      { timeout: 5000 }
    )
  })

  test('valuation view renders the valuation panel', async ({ page }) => {
    await page.goto('/AAPL/valuation')
    await expect(page.locator('[data-testid="valuation-panel"]')).toBeVisible({ timeout: 10000 })
  })

  test('valuation panel shows EV snapshot section', async ({ page }) => {
    await page.goto('/AAPL/valuation')
    await expect(page.locator('[data-testid="val-snapshot"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="val-ev"]')).toBeVisible()
    await expect(page.locator('[data-testid="val-ev-ebitda"]')).toBeVisible()
  })

  test('valuation panel shows per-year table with EBITDA', async ({ page }) => {
    await page.goto('/AAPL/valuation')
    await expect(page.locator('[data-testid="val-annual-table"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="val-annual-table"]')).toContainText('EBITDA')
    await expect(page.locator('[data-testid="val-annual-table"]')).toContainText('ROIC')
  })

  test('switching from valuation back to fundamentals works', async ({ page }) => {
    await page.goto('/AAPL/valuation')
    await page.locator('[data-testid="view-opt-fundamentals"]').waitFor({ timeout: 5000 })

    await page.locator('[data-testid="view-opt-fundamentals"]').click()

    await expect(page).toHaveURL(/\/AAPL\/fundamentals$/, { timeout: 3000 })
    await expect(page.locator('[data-testid="view-opt-fundamentals"]')).toHaveClass(
      /gmr-view-sel__item--active/
    )
  })

  test('fundamentals market snapshot now includes Beta', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    await expect(page.locator('[data-testid="fund-snap-beta"]')).toBeVisible({ timeout: 10000 })
  })

  test('fundamentals market snapshot now includes 52-week high and low', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    await expect(page.locator('[data-testid="fund-snap-52h"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="fund-snap-52l"]')).toBeVisible({ timeout: 10000 })
  })
})
