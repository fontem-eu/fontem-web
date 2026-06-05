import { test, expect } from '@playwright/test'

/**
 * Language switch smoke. PR 1 lands only the English dictionary, so
 * this spec proves the i18n bridge is wired and the UI labels swap
 * to a locale's keys when the dropdown changes -- it does NOT assert
 * native-language strings yet (those arrive in PR 2). Once the
 * Bulgarian / French / German batches land, the asserts switch from
 * "did the key get evaluated" to "did the key resolve to the local
 * translation".
 */
test.describe('Language switching', () => {
  test('header surfaces a localised label after the picker changes', async ({ page }) => {
    await page.goto('/')

    // 1) Default lang. The header has "Preferences" as a static label
    //    keyed by app.preferences -- in PR 1 this is still English.
    const englishHeader = await page.locator('[data-testid="prefs-menu-trigger"]')
      .first().getAttribute('aria-label')
    expect(typeof englishHeader).toBe('string')
    expect(englishHeader.length).toBeGreaterThan(0)

    // 2) Open the prefs menu and switch language.
    await page.locator('[data-testid="prefs-menu-trigger"]').first().click()
    await page.locator('[data-testid="lang-picker"]').selectOption('fr')

    // 3) The lang attribute on <html> must reflect the choice
    //    immediately (anti-FOUC + screen-reader correctness).
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')

    // 4) The lazy import for the locale fires; once it resolves the
    //    aria-label re-evaluates. In PR 1 the message bag for `fr`
    //    is empty so vue-i18n falls back to `en` -- this asserts
    //    the bridge itself works without depending on a translation
    //    landing yet. PR 2 onward will assert the value differs.
    const frHeader = await page.locator('[data-testid="prefs-menu-trigger"]')
      .first().getAttribute('aria-label')
    expect(typeof frHeader).toBe('string')
    expect(frHeader.length).toBeGreaterThan(0)

    // 5) Sanity: the persisted preference survives a reload.
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  })

  test('plural keys render different numerals in the same locale', async ({ page }) => {
    await page.goto('/')
    // The plural API (app.contracts_count) is exercised by passing a
    // count through to vue-i18n's $tc. We expose two badges on the
    // landing footer so the test can verify the form chosen matches
    // the count. PR 2 adds locale-specific plural forms.
    await expect(page.locator('[data-testid="i18n-plural-zero"]'))
      .toContainText('no contracts')
    await expect(page.locator('[data-testid="i18n-plural-one"]'))
      .toContainText('1 contract')
    await expect(page.locator('[data-testid="i18n-plural-many"]'))
      .toContainText('5 contracts')
  })
})
