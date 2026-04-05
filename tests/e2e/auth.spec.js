import { test, expect } from '@playwright/test'
import { createHmac } from 'node:crypto'

function makeToken() {
  const secret = process.env.CAPI_JWT_SECRET
  if (!secret) throw new Error('CAPI_JWT_SECRET required')
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = { sub: 'e2e-auth-user', email: 'e2e-auth@test.gmr', name: 'Auth Tester', iat: now, exp: now + 3600 }
  const h = Buffer.from(JSON.stringify(header)).toString('base64url')
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')
  return `${h}.${p}.${sig}`
}

test.describe('Authentication flow', () => {
  test('header shows Sign in when not authenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="sign-in-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="sign-out-btn"]')).not.toBeVisible()
  })

  test('Sign in button navigates to /login', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="sign-in-btn"]').click()
    await expect(page).toHaveURL(/\/login/, { timeout: 3000 })
  })

  test('login page shows Google sign-in button', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('[data-testid="google-signin-btn"]')).toBeVisible()
  })

  test('login page has token sign-in fallback', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('text=Sign in with token')).toBeVisible()
  })

  test('login page hides search bar', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="search"]')).not.toBeVisible()
  })

  test('authenticated user sees nav tabs and sign out', async ({ page }) => {
    const token = makeToken()
    await page.goto('/')
    await page.evaluate((t) => localStorage.setItem('gmr-token', t), token)
    await page.reload()
    await expect(page.locator('[data-testid="app-nav"]')).toBeVisible()
    await expect(page.locator('[data-testid="sign-out-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="sign-in-btn"]')).not.toBeVisible()
  })

  test('authenticated landing hides anon CTA', async ({ page }) => {
    const token = makeToken()
    await page.goto('/')
    await page.evaluate((t) => localStorage.setItem('gmr-token', t), token)
    await page.reload()
    await expect(page.locator('[data-testid="anon-cta"]')).not.toBeVisible()
  })

  test('nav tabs navigate to correct pages', async ({ page }) => {
    const token = makeToken()
    await page.goto('/')
    await page.evaluate((t) => localStorage.setItem('gmr-token', t), token)
    await page.reload()

    await page.locator('[data-testid="nav-reports"]').click()
    await expect(page).toHaveURL(/\/reports/, { timeout: 3000 })

    await page.locator('[data-testid="nav-issues"]').click()
    await expect(page).toHaveURL(/\/issues/, { timeout: 3000 })

    await page.locator('[data-testid="nav-activity"]').click()
    await expect(page).toHaveURL(/\/activity/, { timeout: 3000 })
  })
})
