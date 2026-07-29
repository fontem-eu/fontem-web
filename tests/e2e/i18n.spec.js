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

/**
 * Mobile. The header bar at 412px had roughly 6px of slack, so adding
 * the gear to it pushed the search input from 206px to 167px — under
 * the 200px floor responsive.spec.js enforces, i.e. a search box too
 * narrow to type in. The header gear is therefore desktop-only, and on
 * mobile the same component is reached from the bottom of the nav
 * drawer. These assert both halves of that trade.
 */
test.describe('Anonymous display settings — mobile', () => {
  test.use({ viewport: { width: 412, height: 915 } })

  test('the header gear is not in the mobile bar, and search stays usable', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="settings-trigger"]')).toBeHidden()
    const box = await page.locator('input[type="search"]').boundingBox()
    expect(box.width).toBeGreaterThan(200)
  })

  test('settings are still reachable from the nav drawer', async ({ page }) => {
    await page.goto('/')
    await expectAnonymous(page)
    // The brand mark is the menu control below the rail breakpoint.
    await page.locator('[data-testid="nav-toggle"]').click()
    const railGear = page.locator('[data-testid="rail-settings"]')
    await expect(railGear).toBeVisible()
    await railGear.click()
    await expect(page.locator('[data-testid="settings-menu"]')).toBeVisible()
    await page.locator('[data-testid="settings-lang"]').selectOption('de')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expectAnonymous(page)
  })
})

/**
 * Regressions in the gear itself, on top of the anonymous-access flow.
 *
 *  - Size: RailIcon's dimensions lived only in AppSidebar's scoped
 *    style, so the gear rendered from SettingsMenu lost the rule and
 *    ballooned to the browser default for a sizeless <svg>.
 *  - Clipping: `.rail` sets `overflow-y: auto` and, below 900px, a
 *    `transform` for the drawer slide. A transformed ancestor is the
 *    containing block for `position: fixed` descendants, so the popover
 *    was trapped inside the rail on mobile. It is teleported to <body>
 *    now, and these assert it is genuinely on screen and on top.
 */
test.describe('Settings gear — rendering', () => {
  test('the rail gear is the same size as the other rail icons', async ({ page }) => {
    await page.goto('/')
    const gear = page.locator('[data-testid="rail-settings"] svg')
    const stories = page.locator('[data-testid="nav-stories"] svg')
    await expect(gear).toBeVisible()
    const g = await gear.boundingBox()
    const s = await stories.boundingBox()
    expect(Math.abs(g.width - s.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(g.height - s.height)).toBeLessThanOrEqual(1)
    // Guards the actual failure mode: a sizeless SVG renders far larger.
    expect(g.width).toBeLessThan(40)
  })

  test('the menu opened from the rail is fully on screen and on top', async ({ page }) => {
    await page.goto('/')
    await openSettings(page, 'rail-settings')
    const menu = page.locator('[data-testid="settings-menu"]')
    const box = await menu.boundingBox()
    const vp = page.viewportSize()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1)
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1)
    // Clipped-but-laid-out still reports a box, so prove the centre of
    // the menu is actually the topmost element there.
    const onTop = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      return !!el?.closest('[data-testid="settings-menu"]')
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
    expect(onTop).toBe(true)
  })
})

test.describe('Settings gear — rendering on mobile', () => {
  test.use({ viewport: { width: 412, height: 915 } })

  test('the drawer menu is visible, on screen and on top at 412px', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="nav-toggle"]').click()
    await page.locator('[data-testid="rail-settings"]').click()
    const menu = page.locator('[data-testid="settings-menu"]')
    await expect(menu).toBeVisible()

    const box = await menu.boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(412 + 1)
    expect(box.y + box.height).toBeLessThanOrEqual(915 + 1)

    const onTop = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      return !!el?.closest('[data-testid="settings-menu"]')
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
    expect(onTop).toBe(true)

    // And it is usable, not merely painted.
    await page.locator('[data-testid="settings-lang"]').selectOption('de')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  })

  test('the rail gear is icon-sized in the drawer too', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="nav-toggle"]').click()
    const g = await page.locator('[data-testid="rail-settings"] svg').boundingBox()
    const s = await page.locator('[data-testid="nav-stories"] svg').boundingBox()
    expect(Math.abs(g.width - s.width)).toBeLessThanOrEqual(1)
    expect(g.width).toBeLessThan(40)
  })
})
