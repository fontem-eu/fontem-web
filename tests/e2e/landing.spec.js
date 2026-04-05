import { test, expect } from '@playwright/test'

test.describe('Landing page', () => {
  test('shows two path cards: graph search and reports', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="landing-paths"]')).toBeVisible()
    await expect(page.locator('[data-testid="path-graph"]')).toBeVisible()
    await expect(page.locator('[data-testid="path-reports"]')).toBeVisible()
  })

  test('graph path card contains a search input', async ({ page }) => {
    await page.goto('/')
    const graphCard = page.locator('[data-testid="path-graph"]')
    await expect(graphCard.locator('input[type="search"]')).toBeVisible()
  })

  test('reports path card links to /reports', async ({ page }) => {
    await page.goto('/')
    const reportsCard = page.locator('[data-testid="path-reports"]')
    await expect(reportsCard).toBeVisible()
    await reportsCard.click()
    await expect(page).toHaveURL(/\/reports/, { timeout: 3000 })
  })

  test('shows sign-in CTA for anonymous users', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="anon-cta"]')).toBeVisible()
    await expect(page.locator('[data-testid="anon-cta"]')).toContainText('Sign in')
  })

  test('popular ticker buttons are visible', async ({ page }) => {
    await page.goto('/')
    const aapl = page.locator('button', { hasText: 'AAPL' })
    await expect(aapl).toBeVisible()
  })

  test('clicking a popular ticker navigates to company view', async ({ page }) => {
    await page.goto('/')
    await page.locator('button', { hasText: 'AAPL' }).click()
    await expect(page).toHaveURL(/\/c\/AAPL\//, { timeout: 3000 })
  })

  test('feature cards are visible on desktop', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="features-grid"]')).toBeVisible()
  })
})
