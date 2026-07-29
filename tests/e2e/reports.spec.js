import { test, expect } from '@playwright/test'
import { createHmac, randomUUID } from 'node:crypto'

/**
 * Regression: report sections must persist across save → close → reopen.
 *
 * This test creates a report, adds section content, saves, navigates away,
 * then re-opens the report and verifies the section content is still there.
 *
 * Requires CAPI_JWT_SECRET env var to mint a test token, or CAPI_TEST_TOKEN
 * with a pre-made JWT.
 */

function makeTestToken({ sub = 'e2e-test-user', email = 'e2e@test.gmr' } = {}) {
  const prebuilt = process.env.CAPI_TEST_TOKEN
  if (prebuilt) return prebuilt

  // Build a minimal HS256 JWT — the community API accepts these
  const secret = process.env.CAPI_JWT_SECRET
  if (!secret) {
    throw new Error(
      'Set CAPI_JWT_SECRET or CAPI_TEST_TOKEN env var for reports e2e tests',
    )
  }

  // Lightweight HS256 JWT construction (no external deps needed)
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    sub,
    email,
    name: 'E2E Test User',
    iat: now,
    exp: now + 3600,
  }

  function b64url(obj) {
    return Buffer.from(JSON.stringify(obj))
      .toString('base64url')
  }

  const head = b64url(header)
  const body = b64url(payload)
  const sig = createHmac('sha256', secret)
    .update(`${head}.${body}`)
    .digest('base64url')

  return `${head}.${body}.${sig}`
}

/** Build a fresh-per-test token so per-user usage counts start at zero. */
function makeFreshUserToken() {
  const uuid = randomUUID()
  return makeTestToken({ sub: uuid, email: `${uuid.slice(0, 8)}@test.gmr` })
}

test.describe('Report sections persistence', () => {
  let token

  test.beforeAll(() => {
    token = makeTestToken()
  })

  test('sections survive save → close → reopen', async ({ page }) => {
    // Inject auth token into localStorage before navigating
    await page.goto('/')
    await page.evaluate((t) => localStorage.setItem('gmr-token', t), token)

    // Create a new report via the API so we get a clean report ID
    const baseUrl = page.url().replace(/\/$/, '')
    const createResp = await page.request.post(`${baseUrl}/capi/reports`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: { title: 'E2E Section Test', abstract: 'Regression test' },
    })
    expect(createResp.ok()).toBeTruthy()
    const report = await createResp.json()
    const reportId = report.id

    // Navigate to the editor
    await page.goto(`/reports/${reportId}/edit`)
    await page.waitForSelector('[data-testid="report-editor"]', { timeout: 10000 })

    // Type content into the first section's Tiptap editor
    const sectionContent = `Regression test content ${Date.now()}`
    const editor = page.locator('.tiptap-editor .tiptap').first()
    await editor.click()
    await editor.fill(sectionContent)

    // Save
    await page.click('[data-testid="save-report"]')
    // Wait for save to complete (button re-enables)
    await expect(page.locator('[data-testid="save-report"]')).not.toBeDisabled({
      timeout: 10000,
    })

    // Navigate away
    await page.goto('/reports')
    await page.waitForTimeout(500)

    // Reopen the same report in edit mode
    await page.goto(`/reports/${reportId}/edit`)
    await page.waitForSelector('[data-testid="report-editor"]', { timeout: 10000 })

    // Verify section content is still there
    const editorText = await page.locator('.tiptap-editor .tiptap').first().textContent()
    expect(editorText).toContain(sectionContent)

    // Cleanup: delete the report
    await page.request.delete(`${baseUrl}/capi/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  })

  test('editing an existing report: add, edit, delete sections survive reload', async ({ page }) => {
    // Inject auth token
    await page.goto('/')
    await page.evaluate((t) => localStorage.setItem('gmr-token', t), token)
    const baseUrl = page.url().replace(/\/$/, '')

    // Seed: create a report and three initial sections via the API
    const createResp = await page.request.post(`${baseUrl}/capi/reports`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { title: 'E2E Edit Flow', abstract: 'Initial' },
    })
    expect(createResp.ok()).toBeTruthy()
    const reportId = (await createResp.json()).id

    const original = [
      `FIRST-${Date.now()}`,
      `SECOND-${Date.now()}`,
      `THIRD-${Date.now()}`,
    ]
    for (const content of original) {
      const resp = await page.request.post(
        `${baseUrl}/capi/reports/${reportId}/sections`,
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          data: { content: `<p>${content}</p>` },
        },
      )
      expect(resp.ok()).toBeTruthy()
    }

    // Open the editor and wait for all three sections to render
    await page.goto(`/reports/${reportId}/edit`)
    await page.waitForSelector('[data-testid="report-editor"]', { timeout: 10000 })
    await expect(page.locator('[data-testid^="section-"]')).toHaveCount(3)

    // Edit the first section's content
    const editedFirst = `EDITED-FIRST-${Date.now()}`
    const firstEditor = page.locator('.tiptap-editor .tiptap').nth(0)
    await firstEditor.click()
    await firstEditor.fill(editedFirst)

    // Delete the middle (second) section
    await page.locator('[data-testid="remove-section-btn"]').nth(1).click()
    await expect(page.locator('[data-testid^="section-"]')).toHaveCount(2)

    // Add a brand-new section with fresh content
    await page.locator('[data-testid="add-section-btn"]').click()
    await expect(page.locator('[data-testid^="section-"]')).toHaveCount(3)
    const addedContent = `ADDED-${Date.now()}`
    const lastEditor = page.locator('.tiptap-editor .tiptap').last()
    await lastEditor.click()
    await lastEditor.fill(addedContent)

    // Save
    await page.click('[data-testid="save-report"]')
    await expect(page.locator('[data-testid="save-report"]')).not.toBeDisabled({
      timeout: 10000,
    })

    // Navigate away and back
    await page.goto('/reports')
    await page.waitForTimeout(500)
    await page.goto(`/reports/${reportId}/edit`)
    await page.waitForSelector('[data-testid="report-editor"]', { timeout: 10000 })
    await expect(page.locator('[data-testid^="section-"]')).toHaveCount(3)

    // Collect visible section text and assert the expected set
    const editorTexts = await page.locator('.tiptap-editor .tiptap').allTextContents()
    const joined = editorTexts.join('\n')

    // Edited content is present
    expect(joined).toContain(editedFirst)
    // Added content is present
    expect(joined).toContain(addedContent)
    // Third section survived untouched
    expect(joined).toContain(original[2])
    // Deleted section is gone — this is the regression guard
    expect(joined).not.toContain(original[1])
    // And the original first-section content was replaced by the edit
    expect(joined).not.toContain(original[0])

    // Cleanup
    await page.request.delete(`${baseUrl}/capi/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  })
})


