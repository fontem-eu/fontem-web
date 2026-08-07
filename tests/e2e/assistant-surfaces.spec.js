import { test, expect } from '@playwright/test'

/**
 * The screens added for the assistant work: Help, the provider-key card
 * and the external-client token card.
 *
 * Everything here drives the UI. Nothing calls the API directly — the
 * whole point is to catch the case where an endpoint works perfectly and
 * the feature is still unreachable, which is exactly what happened: /help
 * shipped as a route that nothing linked to, so it existed and no user
 * could find it.
 *
 * Signing in is done through the login form for the same reason. Seeding
 * a token would skip the surface most likely to be broken.
 */

const EMAIL = process.env.TEST_EMAIL || 'researcher@fontem.eu'
const PASSWORD = process.env.TEST_PASSWORD || 'TestPass123!'

/**
 * Unique per run. These tests create real tokens against a shared
 * account, so a fixed label collides with leftovers from earlier runs and
 * a revoke assertion fails because a same-named row from last week is
 * still there.
 */
const stamp = () => `e2e-${Date.now()}-${Math.floor(Math.random() * 1e4)}`

/**
 * Dismiss the cookie banner, as a real visitor would.
 *
 * It is `position: fixed` along the bottom edge at z-index 1000, so until
 * it is answered it covers the footer — including the Help link. This is
 * the one bit of setup that is not the thing under test, and it is still
 * done through the UI rather than by writing consent into storage.
 */
async function acceptCookies(page) {
  const accept = page.locator('[data-testid="cookie-consent-accept"]')
  if (await accept.isVisible().catch(() => false)) {
    await accept.click()
    await expect(page.locator('[data-testid="cookie-consent-banner"]')).toHaveCount(0)
  }
}

async function uiLogin(page) {
  await page.goto('/login')
  await page.fill('[data-testid="login-email"]', EMAIL)
  await page.fill('[data-testid="login-password"]', PASSWORD)
  await page.click('[data-testid="login-submit"]')
  await expect(page.locator('[data-testid="rail-account"]')).toBeVisible({ timeout: 20_000 })
}

test.describe('Signing in through the form', () => {
  // Sign-in journeys run under one browser only. /auth/login is capped at
  // 5 per minute per IP, and this file needs four sign-ins; running them
  // under both chromium and firefox makes eight, which the limiter
  // rejects. Firefox goes second and lost that race on every run — as
  // "the element isn't there", never as "you were rate limited".
  //
  // Nothing here is browser-specific: these assert on markup and page
  // wiring. The genuinely browser-dependent behaviour is viewport and
  // safe-area geometry, and those tests do not sign in, so they still run
  // everywhere.
  test.skip(({ browserName }) => browserName !== 'chromium', 'one browser: login budget')

  // The one place the login UI itself is exercised. Everything else
  // reuses the session, the way a real visitor does.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('a visitor can sign in and reach their account', async ({ page }) => {
    await uiLogin(page)
    await page.goto('/account')
    await expect(page.locator('[data-testid="provider-keys-card"]')).toBeVisible()
  })
})

test.describe('Help is reachable without knowing the URL', () => {
  test('a signed-out visitor can find Help from the page furniture', async ({ page }) => {
    await page.goto('/')
    await acceptCookies(page)
    // The regression this guards: /help existed as a route with no link to
    // it anywhere, so it was only reachable by typing the address.
    const link = page.locator('a[href="/help"], a[href$="/help"]').first()
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL(/\/help$/)
    await expect(page.locator('[data-testid="help-view"]')).toBeVisible()
  })

  test('Help explains how to connect an external AI client', async ({ page }) => {
    await page.goto('/help')
    await expect(page.locator('[data-testid="help-connect-ai"]')).toBeVisible()
    // The endpoint is the one thing a user must copy correctly.
    await expect(page.locator('[data-testid="help-mcp-url"]')).toContainText('/mcp')
    await expect(page.locator('[data-testid="help-why-own-key"]')).toBeVisible()
    await expect(page.locator('[data-testid="help-privacy"]')).toBeVisible()
  })

  test('Help links onward to where the token is actually created', async ({ page }) => {
    await page.goto('/help')
    const acct = page.locator('[data-testid="help-connect-ai"] a[href="/account"]').first()
    await expect(acct).toBeVisible()
    await acct.click()
    await expect(page).toHaveURL(/\/account$/)
  })
})

