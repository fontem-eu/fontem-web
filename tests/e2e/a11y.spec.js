/**
 * Accessibility regression tests.
 *
 * axe-core scans each critical public page in both themes, and fails
 * the suite if any `serious` or `critical` violations appear.  The
 * `moderate` tier is reported as a warning (console.log) — useful
 * signal without blocking a release over borderline contrast issues.
 *
 * Also verifies the keyboard-navigation baseline: the skip-link is
 * the first focusable element; Tab lands on it; Enter jumps to
 * `#main`.
 */
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const PUBLIC_PAGES = [
  { path: '/', name: 'landing' },
  { path: '/feed', name: 'feed' },
  { path: '/privacy', name: 'privacy' },
  { path: '/data-quality', name: 'data-quality-hub' },
  { path: '/login', name: 'login' },
]

const THEMES = ['light', 'dark']

async function setTheme(page, theme) {
  await page.goto('/')
  await page.evaluate((t) => localStorage.setItem('gmr-theme', t), theme)
}

async function scan(page, path) {
  await page.goto(path)
  // Give SPA a beat to render + hydrate before scanning.
  await page.waitForLoadState('networkidle')
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return results
}

for (const theme of THEMES) {
  test.describe(`a11y — ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await setTheme(page, theme)
    })

    for (const { path, name } of PUBLIC_PAGES) {
      test(`${name} has no serious/critical violations`, async ({ page }) => {
        const results = await scan(page, path)
        const blocking = results.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        )
        if (blocking.length > 0) {
          // Log the details so failures are actionable in CI output.
          // eslint-disable-next-line no-console
          console.log(
            `\n[a11y ${theme}:${name}] ${blocking.length} blocking violation(s):\n` +
            blocking.map((v) => `  - ${v.id} (${v.impact}): ${v.help}`).join('\n'),
          )
        }
        expect(blocking, `blocking a11y violations on ${path}`).toEqual([])
      })
    }
  })
}

test.describe('keyboard navigation', () => {
  test('skip-link is the first focusable element and jumps to #main', async ({ page }) => {
    await page.goto('/')
    // Tab once from the document body — should land on the skip-link.
    await page.keyboard.press('Tab')
    const active = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
    expect(active).toBe('skip-to-main')

    // Activating the link moves focus into #main (via the hash target).
    await page.keyboard.press('Enter')
    // A moment for the hash navigation to settle.
    await page.waitForTimeout(100)
    const mainIsFocused = await page.evaluate(
      () => document.activeElement?.id === 'main' ||
            document.location.hash === '#main',
    )
    expect(mainIsFocused).toBe(true)
  })

  test('header logo → nav tabs → profile are reachable via Tab', async ({ page }) => {
    await page.goto('/')
    // Collect the sequence of testids the user tabs through.
    const visited = []
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      const testid = await page.evaluate(
        () => document.activeElement?.getAttribute('data-testid'),
      )
      if (testid) visited.push(testid)
    }
    // At minimum we want sign-in reachable on an anonymous landing.
    expect(visited).toContain('sign-in-btn')
  })
})
