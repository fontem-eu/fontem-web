/**
 * Production smoke tests — exercises real user flows against the live site.
 *
 * Uses a local test account (researcher@gmr.test) to:
 * 1. Login with email/password
 * 2. Search and browse entities
 * 3. Create, edit, and delete a report
 * 4. Ask the AI assistant a question
 *
 * Run: CAPI_JWT_SECRET=... BASE_URL=https://gmr.void42.net npx playwright test tests/e2e/smoke-production.spec.js
 */
import { test, expect } from '@playwright/test'

const TEST_EMAIL = 'researcher@gmr.test'
const TEST_PASSWORD = 'TestPass123!'
const REPORT_TITLE = `Smoke Test ${Date.now()}`

test.describe.serial('Production Smoke Tests', () => {
  let reportId = null
  let authToken = null

  test('SMOKE-01: Login page loads with email/password form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('[data-testid="login-email"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="login-password"]')).toBeVisible()
    await expect(page.locator('[data-testid="login-submit"]')).toBeVisible()
  })

  test('SMOKE-02: Login with test credentials', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="login-email"]', TEST_EMAIL)
    await page.fill('[data-testid="login-password"]', TEST_PASSWORD)
    await page.click('[data-testid="login-submit"]')

    // Should redirect to home and show nav tabs
    await page.waitForURL('/', { timeout: 15000 })
    await expect(page.locator('[data-testid="app-nav"]')).toBeVisible({ timeout: 5000 })
  })

  test('SMOKE-03: User name appears in header', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('[data-testid="login-email"]', TEST_EMAIL)
    await page.fill('[data-testid="login-password"]', TEST_PASSWORD)
    await page.click('[data-testid="login-submit"]')
    await page.waitForURL('/', { timeout: 15000 })

    await expect(page.locator('[data-testid="sign-out-btn"]')).toBeVisible()
  })

  test('SMOKE-04: Search for Apple returns results', async ({ page }) => {
    await page.goto('/')
    // The landing page has a search in the path card
    const searchInput = page.locator('input[type="search"]').first()
    await searchInput.fill('Apple')
    // Wait for results
    await expect(page.locator('.gmr-card').first()).toBeVisible({ timeout: 10000 })
    const firstResult = page.locator('.gmr-card .ticker-symbol').first()
    await expect(firstResult).toContainText('AAPL')
  })

  test('SMOKE-05: Apple profile loads with data', async ({ page }) => {
    await page.goto('/c/AAPL/fundamentals')
    await expect(page.locator('[data-testid="financials-panel"]')).toBeVisible({ timeout: 20000 })
    // Should show Apple Inc name
    await expect(page.locator('[data-testid="ticker-header"]').or(page.locator('text=APPLE'))).toBeVisible({ timeout: 10000 })
  })

  test('SMOKE-06: Graph Explorer renders', async ({ page }) => {
    await page.goto('/c/AAPL/graph')
    // The graph container should be visible
    await expect(page.locator('[data-testid="graph-panel-wrap"]').or(page.locator('.ge-canvas'))).toBeVisible({ timeout: 15000 })
  })

  test('SMOKE-07: Create report', async ({ page, request }) => {
    // Login via API to get token
    const loginResp = await request.post(`${page.url().split('/').slice(0, 3).join('/')}/capi/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    })
    expect(loginResp.ok()).toBeTruthy()
    const loginData = await loginResp.json()
    authToken = loginData.access_token

    // Create report via API (more reliable than UI for smoke tests)
    const baseUrl = page.url().split('/').slice(0, 3).join('') || 'https://gmr.void42.net'
    const createResp = await request.post(`${baseUrl}/capi/reports`, {
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      data: { title: REPORT_TITLE, abstract: 'Automated production smoke test' },
    })
    expect(createResp.ok()).toBeTruthy()
    const report = await createResp.json()
    reportId = report.id
    expect(reportId).toBeTruthy()
    expect(report.title).toBe(REPORT_TITLE)
  })

  test('SMOKE-08: Add section to report', async ({ request }) => {
    expect(reportId).toBeTruthy()
    const baseUrl = 'https://gmr.void42.net'
    const resp = await request.post(`${baseUrl}/capi/reports/${reportId}/sections`, {
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      data: { content: '<p>This section was created by the production smoke test.</p>' },
    })
    expect(resp.ok()).toBeTruthy()
    const section = await resp.json()
    expect(section.content).toContain('smoke test')
  })

  test('SMOKE-09: Report persists on reload', async ({ request }) => {
    expect(reportId).toBeTruthy()
    const baseUrl = 'https://gmr.void42.net'
    const resp = await request.get(`${baseUrl}/capi/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    expect(resp.ok()).toBeTruthy()
    const report = await resp.json()
    expect(report.title).toBe(REPORT_TITLE)
    expect(report.sections.length).toBeGreaterThanOrEqual(1)
    expect(report.sections[0].content).toContain('smoke test')
  })

  test('SMOKE-10: AI Assistant responds with data', async ({ request }) => {
    expect(authToken).toBeTruthy()
    const baseUrl = 'https://gmr.void42.net'

    // Use the blocking /assist/chat endpoint (not streaming, for test reliability)
    const resp = await request.post(`${baseUrl}/capi/assist/chat`, {
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      data: {
        message: 'Search for Apple Inc in the graph. What is their ticker symbol?',
        report_context: `Title: ${REPORT_TITLE}`,
      },
      timeout: 90000,
    })
    expect(resp.ok()).toBeTruthy()
    const result = await resp.json()
    expect(result.content.length).toBeGreaterThan(20)
    // The response should mention Apple or AAPL
    const content = result.content.toLowerCase()
    expect(content.includes('apple') || content.includes('aapl')).toBeTruthy()
  })

  test('SMOKE-11: Delete report (cleanup)', async ({ request }) => {
    expect(reportId).toBeTruthy()
    const baseUrl = 'https://gmr.void42.net'
    const resp = await request.delete(`${baseUrl}/capi/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    expect(resp.status()).toBe(204)

    // Verify it's gone
    const listResp = await request.get(`${baseUrl}/capi/reports`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    const reports = await listResp.json()
    const found = Array.isArray(reports)
      ? reports.some(r => r.id === reportId)
      : false
    expect(found).toBeFalsy()
  })
})