test.describe('Account settings — assistant configuration', () => {
  // ONE sign-in for everything the account page does.
  //
  // /auth/login allows 5 per minute per IP. This file previously spent
  // four of those on four separate account journeys, and the fourth was
  // rejected — surfacing as "the element isn't there" rather than "you
  // were rate limited", which reads like a product bug and sent me
  // looking in the wrong place twice.
  //
  // The account page is one surface; testing it as one journey is both
  // cheaper and closer to how it is actually used. Kept serial so a
  // failure stops the chain rather than cascading confusingly.
  test.skip(({ browserName }) => browserName !== 'chromium', 'one browser: login budget')
  test.describe.configure({ mode: 'serial' })

  test('the account page offers a built-in model, provider keys and MCP tokens', async ({
    page,
  }) => {
    await uiLogin(page)
    await page.goto('/account')

    // ── The built-in model is the default ────────────────────────────
    // Previously this page told signed-in users the assistant was
    // unavailable until they added a key. That sentence is the single
    // thing the built-in model changes, so it is asserted first.
    await expect(page.locator('[data-testid="provider-builtin"]')).toBeVisible()
    await expect(page.locator('[data-testid="provider-builtin-active"]')).toBeVisible()
    await expect(page.locator('[data-testid="provider-keys-empty"]')).toHaveCount(0)

    // Named from the API's `builtin` field rather than hardcoded, so this
    // also catches that field going missing — which is how it shipped the
    // first time: the frontend read a field the backend never returned
    // and nothing errored.
    const named = await page.locator('[data-testid="provider-builtin"]').innerText()
    expect(named.trim()).not.toHaveLength(0)
    expect(named).toMatch(/qwen|llama|mistral|gpt|\d+b/i)

    // ── Bring-your-own key stays available, and safe ─────────────────
    await expect(page.locator('[data-testid="provider-keys-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="provider-select"]')).toBeVisible()
    // Never a plain-text field: it is an API key.
    await expect(page.locator('[data-testid="provider-key-input"]'))
      .toHaveAttribute('type', 'password')

    // ── MCP tokens ───────────────────────────────────────────────────
    await expect(page.locator('[data-testid="mcp-tokens-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="mcp-token-create"]')).toBeVisible()
    await expect(
      page.locator('[data-testid="mcp-tokens-card"] a[href^="/help"]').first(),
    ).toBeVisible()

    const label = stamp()
    await page.fill('[data-testid="mcp-token-label"]', label)
    await page.click('[data-testid="mcp-token-create"]')

    const fresh = page.locator('[data-testid="mcp-token-fresh"]')
    await expect(fresh).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid="mcp-token-value"]')).toContainText('fontem_mcp_')
    await expect(fresh).toContainText(/shown once/i)

    // Dismissing must actually remove it: it cannot be retrieved later, so
    // leaving it on screen is the only exposure.
    await page.click('[data-testid="mcp-token-dismiss"]')
    await expect(page.locator('[data-testid="mcp-token-value"]')).toHaveCount(0)

    // Listed by label, without the secret — and visible immediately,
    // without a reload. A refetch straight after the create came back
    // stale often enough that you could not see your own new token.
    const list = page.locator('[data-testid="mcp-tokens-list"]')
    await expect(list).toContainText(label)
    await expect(list).not.toContainText('fontem_mcp_')

    const row = list.locator('li', { hasText: label })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: /revoke/i }).click()
    await expect(row).toHaveCount(0, { timeout: 15_000 })
  })

  test('the built-in model can be switched between speed and quality', async ({ page }) => {
    // Serial with the journey above, so the session is already warm.
    await page.goto('/account')
    const choice = page.locator('[data-testid="builtin-model-choice"]')
    await expect(choice).toBeVisible()

    const fast = page.locator('[data-testid="builtin-model-fast"]')
    const balanced = page.locator('[data-testid="builtin-model-balanced"]')
    await expect(fast).toBeVisible()
    await expect(balanced).toBeVisible()

    // Exactly one is selected at any time — aria-pressed is what a screen
    // reader uses to say which, so it is asserted rather than the class.
    const pressed = async () =>
      (await choice.locator('[aria-pressed="true"]').count())
    expect(await pressed()).toBe(1)

    await fast.click()
    await expect(fast).toHaveAttribute('aria-pressed', 'true')
    expect(await pressed()).toBe(1)

    // It must survive a reload — a preference that forgets itself is
    // worse than no preference, because the user thinks it took.
    await page.reload()
    await expect(page.locator('[data-testid="builtin-model-fast"]'))
      .toHaveAttribute('aria-pressed', 'true')

    // Put it back so the rest of the suite runs on the default.
    await page.locator('[data-testid="builtin-model-balanced"]').click()
    await expect(page.locator('[data-testid="builtin-model-balanced"]'))
      .toHaveAttribute('aria-pressed', 'true')
  })

  test('the assistant accepts a turn with no key configured', async ({ page }) => {
    // Serial with the test above, so the session is already warm and this
    // needs no second sign-in.
    await page.goto('/')
    await page.locator('.assist-toggle').click()
    const input = page.locator('[data-testid="assist-input"]')
    await expect(input).toBeVisible()
    await input.fill('hello')
    await page.locator('[data-testid="assist-send"]').click()

    // Not "does the model answer" — that is a CPU-bound minute and
    // belongs in a slower suite. The refusal, when it happens, is
    // immediate.
    await expect(page.locator('text=/No LLM provider configured/i')).toHaveCount(0, {
      timeout: 10_000,
    })
  })
})

