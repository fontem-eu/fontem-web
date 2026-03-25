import { test, expect } from '@playwright/test'

test.describe('Data view selection', () => {
  test('navigating to /:ticker redirects to /:ticker/summary', async ({ page }) => {
    await page.goto('/AAPL')
    await expect(page).toHaveURL(/\/AAPL\/summary$/, { timeout: 5000 })
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
    await expect(page.locator('[data-testid="valuation-panel"]')).toBeVisible({ timeout: 20000 })
  })

  test('valuation panel shows EV snapshot section', async ({ page }) => {
    await page.goto('/AAPL/valuation')
    await expect(page.locator('[data-testid="val-snapshot"]')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('[data-testid="val-ev"]')).toBeVisible()
    await expect(page.locator('[data-testid="val-ev-ebitda"]')).toBeVisible()
  })

  test('valuation panel shows per-year table with EBITDA', async ({ page }) => {
    await page.goto('/AAPL/valuation')
    await expect(page.locator('[data-testid="val-annual-table"]')).toBeVisible({ timeout: 20000 })
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
    await expect(page.locator('[data-testid="fund-snap-beta"]')).toBeVisible({ timeout: 20000 })
  })

  test('fundamentals market snapshot now includes 52-week high and low', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    await expect(page.locator('[data-testid="fund-snap-52h"]')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('[data-testid="fund-snap-52l"]')).toBeVisible({ timeout: 20000 })
  })

  // ── Income view ─────────────────────────────────────────────

  test('"Income" option is present in the view selector', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    await expect(page.locator('[data-testid="view-opt-income"]')).toBeVisible({ timeout: 5000 })
  })

  test('clicking "Income" changes URL to /:ticker/income', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    await page.locator('[data-testid="view-opt-income"]').waitFor({ timeout: 5000 })
    await page.locator('[data-testid="view-opt-income"]').click()
    await expect(page).toHaveURL(/\/AAPL\/income$/, { timeout: 3000 })
  })

  test('"Income" becomes active after clicking it', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    await page.locator('[data-testid="view-opt-income"]').click()
    await expect(page.locator('[data-testid="view-opt-income"]')).toHaveClass(
      /gmr-view-sel__item--active/, { timeout: 3000 }
    )
    await expect(page.locator('[data-testid="view-opt-fundamentals"]')).not.toHaveClass(
      /gmr-view-sel__item--active/
    )
  })

  test('income view renders the income panel with per-year table', async ({ page }) => {
    await page.goto('/AAPL/income')
    await expect(page.locator('[data-testid="income-panel"]')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('[data-testid="income-table"]')).toBeVisible()
    await expect(page.locator('[data-testid="income-table"]')).toContainText('Revenue')
    await expect(page.locator('[data-testid="income-table"]')).toContainText('Net Income')
  })

  test('income view renders the averages strip', async ({ page }) => {
    await page.goto('/AAPL/income')
    await expect(page.locator('[data-testid="income-averages"]')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('[data-testid="income-averages"]')).toContainText('Avg P/E')
    await expect(page.locator('[data-testid="income-averages"]')).toContainText('Avg Net Margin')
  })

  // ── Cash Flow view ───────────────────────────────────────────

  test('"Cash Flow" option is present in the view selector', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    await expect(page.locator('[data-testid="view-opt-cashflow"]')).toBeVisible({ timeout: 5000 })
  })

  test('clicking "Cash Flow" changes URL to /:ticker/cashflow', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    await page.locator('[data-testid="view-opt-cashflow"]').waitFor({ timeout: 5000 })
    await page.locator('[data-testid="view-opt-cashflow"]').click()
    await expect(page).toHaveURL(/\/AAPL\/cashflow$/, { timeout: 3000 })
  })

  test('cashflow view renders the cashflow panel with per-year table', async ({ page }) => {
    await page.goto('/AAPL/cashflow')
    await expect(page.locator('[data-testid="cashflow-panel"]')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('[data-testid="cashflow-table"]')).toBeVisible()
    await expect(page.locator('[data-testid="cashflow-table"]')).toContainText('Free Cashflow')
    await expect(page.locator('[data-testid="cashflow-table"]')).toContainText('CapEx')
  })

  test('cashflow view renders the averages strip', async ({ page }) => {
    await page.goto('/AAPL/cashflow')
    await expect(page.locator('[data-testid="cashflow-averages"]')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('[data-testid="cashflow-averages"]')).toContainText('Avg FCF Yield')
  })

  // ── Balance view ─────────────────────────────────────────────

  test('"Balance" option is present in the view selector', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    await expect(page.locator('[data-testid="view-opt-balance"]')).toBeVisible({ timeout: 5000 })
  })

  test('clicking "Balance" changes URL to /:ticker/balance', async ({ page }) => {
    await page.goto('/AAPL/fundamentals')
    await page.locator('[data-testid="view-opt-balance"]').waitFor({ timeout: 5000 })
    await page.locator('[data-testid="view-opt-balance"]').click()
    await expect(page).toHaveURL(/\/AAPL\/balance$/, { timeout: 3000 })
  })

  test('balance view renders the balance panel with per-year table', async ({ page }) => {
    await page.goto('/AAPL/balance')
    await expect(page.locator('[data-testid="balance-panel"]')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('[data-testid="balance-table"]')).toBeVisible()
    await expect(page.locator('[data-testid="balance-table"]')).toContainText('Total Assets')
    await expect(page.locator('[data-testid="balance-table"]')).toContainText('Equity')
  })

  test('balance view renders the averages strip', async ({ page }) => {
    await page.goto('/AAPL/balance')
    await expect(page.locator('[data-testid="balance-averages"]')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('[data-testid="balance-averages"]')).toContainText('Avg D/E')
    await expect(page.locator('[data-testid="balance-averages"]')).toContainText('Avg ROE')
  })

  test('switching from balance back to fundamentals works', async ({ page }) => {
    await page.goto('/AAPL/balance')
    await page.locator('[data-testid="view-opt-fundamentals"]').waitFor({ timeout: 5000 })
    await page.locator('[data-testid="view-opt-fundamentals"]').click()
    await expect(page).toHaveURL(/\/AAPL\/fundamentals$/, { timeout: 3000 })
  })

  // ── Summary stats bar ─────────────────────────────────────────

  test('summary view shows the key stats bar', async ({ page }) => {
    await page.goto('/AAPL/summary')
    await expect(page.locator('[data-testid="summary-stats"]')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('[data-testid="summary-stats"]')).toContainText('Mkt Cap')
    await expect(page.locator('[data-testid="summary-stats"]')).toContainText('Beta')
  })
})
