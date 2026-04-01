import { test, expect } from '@playwright/test'

test.describe('Architecture diagrams — Mermaid rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/architecture')
    // Wait for Mermaid to load from CDN
    await page.waitForFunction(() => window.mermaid, { timeout: 10000 })
  })

  test('system overview diagram renders without errors', async ({ page }) => {
    // System overview is expanded by default
    const diagram = page.locator('.arch-diagram').first()
    await expect(diagram).toBeVisible({ timeout: 5000 })

    // Mermaid replaces the <pre> content with an SVG
    const svg = diagram.locator('svg')
    await expect(svg).toBeVisible({ timeout: 10000 })

    // Check for error indicators
    const errorText = await diagram.locator('.error-icon, .error-text, [class*="error"]').count()
    expect(errorText).toBe(0)
  })

  test('interface map diagram renders when expanded', async ({ page }) => {
    // Click to expand the Interface Map section
    await page.locator('.arch-toggle', { hasText: 'Interface Map' }).click()
    await page.waitForTimeout(500)

    const section = page.locator('.arch-section').filter({ hasText: 'Interface Map' })
    const svg = section.locator('svg')
    await expect(svg).toBeVisible({ timeout: 10000 })

    // Should contain class names from the diagram
    const svgContent = await svg.innerHTML()
    expect(svgContent).toContain('FinancialDataSource')
  })

  test('neo4j schema diagram renders when expanded', async ({ page }) => {
    await page.locator('.arch-toggle', { hasText: 'Neo4j Schema' }).click()
    await page.waitForTimeout(500)

    const section = page.locator('.arch-section').filter({ hasText: 'Neo4j Schema' })
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

  test('request flow diagram renders when expanded', async ({ page }) => {
    await page.locator('.arch-toggle', { hasText: 'Request Flow' }).click()
    await page.waitForTimeout(500)

    const section = page.locator('.arch-section').filter({ hasText: 'Request Flow' })
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
    // After mermaid processes them, the pre elements should contain SVGs or be replaced
    // If they still have raw text content without an SVG child, that's a failure
    for (let i = 0; i < unprocessed; i++) {
      const pre = page.locator('pre.mermaid').nth(i)
      const isVisible = await pre.isVisible()
      if (isVisible) {
        const svgChild = pre.locator('svg')
        const hasSvg = await svgChild.count()
        // A visible mermaid pre should have been processed into an SVG
        // (or mermaid replaces the pre entirely with a div containing SVG)
        if (hasSvg === 0) {
          const text = await pre.textContent()
          // If it still has diagram keywords, it wasn't rendered
          if (text.includes('flowchart') || text.includes('classDiagram') || text.includes('erDiagram')) {
            throw new Error(`Diagram ${i} was not rendered by Mermaid: ${text.substring(0, 100)}`)
          }
        }
      }
    }
  })
})
