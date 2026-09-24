import { test, expect } from '@playwright/test'

/**
 * Display settings must work with no account.
 *
 * Regression guard: 5dd542d ("lean profile menu") folded theme /
 * language / palette into the signed-in-only profile surface and moved
 * them to /account. /account stayed public, but the only affordance
 * pointing there reads "Log in" when signed out — so an anonymous
 * visitor had no discoverable way to change language. These specs
 * drive the header gear (desktop) and, on a phone, the drawer's account
 * row — "Log in · Preferences" when signed out — which opens /account,
 * as a genuinely signed-out visitor. The rail's own Preferences button
 * was removed on 2026-09-24.
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

  test('the rail has no Preferences button; its account row leads to the settings', async ({ page }) => {
    await page.goto('/')
    await expectAnonymous(page)
    await expect(page.locator('[data-testid="rail-settings"]')).toHaveCount(0)
    const account = page.locator('[data-testid="rail-account"]')
    await expect(account).toContainText('Preferences')
    await account.click()
    await page.locator('[data-testid="account-lang-picker"]').selectOption('de')
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

/**
 * Mobile. The header bar at 412px had roughly 6px of slack, so adding
 * the gear to it pushed the search input from 206px to 167px — under
 * the 200px floor responsive.spec.js enforces, i.e. a search box too
 * narrow to type in. The header gear is therefore desktop-only, and on
 * mobile the same preferences are on /account, reached from the
 * drawer's account row. These assert both halves of that trade.
 */
test.describe('Anonymous display settings — mobile', () => {
  test.use({ viewport: { width: 412, height: 915 } })

  test('the header gear is not in the mobile bar, and search stays usable', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="settings-trigger"]')).toBeHidden()
    const box = await page.locator('input[type="search"]').boundingBox()
    expect(box.width).toBeGreaterThan(200)
  })

  test('settings are still reachable from the nav drawer, via the account row', async ({ page }) => {
    await page.goto('/')
    await expectAnonymous(page)
    // The brand mark is the menu control below the rail breakpoint.
    await page.locator('[data-testid="nav-toggle"]').click()
    const account = page.locator('[data-testid="rail-account"]')
    await expect(account).toBeVisible()
    await expect(account).toContainText('Preferences')
    await account.click()
    await page.locator('[data-testid="account-lang-picker"]').selectOption('de')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expectAnonymous(page)
  })
})

/**
 * The header gear's popover is teleported to <body>; assert it is
 * genuinely on screen and on top, not merely laid out.
 */
test.describe('Settings gear — rendering', () => {
  test('the header menu is fully on screen and on top', async ({ page }) => {
    await page.goto('/')
    await openSettings(page)
    const menu = page.locator('[data-testid="settings-menu"]')
    const box = await menu.boundingBox()
    const vp = page.viewportSize()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1)
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1)
    const onTop = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      return !!el?.closest('[data-testid="settings-menu"]')
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
    expect(onTop).toBe(true)
  })
})
