import { test, expect } from '@playwright/test'

test.describe('Landing page', () => {
  test('shows the centered search card', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="landing"]')).toBeVisible()
    await expect(page.locator('input[type="search"]').first()).toBeVisible()
  })

  test('shows the explainer paragraph naming the four data sources', async ({ page }) => {
    await page.goto('/')
    const explainer = page.locator('[data-testid="landing-explainer"]')
    await expect(explainer).toBeVisible()
    const text = await explainer.innerText()
    expect(text).toMatch(/TED/)
    expect(text).toMatch(/GLEIF/)
    expect(text).toMatch(/Transparency Register/)
    expect(text).toMatch(/Cohesion/)
  })

  test('renders three example chips, each linking to a / path', async ({ page }) => {
    await page.goto('/')
    const chips = page.locator('[data-testid="example-chips"] a')
    await expect(chips).toHaveCount(3)
    for (let i = 0; i < 3; i++) {
      const href = await chips.nth(i).getAttribute('href')
      expect(href).toMatch(/^\//)
    }
  })

  test('clicking the first example chip navigates away from /', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="example-chips"] a').first().click()
    await expect(page).not.toHaveURL(/^\/?$/, { timeout: 3000 })
  })

  test('renders three "how it works" steps', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="howitworks"]')).toBeVisible()
    await expect(page.locator('[data-testid="howitworks"] .howitworks-step'))
      .toHaveCount(3)
    await expect(page.locator('[data-testid="howitworks-step-search"]')).toBeVisible()
    await expect(page.locator('[data-testid="howitworks-step-crosscheck"]')).toBeVisible()
    await expect(page.locator('[data-testid="howitworks-step-publish"]')).toBeVisible()
  })

  test('the recent-reports section renders when public reports exist', async ({ page }) => {
    // The /capi/reports?scope=public endpoint may be empty in some envs;
    // tolerate that — the section is gated on length and is allowed to
    // not render. When it does render, it must show at least one card.
    await page.goto('/')
    const section = page.locator('[data-testid="recent-reports"]')
    if (await section.count()) {
      await expect(section.locator('.report-card').first()).toBeVisible()
    }
  })

  test('hides the landing-extra section once a ticker is selected', async ({ page }) => {
    await page.goto('/c/AAPL/fundamentals')
    await expect(page.locator('[data-testid="landing-extra"]')).toHaveCount(0)
  })
})