/**
 * Assistant agent smoke test: verifies the full stack from UI to Claude.
 *
 * This test hits the real claude-proxy and real Claude, so it can be
 * flaky if the LLM is slow or the proxy is unreachable. It is NOT
 * gated per-PR — run as part of the nightly smoke suite. Its job is
 * to catch prompt-plumbing regressions that our mocked contract tests
 * can't see.
 *
 * Flow:
 *   1. Fresh user (so tokens_1h starts at zero)
 *   2. GET /assist/usage → expect 0
 *   3. Create a report with a distinctive phrase in a section
 *   4. Open the editor, open the assist panel, ask about the phrase
 *   5. Wait for a streamed response
 *   6. GET /assist/usage → expect tokens_1h > 0 (accounting works)
 *   7. Delete the report to clean up
 */
test.describe('Assistant consumption metrics', () => {
  test('user sends a message then sees their token usage go up', async ({ page }) => {
    test.setTimeout(120_000)  // LLM calls can be slow

    const token = makeFreshUserToken()
    await page.goto('/')
    await page.evaluate((t) => localStorage.setItem('gmr-token', t), token)
    const baseUrl = page.url().replace(/\/$/, '')
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    // Step 1+2: fresh user — usage must be all zeros
    const before = await page.request.get(`${baseUrl}/capi/assist/usage`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(before.ok()).toBeTruthy()
    const beforeBody = await before.json()
    expect(beforeBody.tokens_1h).toBe(0)
    expect(beforeBody.tokens_24h).toBe(0)
    expect(beforeBody.tokens_7d).toBe(0)

    // Step 3: create a report and seed a section with a distinctive phrase
    const distinctive = `SIEMENS-${Date.now()}`
    const createResp = await page.request.post(`${baseUrl}/capi/reports`, {
      headers: authHeaders,
      data: { title: 'E2E Assistant Smoke', abstract: 'Testing context plumbing' },
    })
    expect(createResp.ok()).toBeTruthy()
    const reportId = (await createResp.json()).id
    await page.request.post(
      `${baseUrl}/capi/reports/${reportId}/sections`,
      {
        headers: authHeaders,
        data: { content: `<p>The company under review is ${distinctive}.</p>` },
      },
    )

    try {
      // Step 4: open the editor and the assist panel
      await page.goto(`/reports/${reportId}/edit`)
      await page.waitForSelector('[data-testid="report-editor"]', { timeout: 10000 })
      await page.click('[data-testid="assist-toggle"]')
      await page.waitForSelector('[data-testid="assist-panel"]', { timeout: 5000 })

      // Step 5: ask a question grounded in the section content
      const question = 'What company is under review in my report? Answer in one word.'
      await page.fill('[data-testid="assist-input"]', question)
      await page.click('[data-testid="assist-send"]')

      // Wait for at least one assistant message to appear.
      await page.waitForSelector('.assist-msg--assistant', { timeout: 60_000 })

      // The response should contain the distinctive phrase, proving the
      // report context actually reached the LLM. Give streaming a moment.
      await page.waitForFunction(
        (phrase) => {
          const msgs = document.querySelectorAll('.assist-msg--assistant .msg-markdown')
          return Array.from(msgs).some((el) => el.textContent.includes(phrase))
        },
        distinctive,
        { timeout: 60_000 },
      )

      // Step 6: token usage must have gone up for this user
      const after = await page.request.get(`${baseUrl}/capi/assist/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(after.ok()).toBeTruthy()
      const afterBody = await after.json()
      expect(afterBody.tokens_1h).toBeGreaterThan(0)
      expect(afterBody.tokens_24h).toBeGreaterThanOrEqual(afterBody.tokens_1h)
      expect(afterBody.tokens_7d).toBeGreaterThanOrEqual(afterBody.tokens_24h)

      // Step 7: usage-history endpoint returns per-day data for today
      const histResp = await page.request.get(`${baseUrl}/capi/assist/usage-history?days=7`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(histResp.ok()).toBeTruthy()
      const hist = await histResp.json()
      expect(hist.days).toBe(7)
      expect(hist.points.length).toBeGreaterThan(0)
      const today = new Date().toISOString().slice(0, 10)
      const todayPoint = hist.points.find((p) => p.date === today)
      expect(todayPoint).toBeTruthy()
      expect(todayPoint.tokens_in + todayPoint.tokens_out).toBeGreaterThan(0)

      // Step 8: AI usage metrics page renders the chart
      await page.goto('/ai-usage')
      await expect(page.locator('.usage-title')).toHaveText('AI usage metrics', { timeout: 10000 })
      // Summary cards should show non-zero values (we just consumed tokens)
      await expect(page.locator('.usage-card-value').first()).not.toHaveText('0', { timeout: 5000 })
    } finally {
      // Cleanup
      await page.request.delete(`${baseUrl}/capi/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  })
})

test.describe('Article quality evaluator', () => {
  test('evaluate button scores the story and renders both bars + suggestions', async ({ page }) => {
    const token = makeTestToken()
    await page.goto('/')
    await page.evaluate((t) => localStorage.setItem('gmr-token', t), token)
    const baseUrl = page.url().replace(/\/$/, '')

    // Seed a report via the API.
    const createResp = await page.request.post(`${baseUrl}/capi/reports`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { title: 'E2E Quality Test', abstract: 'quality heuristic e2e' },
    })
    expect(createResp.ok()).toBeTruthy()
    const reportId = (await createResp.json()).id

    // Open the editor and add some prose (a data-less story).
    await page.goto(`/reports/${reportId}/edit`)
    await page.waitForSelector('[data-testid="story-editor"]', { timeout: 10000 })
    const editor = page.locator('.tiptap-editor .tiptap').first()
    await editor.click()
    await editor.fill('Some analysis prose for the article quality heuristic. '.repeat(15))

    // Evaluate quality → the panel with both bars appears.
    await page.click('[data-testid="evaluate-quality-btn"]')
    await expect(page.locator('[data-testid="quality-report"]')).toBeVisible()
    await expect(page.locator('[data-testid="quality-bar-reading-time"]')).toBeVisible()
    await expect(page.locator('[data-testid="quality-bar-balance"]')).toBeVisible()

    // Both bars carry an explicit width (the score), 0–100%.
    for (const id of ['reading-time-fill', 'balance-fill']) {
      const style = await page.locator(`[data-testid="${id}"]`).getAttribute('style')
      expect(style).toMatch(/width:\s*\d+%/)
    }

    // A prose-only story must be flagged as missing data.
    await expect(page.locator('[data-testid="balance-value"]')).toContainText(/no data/i)
    await expect(page.locator('[data-testid="quality-suggestions"]')).toContainText(/data plots/i)

    // Cleanup.
    await page.request.delete(`${baseUrl}/capi/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  })
})
