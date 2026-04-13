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

  test('SMOKE-01: Login page loads with email/password form and Google button', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('[data-testid="login-email"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="login-password"]')).toBeVisible()
    await expect(page.locator('[data-testid="login-submit"]')).toBeVisible()

    // Regression: Google Sign-In button must render (CSP must allow accounts.google.com)
    await expect(page.locator('[data-testid="google-signin-btn"] iframe, [data-testid="google-signin-btn"] div[role="button"]'))
      .toBeVisible({ timeout: 10000 })
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

  test('SMOKE-03: Profile menu opens and shows sign-out', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('[data-testid="login-email"]', TEST_EMAIL)
    await page.fill('[data-testid="login-password"]', TEST_PASSWORD)
    await page.click('[data-testid="login-submit"]')
    await page.waitForURL('/', { timeout: 15000 })

    // Profile icon should be visible
    await expect(page.locator('[data-testid="profile-menu-trigger"]')).toBeVisible()

    // Click to open menu, sign-out should appear
    await page.click('[data-testid="profile-menu-trigger"]')
    await expect(page.locator('[data-testid="sign-out-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="menu-ai-usage"]')).toBeVisible()
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
    // Wait for either the graph wrapper or the canvas to appear
    await page.waitForSelector('[data-testid="graph-panel-wrap"], .ge-canvas, canvas', { timeout: 15000 })
  })

  test('SMOKE-07: Create report', async ({ request, baseURL }) => {
    // Login via API to get token
    const loginResp = await request.post(`${baseURL}/capi/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    })
    expect(loginResp.ok()).toBeTruthy()
    const loginData = await loginResp.json()
    authToken = loginData.access_token

    // Create report via API
    const createResp = await request.post(`${baseURL}/capi/reports`, {
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      data: { title: REPORT_TITLE, abstract: 'Automated production smoke test' },
    })
    expect(createResp.ok()).toBeTruthy()
    const report = await createResp.json()
    reportId = report.id
    expect(reportId).toBeTruthy()
    expect(report.title).toBe(REPORT_TITLE)
  })

  test('SMOKE-08: Add section to report', async ({ request, baseURL }) => {
    // If report was lost (retry), recreate it
    if (!reportId || !authToken) {
      const loginResp = await request.post(`${baseURL}/capi/auth/login`, {
        data: { email: TEST_EMAIL, password: TEST_PASSWORD },
      })
      authToken = (await loginResp.json()).access_token
      const createResp = await request.post(`${baseURL}/capi/reports`, {
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        data: { title: REPORT_TITLE, abstract: 'Recreated for retry' },
      })
      reportId = (await createResp.json()).id
    }
    const resp = await request.post(`${baseURL}/capi/reports/${reportId}/sections`, {
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      data: { content: '<p>This section was created by the production smoke test.</p>' },
    })
    expect(resp.ok()).toBeTruthy()
    const section = await resp.json()
    expect(section.content).toContain('smoke test')
  })

  test('SMOKE-09: Report persists on reload', async ({ request, baseURL }) => {
    expect(reportId).toBeTruthy()
    // baseURL provided by Playwright fixture
    const resp = await request.get(`${baseURL}/capi/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    expect(resp.ok()).toBeTruthy()
    const report = await resp.json()
    expect(report.title).toBe(REPORT_TITLE)
    expect(report.sections.length).toBeGreaterThanOrEqual(1)
    expect(report.sections[0].content).toContain('smoke test')
  })

  test('SMOKE-10: AI Assistant responds with data', async ({ request, baseURL }) => {
    expect(authToken).toBeTruthy()

    // The streaming endpoint is the only supported path. We consume the
    // whole stream into a buffer and assert the assistant produced a
    // non-trivial response. Token accounting is covered in reports.spec.js.
    const resp = await request.post(`${baseURL}/capi/assist/chat/stream`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        message: 'Search for Apple Inc in the graph. What is their ticker symbol?',
        conversation_key: `report:${reportId}`,
        context_block: `# ${REPORT_TITLE}\n\nSmoke test context.`,
      },
      timeout: 90_000,
    })
    expect(resp.ok()).toBeTruthy()
    const body = await resp.text()
    // Consumed stream should include at least one chunk event with text
    expect(body).toMatch(/event:\s*chunk/)
    expect(body.length).toBeGreaterThan(50)
  })

  test('SMOKE-11: AI usage-history returns data after assistant turn', async ({ request, baseURL }) => {
    expect(authToken).toBeTruthy()

    // The assistant turn in SMOKE-10 consumed tokens. The usage-history
    // endpoint should now return at least one day with non-zero totals.
    const histResp = await request.get(`${baseURL}/capi/assist/usage-history?days=7`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    expect(histResp.ok()).toBeTruthy()
    const hist = await histResp.json()
    expect(hist.days).toBe(7)
    expect(hist.points.length).toBeGreaterThan(0)

    // Today's bucket must have non-zero tokens
    const today = new Date().toISOString().slice(0, 10)
    const todayPoint = hist.points.find((p) => p.date === today)
    expect(todayPoint).toBeTruthy()
    expect(todayPoint.tokens_in + todayPoint.tokens_out).toBeGreaterThan(0)
  })

  test('SMOKE-12: AI usage page renders with data', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('[data-testid="login-email"]', TEST_EMAIL)
    await page.fill('[data-testid="login-password"]', TEST_PASSWORD)
    await page.click('[data-testid="login-submit"]')
    await page.waitForURL('/', { timeout: 15000 })

    // Navigate to AI usage page
    await page.goto('/ai-usage')
    await expect(page.locator('.usage-title')).toHaveText('AI usage metrics', { timeout: 10000 })

    // Summary cards should render (researcher account has historical usage)
    await expect(page.locator('.usage-card')).toHaveCount(3, { timeout: 5000 })
  })

  test('SMOKE-13: Delete report (cleanup)', async ({ request, baseURL }) => {
    expect(reportId).toBeTruthy()
    // baseURL provided by Playwright fixture
    const resp = await request.delete(`${baseURL}/capi/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    expect(resp.status()).toBe(204)

    // Verify it's gone
    const listResp = await request.get(`${baseURL}/capi/reports`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    const reports = await listResp.json()
    const found = Array.isArray(reports)
      ? reports.some(r => r.id === reportId)
      : false
    expect(found).toBeFalsy()
  })
})
