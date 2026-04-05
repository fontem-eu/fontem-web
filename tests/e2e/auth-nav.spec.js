import { test, expect } from '@playwright/test'
import { createHmac } from 'node:crypto'

function makeToken() {
  const secret = process.env.CAPI_JWT_SECRET
  if (!secret) throw new Error('Set CAPI_JWT_SECRET for auth e2e tests')
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = { sub: 'e2e-nav-user', email: 'nav@test.gmr', name: 'Nav Tester', iat: now, exp: now + 3600 }
  function b64url(obj) { return Buffer.from(JSON.stringify(obj)).toString('base64url') }
  const h = b64url(header)
  const p = b64url(payload)
  const sig = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')
  return `${h}.${p}.${sig}`
}

test.describe('Authentication & Navigation', () => {
  test('anonymous user sees Sign in button, not nav tabs', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="sign-in-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="app-nav"]')).not.toBeVisible()
  })

  test('anonymous landing shows sign-in CTA below path cards', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="anon-cta"]')).toBeVisible()
    await expect(page.locator('[data-testid="anon-cta"]')).toContainText('Sign in')
  })

  test('Sign in link navigates to /login', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid="sign-in-btn"]')
    await expect(page).toHaveURL(/\/login$/, { timeout: 3000 })
  })

  test('login page shows Google sign-in button', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('[data-testid="google-signin-btn"]')).toBeVisible({ timeout: 10000 })
  })

  test('login page does not show the search bar', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="search"]')).not.toBeVisible()
  })

  test('authenticated user sees nav tabs (Reports, Issues, Activity)', async ({ page }) => {
    const token = makeToken()
    await page.goto('/')
    await page.evaluate((t) => localStorage.setItem('gmr-token', t), token)
    await page.reload()
    const nav = page.locator('[data-testid="app-nav"]')
    await expect(nav).toBeVisible()
    await expect(nav.locator('[data-testid="nav-reports"]')).toBeVisible()
    await expect(nav.locator('[data-testid="nav-issues"]')).toBeVisible()
    await expect(nav.locator('[data-testid="nav-activity"]')).toBeVisible()
  })

  test('authenticated user sees Sign out button', async ({ page }) => {
    const token = makeToken()
    await page.goto('/')
    await page.evaluate((t) => localStorage.setItem('gmr-token', t), token)
    await page.reload()
    await expect(page.locator('[data-testid="sign-out-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="sign-in-btn"]')).not.toBeVisible()
  })

  test('Reports tab navigates to /reports', async ({ page }) => {
    const token = makeToken()
    await page.goto('/')
    await page.evaluate((t) => localStorage.setItem('gmr-token', t), token)
    await page.reload()
    await page.click('[data-testid="nav-reports"]')
    await expect(page).toHaveURL(/\/reports$/, { timeout: 3000 })
  })

  test('landing page has two path cards (Graph + Reports)', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="path-graph"]')).toBeVisible()
    await expect(page.locator('[data-testid="path-reports"]')).toBeVisible()
  })
})
