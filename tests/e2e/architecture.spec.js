import { test, expect } from '@playwright/test'

test.describe('Architecture diagrams — Mermaid rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/architecture')
    // Wait for Mermaid to load from CDN
    await page.waitForFunction(() => window.mermaid, { timeout: 10000 })
  })

  test('infrastructure diagram renders without errors', async ({ page }) => {
    // Infrastructure is expanded by default
    const diagram = page.locator('.arch-diagram').first()
    await expect(diagram).toBeVisible({ timeout: 5000 })

    const svg = diagram.locator('svg')
    await expect(svg).toBeVisible({ timeout: 10000 })

    const errorText = await diagram.locator('.error-icon, .error-text, [class*="error"]').count()
    expect(errorText).toBe(0)
  })

  test('backend architecture diagram renders when expanded', async ({ page }) => {
    await page.locator('.arch-toggle', { hasText: 'Backend Architecture' }).click()
    await page.waitForTimeout(500)

    const section = page.locator('.arch-section').filter({ hasText: 'Backend Architecture' })
    const svg = section.locator('svg')
    await expect(svg).toBeVisible({ timeout: 10000 })

    const svgContent = await svg.innerHTML()
    expect(svgContent).toContain('FinancialDataSource')
  })

  test('neo4j data model diagram renders when expanded', async ({ page }) => {
    await page.locator('.arch-toggle', { hasText: 'Neo4j Data Model' }).click()
    await page.waitForTimeout(500)

    const section = page.locator('.arch-section').filter({ hasText: 'Neo4j Data Model' })
    const svg = section.locator('svg')
    await expect(svg).toBeVisible({ timeout: 10000 })

    const svgContent = await svg.innerHTML()
    expect(svgContent).toContain('Company')
  })

  test('data pipeline diagram renders when expanded', async ({ page }) => {
    await page.locator('.arch-toggle', { hasText: 'Data Pipeline' }).click()
    await page.waitForTimeout(500)

    const section = page.locator('.arch-section').filter({ hasText: 'Data Pipeline' })
    const svg = section.locator('svg')
    await expect(svg).toBeVisible({ timeout: 10000 })

    const svgContent = await svg.innerHTML()
    expect(svgContent).toContain('Neo4j')
  })

  test('graph explorer flow diagram renders when expanded', async ({ page }) => {
    await page.locator('.arch-toggle', { hasText: 'Graph Explorer Flow' }).click()
    await page.waitForTimeout(500)

    const section = page.locator('.arch-section').filter({ hasText: 'Graph Explorer Flow' })
    const svg = section.locator('svg')
    await expect(svg).toBeVisible({ timeout: 10000 })

    const svgContent = await svg.innerHTML()
    expect(svgContent).toContain('FastAPI')
  })

  test('no mermaid syntax error indicators on the page', async ({ page }) => {
    // Expand all sections
    const toggles = page.locator('.arch-toggle')
    const count = await toggles.count()
    for (let i = 0; i < count; i++) {
      await toggles.nth(i).click()
      await page.waitForTimeout(300)
    }

    // Wait for all diagrams to render
    await page.waitForTimeout(2000)

    // Check for Mermaid error indicators
    const errorElements = await page.locator('#d-mermaid-error, .mermaid .error, [id*="syntax-error"]').count()
    expect(errorElements).toBe(0)

    // Check that no <pre class="mermaid"> still has raw text (means it wasn't processed)
    const unprocessed = await page.locator('pre.mermaid').count()
    for (let i = 0; i < unprocessed; i++) {
      const pre = page.locator('pre.mermaid').nth(i)
      const isVisible = await pre.isVisible()
      if (isVisible) {
        const svgChild = pre.locator('svg')
        const hasSvg = await svgChild.count()
        if (hasSvg === 0) {
          const text = await pre.textContent()
          if (text.includes('flowchart') || text.includes('classDiagram') || text.includes('erDiagram')) {
            throw new Error(`Diagram ${i} was not rendered by Mermaid: ${text.substring(0, 100)}`)
          }
        }
      }
    }
  })
})
