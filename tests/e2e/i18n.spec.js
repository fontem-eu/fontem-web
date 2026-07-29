import { test, expect } from '@playwright/test'

/**
 * Display settings must work with no account.
 *
 * Regression guard: 5dd542d ("lean profile menu") folded theme /
 * language / palette into the signed-in-only profile surface and moved
 * them to /account. /account stayed public, but the only affordance
 * pointing there reads "Log in" when signed out — so an anonymous
 * visitor had no discoverable way to change language. These specs
 * drive the gear from both surfaces it is mounted on (header bezel and
 * nav rail) as a genuinely signed-out visitor.
 *
 * Playwright's default context carries no cookies or localStorage, so
 * every test below is anonymous; `expectAnonymous` asserts that rather
 * than relying on it.
 */

async function expectAnonymous(page) {
  const user = await page.evaluate(() => globalThis.localStorage?.getItem('fontem-user') ?? null)
  expect(user).toBeNull()
}

/**
 * Open the settings popover if it isn't already open. The menu stays
 * open after a preference changes — deliberately, so the effect is
 * visible and undoable in the same gesture — so a bare click on the
 * trigger would toggle it shut on the second interaction.
 */
async function openSettings(page, trigger = 'settings-trigger') {
  const menu = page.locator('[data-testid="settings-menu"]')
  if (!(await menu.isVisible())) await page.locator(`[data-testid="${trigger}"]`).click()
  await expect(menu).toBeVisible()
}

test.describe('Anonymous display settings', () => {
  test('an unauthenticated visitor can change the language from the header gear', async ({ page }) => {
    await page.goto('/')
    await expectAnonymous(page)

    // The gear is present without signing in — this is the regression.
    const gear = page.locator('[data-testid="settings-trigger"]')
    await expect(gear).toBeVisible()

    const englishLabel = await gear.getAttribute('aria-label')
    expect(englishLabel).toBeTruthy()

    await openSettings(page)
    await page.locator('[data-testid="settings-lang"]').selectOption('fr')

    // <html lang> flips immediately (anti-FOUC + screen-reader).
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    await expectAnonymous(page)

    // German is fully translated, so the label must actually resolve to
    // the German string rather than falling back to English.
    await openSettings(page)
    await page.locator('[data-testid="settings-lang"]').selectOption('de')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(gear).toHaveAttribute('aria-label', 'Einstellungen')
    expect(englishLabel).not.toBe('Einstellungen')

    // The choice survives a reload, still with no account.
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expectAnonymous(page)
  })

  test('an unauthenticated visitor can change the language from the rail gear', async ({ page }) => {
    await page.goto('/')
    await expectAnonymous(page)

    await expect(page.locator('[data-testid="rail-settings"]')).toBeVisible()
    await openSettings(page, 'rail-settings')
    await page.locator('[data-testid="settings-lang"]').selectOption('de')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expectAnonymous(page)
  })

  test('the gear also switches theme and palette with no account', async ({ page }) => {
    await page.goto('/')
    await expectAnonymous(page)

    await openSettings(page)
    const before = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'))

    await page.locator('[data-testid="settings-theme"]').click()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(!before)

    // The palette control is the third anonymous-safe preference.
    await expect(page.locator('[data-testid="settings-palette"]')).toBeVisible()
    await expectAnonymous(page)
  })

  test('the settings menu exposes no account actions', async ({ page }) => {
    await page.goto('/')
    await openSettings(page)
    const menu = page.locator('[data-testid="settings-menu"]')
    // Identity belongs to ProfileMenu; keeping the surfaces separate is
    // what stops display prefs sliding back behind auth.
    await expect(menu).not.toContainText(/sign out/i)
    await expect(menu).not.toContainText(/delete account/i)
  })
})

test.describe('Language switching', () => {
  test('plural keys render different numerals in the same locale', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="i18n-plural-zero"]')).toContainText('no contracts')
    await expect(page.locator('[data-testid="i18n-plural-one"]')).toContainText('1 contract')
    await expect(page.locator('[data-testid="i18n-plural-many"]')).toContainText('5 contracts')

    // German uses 2 CLDR forms (one | other); count=0 picks the
    // 'no contracts' form, 1 the singular, 5 the plural.
    await openSettings(page)
    await page.locator('[data-testid="settings-lang"]').selectOption('de')
    await expect(page.locator('[data-testid="i18n-plural-zero"]')).toContainText('keine Aufträge')
    await expect(page.locator('[data-testid="i18n-plural-one"]')).toContainText('1 Auftrag')
    await expect(page.locator('[data-testid="i18n-plural-many"]')).toContainText('5 Aufträge')
  })
})