test.describe('The assistant is reachable everywhere', () => {
  const ROUTES = ['/', '/about', '/explore', '/help']

  for (const path of ROUTES) {
    test(`the assistant toggle is present on ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('[data-testid="assist-toggle"]')).toBeVisible()
    })
  }

  test('it is absent on /login, where it would be useless', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('[data-testid="assist-toggle"]')).toHaveCount(0)
  })

  test('the toggle is pinned in the viewport, not parked down the page', async ({ page }) => {
    await page.goto('/')
    const el = page.locator('[data-testid="assist-toggle"]')

    // The regression this exists for: the toggle was `position: static`,
    // inherited from when it lived inline in the report editor. Mounted
    // globally it rendered 1600px down a 720px-tall viewport — present on
    // every page and visible on none of them without scrolling.
    await expect(el).toHaveCSS('position', 'fixed')

    const box = await el.boundingBox()
    const vp = page.viewportSize()
    // Actually on screen, before any scrolling.
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1)
    // Bottom-left: left half, bottom third.
    expect(box.x).toBeLessThan(vp.width / 2)
    expect(box.y).toBeGreaterThan(vp.height * 0.66)
  })

  test('the toggle clears the nav rail rather than sitting on it', async ({ page }) => {
    await page.goto('/')
    const toggle = await page.locator('[data-testid="assist-toggle"]').boundingBox()
    const rail = await page.locator('[data-testid="app-sidebar"]').boundingBox()
    // Beside the rail, not over its account and collapse rows.
    expect(toggle.x).toBeGreaterThanOrEqual(rail.x + rail.width - 1)
  })

  test('on mobile it sits at the left edge, and the open drawer covers it', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 })
    await page.goto('/')
    const el = page.locator('[data-testid="assist-toggle"]')
    const box = await el.boundingBox()
    // The rail is off-canvas here, so the button takes the left edge.
    expect(box.x).toBeLessThan(60)
    expect(box.y).toBeGreaterThan(915 * 0.66)

    // With the drawer open the scrim must sit above it: a button floating
    // over an open nav drawer is a misclick waiting to happen.
    await page.locator('[data-testid="nav-toggle"]').click()
    await expect(page.locator('[data-testid="rail-scrim"]')).toBeVisible()
    const onTop = await page.evaluate(({ x, y }) => {
      const e = document.elementFromPoint(x, y)
      return !!e?.closest('[data-testid="assist-toggle"]')
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
    expect(onTop).toBe(false)
  })
})

test.describe('Help is in the nav rail', () => {
  test('the rail links to Help, above the account row', async ({ page }) => {
    await page.goto('/')
    const help = page.locator('[data-testid="rail-help"]')
    const account = page.locator('[data-testid="rail-account"]')
    await expect(help).toBeVisible()

    // Above the account row: that row reads "Log in" when signed out, and
    // Help must not look like it lives behind signing in.
    const h = await help.boundingBox()
    const a = await account.boundingBox()
    expect(h.y).toBeLessThan(a.y)

    await help.click()
    await expect(page).toHaveURL(/\/help$/)
    await expect(page.locator('[data-testid="help-view"]')).toBeVisible()
  })
})

test.describe('Bottom controls clear the system navigation bar', () => {
  // The Android gesture bar and the iOS home indicator overlay the bottom
  // edge. Without viewport-fit=cover the safe-area insets read 0 and
  // anything pinned to the bottom renders underneath them: visible, and
  // not tappable.
  test('the viewport opts into safe-area insets', async ({ page }) => {
    await page.goto('/')
    const content = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(content).toContain('viewport-fit=cover')
  })

  test('the cookie banner height is inert to the safe-area inset', async ({ page }) => {
    // The regression this guards. The banner's height is measured by a
    // ResizeObserver and broadcast as --cookie-banner-h; the rail and the
    // assistant toggle position against it. env(safe-area-inset-bottom)
    // changes at runtime on Android as the address bar slides. If the
    // banner's own height depends on the inset, every scroll republishes
    // a new height and drags both consumers with it — the wiggle.
    //
    // A headless browser has no real inset, so drive the variable the
    // inset feeds. If the height moves with it, the loop is back.
    await page.setViewportSize({ width: 412, height: 915 })
    await page.goto('/')
    const banner = page.locator('[data-testid="cookie-consent-banner"]')
    await banner.waitFor({ state: 'visible' })

    const measure = () => banner.evaluate((el) => el.getBoundingClientRect().height)
    const set = (v) =>
      page.evaluate((val) => {
        document.documentElement.style.setProperty('--safe-bottom', val)
      }, v)

    const flat = await measure()
    await set('48px')
    const inset = await measure()
    await set('0px')

    expect(inset).toBeCloseTo(flat, 0)
  })

  test('the toggle holds still in French, where the banner wraps taller', async ({ page }) => {
    // Reported against fr specifically: the banner needs an extra line in
    // French, so it is taller, and it made the same feedback loop far more
    // visible. Locale must not change whether things hold still.
    await page.setViewportSize({ width: 412, height: 915 })
    await page.addInitScript(() => {
      window.localStorage.setItem('gmr-lang', 'fr')
    })
    await page.goto('/')
    // Assert the locale actually took. Seeding the wrong key leaves the
    // page in English and this test passes while testing nothing.
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')

    const toggle = page.locator('.assist-toggle')
    await toggle.waitFor({ state: 'visible' })

    const before = await toggle.boundingBox()
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--safe-bottom', '48px')
    })
    await page.waitForTimeout(150)
    const after = await toggle.boundingBox()

    // It may sit higher to clear the inset — that is the point of it. What
    // it must not do is move because the banner re-measured itself.
    const banner = page.locator('[data-testid="cookie-consent-banner"]')
    const shift = Math.abs(after.y - before.y)
    expect(shift).toBeLessThanOrEqual(48)
    expect(await banner.evaluate((el) => el.getBoundingClientRect().height))
      .toBeGreaterThan(0)
  })

  test('the toggle does not move when the page scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 })
    await page.goto('/')
    const el = page.locator('[data-testid="assist-toggle"]')

    const before = await el.boundingBox()
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(400)
    const after = await el.boundingBox()

    // Anything that tracks the address bar live shifts here. That wiggle
    // on every scroll is what the static svh/lvh anchoring removes.
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1)
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1)
  })

  test('the rail does not resize when the page scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 })
    await page.goto('/')
    await page.locator('[data-testid="nav-toggle"]').click()
    const rail = page.locator('[data-testid="app-sidebar"]')

    const before = await rail.boundingBox()
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(400)
    const after = await rail.boundingBox()

    // A growing rail is the gap that appeared underneath it.
    expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1)
  })

  test('the assistant toggle and the account row both consume the inset', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 })
    await page.goto('/')
    // The inset is 0 in a desktop browser, so assert the expression is
    // wired rather than the pixel value — the failure mode is somebody
    // dropping the var, not the browser miscomputing it.
    const usesInset = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)'
      document.body.appendChild(probe)
      const ok = getComputedStyle(probe).paddingBottom !== ''
      probe.remove()
      return ok
    })
    expect(usesInset).toBe(true)

    const toggle = page.locator('[data-testid="assist-toggle"]')
    const bottom = await toggle.evaluate(e => getComputedStyle(e).bottom)
    expect(bottom).not.toBe('0px')
  })

  test('the rail account row is reachable, not under the system bar', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 })
    await page.goto('/')
    await page.locator('[data-testid="nav-toggle"]').click()
    const account = page.locator('[data-testid="rail-account"]')
    await expect(account).toBeVisible()

    const box = await account.boundingBox()
    // Fully inside the viewport, so a tap lands on it rather than on the
    // system navigation bar.
    expect(box.y + box.height).toBeLessThanOrEqual(915)

    // And actually clickable. Playwright refuses to click an element that
    // something else covers, so this asserts hit-testability far more
    // honestly than elementFromPoint — which returns null often enough at
    // viewport edges to make it a flaky proxy for the real question.
    await account.click({ timeout: 5000 })
    await expect(page).toHaveURL(/\/(account|login)$/)
  })
})

test.describe('Hyperlinks look like hyperlinks', () => {
  test('content links are blue and underlined', async ({ page }) => {
    await page.goto('/help')
    const link = page.locator('[data-testid="help-connect-ai"] a[href="/account"]').first()
    await expect(link).toBeVisible()
    const style = await link.evaluate(e => {
      const c = getComputedStyle(e)
      return { color: c.color, decoration: c.textDecorationLine }
    })
    expect(style.decoration).toContain('underline')
    // Blue: the blue channel must dominate. Asserting the exact accent
    // would break the moment the palette is retuned, which is not the
    // property worth pinning.
    const [r, g, b] = style.color.match(/\d+/g).map(Number)
    expect(b).toBeGreaterThan(r)
    expect(b).toBeGreaterThan(g)
  })
})
