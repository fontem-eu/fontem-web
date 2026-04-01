import { test, expect, devices } from '@playwright/test'

// Force Pixel 7 viewport for every test in this file,
// regardless of which Playwright project runs it.
test.use({ ...devices['Pixel 7'] }) // 412×839

test.describe('Responsive layout — Android (Pixel 7, 412px)', () => {
  // ── Home page ────────────────────────────────────────────────

  test('home page has no horizontal overflow', async ({ page }) => {
    await page.goto('/')
    const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })

  test('logo and search input are both visible in the header', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('input[type="search"]')).toBeVisible()
  })

  test('header does not overflow the viewport width', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('header')
    const box = await header.boundingBox()
    expect(box.width).toBeLessThanOrEqual(412)
  })

  test('feature cards grid is hidden on mobile (compact landing)', async ({ page }) => {
    await page.goto('/')
    // Feature cards are desktop-only — hidden on mobile to keep the landing page compact
    await expect(page.locator('[data-testid="features-grid"]')).toBeHidden()
  })

  test('popular tickers are visible and tappable on mobile', async ({ page }) => {
    await page.goto('/')
    // Popular ticker buttons should be visible and usable
    const aaplBtn = page.locator('button', { hasText: 'AAPL' })
    await expect(aaplBtn).toBeVisible()
    const box = await aaplBtn.boundingBox()
    // Each button should be at least 24px tall for comfortable tapping
    expect(box.height).toBeGreaterThanOrEqual(24)
  })

  // ── Ticker detail layout ─────────────────────────────────────

  test('ticker detail stacks view-selector above financials panel', async ({ page }) => {
    await page.goto('/c/AAPL/fundamentals')
    await page.locator('[data-testid="financials-panel"]').waitFor({ timeout: 10000 })

    const selector = page.locator('[data-testid="view-selector"]')
    const panel = page.locator('[data-testid="financials-panel"]')

    const selBox = await selector.boundingBox()
    const panelBox = await panel.boundingBox()

    // On mobile the view selector should be ABOVE the financials panel
    expect(selBox.y + selBox.height).toBeLessThanOrEqual(panelBox.y + 2)
  })

  test('DataViewSelector renders as horizontal tabs on mobile', async ({ page }) => {
    await page.goto('/c/AAPL/fundamentals')
    await page.locator('[data-testid="view-selector"]').waitFor({ timeout: 10000 })

    const flexDir = await page.locator('[data-testid="view-selector"]').evaluate(
      el => getComputedStyle(el).flexDirection
    )
    expect(flexDir).toBe('row')
  })

  test('all view tabs are visible on mobile', async ({ page }) => {
    await page.goto('/c/AAPL/fundamentals')
    await page.locator('[data-testid="view-selector"]').waitFor({ timeout: 10000 })

    await expect(page.locator('[data-testid="view-opt-summary"]')).toBeVisible()
    await expect(page.locator('[data-testid="view-opt-fundamentals"]')).toBeVisible()
    await expect(page.locator('[data-testid="view-opt-income"]')).toBeVisible()
    await expect(page.locator('[data-testid="view-opt-cashflow"]')).toBeVisible()
    await expect(page.locator('[data-testid="view-opt-balance"]')).toBeVisible()
    await expect(page.locator('[data-testid="view-opt-valuation"]')).toBeVisible()
    await expect(page.locator('[data-testid="view-opt-gmr-long"]')).toBeVisible()
  })

  test('ticker detail has no horizontal overflow', async ({ page }) => {
    await page.goto('/c/AAPL/fundamentals')
    await page.locator('[data-testid="financials-panel"]').waitFor({ timeout: 10000 })

    const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })

  test('financials panel fills the viewport width on mobile', async ({ page }) => {
    await page.goto('/c/AAPL/fundamentals')
    await page.locator('[data-testid="financials-panel"]').waitFor({ timeout: 10000 })

    const panelBox = await page.locator('[data-testid="financials-panel"]').boundingBox()
    // Panel should be close to full viewport width (412px minus padding)
    expect(panelBox.width).toBeGreaterThan(350)
  })

  // ── Navigation on mobile ─────────────────────────────────────

  test('searching and clicking a ticker works on mobile', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[type="search"]', 'AAPL')
    const card = page.locator('.gmr-card').filter({ hasText: 'AAPL' }).first()
    await card.waitFor({ timeout: 5000 })
    await card.click()

    await expect(page).toHaveURL(/\/c\/AAPL\//, { timeout: 3000 })
    await expect(page.locator('[data-testid="financials-panel"]')).toBeVisible({ timeout: 10000 })
  })

  test('switching views via tabs works on mobile', async ({ page }) => {
    await page.goto('/c/AAPL/fundamentals')
    await page.locator('[data-testid="view-selector"]').waitFor({ timeout: 10000 })

    await page.locator('[data-testid="view-opt-gmr-long"]').click()
    await expect(page).toHaveURL(/\/c\/AAPL\/gmr-long$/, { timeout: 3000 })
    await expect(page.locator('[data-testid="view-opt-gmr-long"]')).toHaveClass(
      /gmr-view-sel__item--active/
    )
  })

  test('logo click navigates home on mobile', async ({ page }) => {
    await page.goto('/c/AAPL/fundamentals')
    await page.locator('[data-testid="financials-panel"]').waitFor({ timeout: 10000 })

    await page.locator('h1').click()
    await expect(page).toHaveURL('/', { timeout: 3000 })
  })

  // ── Slim logo ────────────────────────────────────────────────

  test('logo reads only "GMR" on mobile (not "Ticker Search")', async ({ page }) => {
    await page.goto('/')
    // "GMR" is visible
    await expect(page.locator('h1 span').first()).toBeVisible()
    await expect(page.locator('h1 span').first()).toHaveText('GMR')
    // "Ticker Search" span exists in DOM but is hidden
    const tickerSearchSpan = page.locator('h1 span', { hasText: 'Ticker Search' })
    await expect(tickerSearchSpan).toBeHidden()
  })

  test('search input has enough width to be usable when logo is slim', async ({ page }) => {
    await page.goto('/')
    const input = page.locator('input[type="search"]')
    await expect(input).toBeVisible()
    const box = await input.boundingBox()
    // On Pixel 7 (412px) the search bar should have at least 200px to type in
    expect(box.width).toBeGreaterThan(200)
  })
})
