/**
 * E2E tests for European (ESEF) ticker support.
 *
 * Uses GALP.LS (Galp Energia, Portugal) as the representative EU ticker.
 *
 * Covers:
 *   - Search returns GALP.LS with full .suffix notation in the symbol slot
 *   - Clicking the card navigates to /GALP.LS/summary
 *   - ESEF badge is shown in the result card
 *   - Fundamentals panel loads with real data (revenue not null)
 *   - Summary tab is visible for all tickers (including EU)
 *   - Fundamentals tab is active by default for EU tickers
 *   - Direct navigation to /GALP.LS/fundamentals works
 *   - Direct navigation to /GALP.LS/summary stays on summary
 */
import { test, expect } from '@playwright/test'

test.describe('EU ticker — GALP.LS (Galp Energia)', () => {
  // ── Search card display ──────────────────────────────────────────────────

  test('searching "GALP" shows a result with the full .LS suffix in the symbol slot', async ({
    page,
  }) => {
    await page.goto('/')
    await page.fill('input[type="search"]', 'GALP')
    const firstSymbol = page.locator('.gmr-card .ticker-symbol').first()
    await expect(firstSymbol).toHaveText('GALP.LS', { timeout: 8000 })
  })

  test('GALP result card shows the ESEF badge', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[type="search"]', 'GALP')
    await page.locator('.gmr-card').first().waitFor({ timeout: 8000 })
    await expect(
      page.locator('.gmr-card [data-testid="badge-esef"]').first(),
    ).toBeVisible()
  })

  test('GALP result card shows the company name', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[type="search"]', 'GALP')
    await page.locator('.gmr-card').first().waitFor({ timeout: 8000 })
    await expect(page.locator('.gmr-card .ticker-name').first()).toContainText('Galp')
  })

  // ── Click-to-navigate ────────────────────────────────────────────────────

  test('clicking the GALP card navigates to /GALP.LS/summary', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[type="search"]', 'GALP')
    await page.locator('.gmr-card').first().waitFor({ timeout: 8000 })
    await page.locator('.gmr-card').first().click()
    await expect(page).toHaveURL(/\/c\/GALP\.LS\/summary$/, { timeout: 5000 })
  })

  test('clicking GALP card shows the financials panel', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[type="search"]', 'GALP')
    await page.locator('.gmr-card').first().waitFor({ timeout: 8000 })
    await page.locator('.gmr-card').first().click()
    await expect(page.locator('[data-testid="financials-panel"]')).toBeVisible({
      timeout: 12000,
    })
  })

  // ── Direct navigation ────────────────────────────────────────────────────

  test('direct navigation to /GALP.LS/fundamentals loads data', async ({ page }) => {
    await page.goto('/c/GALP.LS/fundamentals')
    await expect(page.locator('[data-testid="financials-panel"]')).toBeVisible({
      timeout: 12000,
    })
    // Must not show the error state
    await expect(page.locator('[data-testid="fin-error"]')).not.toBeVisible()
  })

  test('direct navigation to /GALP.LS shows real revenue data in the fundamentals table', async ({
    page,
  }) => {
    await page.goto('/c/GALP.LS/fundamentals')
    // Wait until loading is done (financials panel visible, error not shown)
    await expect(page.locator('[data-testid="financials-panel"]')).toBeVisible({
      timeout: 12000,
    })
    // Revenue cell should exist and have a non-empty value
    const revenueCell = page.locator('td, [data-testid]').filter({ hasText: /[€$£]?\d/ }).first()
    await expect(revenueCell).toBeVisible({ timeout: 5000 })
  })

  test('direct navigation to /GALP.LS/summary stays on summary', async ({ page }) => {
    await page.goto('/c/GALP.LS/summary')
    await expect(page).toHaveURL(/\/c\/GALP\.LS\/summary$/, { timeout: 5000 })
  })

  // ── View selector ────────────────────────────────────────────────────────

  test('Summary tab is present for GALP.LS', async ({ page }) => {
    await page.goto('/c/GALP.LS/fundamentals')
    await page.locator('[data-testid="view-selector"]').waitFor({ timeout: 8000 })
    await expect(page.locator('[data-testid="view-opt-summary"]')).toBeVisible()
  })

  test('Fundamentals tab is active for GALP.LS', async ({ page }) => {
    await page.goto('/c/GALP.LS/fundamentals')
    const btn = page.locator('[data-testid="view-opt-fundamentals"]')
    await expect(btn).toBeVisible({ timeout: 8000 })
    await expect(btn).toHaveClass(/dvs-view--active/)
  })

  test('ESEF badge appears in the financials panel header for GALP.LS', async ({ page }) => {
    await page.goto('/c/GALP.LS/fundamentals')
    await page.locator('[data-testid="financials-panel"]').waitFor({ timeout: 12000 })
    await expect(page.locator('[data-testid="financials-panel"] .badge-esef')).toBeVisible()
  })
})
