import { test, expect } from '@playwright/test'
import { createHmac } from 'node:crypto'

/**
 * Regression: report sections must persist across save → close → reopen.
 *
 * This test creates a report, adds section content, saves, navigates away,
 * then re-opens the report and verifies the section content is still there.
 *
 * Requires CAPI_JWT_SECRET env var to mint a test token, or CAPI_TEST_TOKEN
 * with a pre-made JWT.
 */

function makeTestToken() {
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
    sub: 'e2e-test-user',
    email: 'e2e@test.gmr',
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
