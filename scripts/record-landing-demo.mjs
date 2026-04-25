/* eslint-disable no-console -- CLI progress output is the legitimate channel here */
/**
 * Fontem platform tour — standalone Playwright recording script.
 *
 * What it does: drives a real browser through a ~47-second narrative —
 * landing page → click a chip → company profile → contracts → graph
 * explorer → log in → /my-reports → new report → type → save. Records
 * the session as webm; the convert step below produces the shipped
 * public/landing-demo.{mp4,gif}.
 *
 * Run locally:
 *   node scripts/record-landing-demo.mjs
 *
 * Then convert (requires `ffmpeg`, available in the dev image):
 *   WEBM=$(find /tmp/demo-out -name '*.webm' | head -1)
 *   ffmpeg -y -i "$WEBM" -vf "fps=12,scale=900:-1:flags=lanczos,palettegen=stats_mode=full:max_colors=128" /tmp/palette.png
 *   ffmpeg -y -i "$WEBM" -i /tmp/palette.png \
 *     -lavfi "fps=12,scale=900:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5" \
 *     -loop 0 public/landing-demo.gif
 *   ffmpeg -y -i "$WEBM" -c:v libx264 -pix_fmt yuv420p -crf 28 -preset slow \
 *     -movflags +faststart -an public/landing-demo.mp4
 *
 * Uses `channel: 'chrome'` because the bundled playwright chromium
 * download is blocked at the Azure CDN from inside the cluster — see
 * code-server feat/playwright-chrome and the dev-image PR for the
 * Google Chrome install that the demo relies on.
 */
import { chromium } from 'playwright'

const OUT = '/tmp/demo-out'

async function smoothScrollTo(page, selector, durationMs = 2000) {
  await page.evaluate(async ({ selector, durationMs }) => {
    const el = document.querySelector(selector)
    if (!el) return
    const start = window.scrollY
    const end = el.getBoundingClientRect().top + window.scrollY - 80
    const t0 = performance.now()
    await new Promise((resolve) => {
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / durationMs)
        const ease = 1 - Math.pow(1 - k, 3)
        window.scrollTo(0, start + (end - start) * ease)
        if (k < 1) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
  }, { selector, durationMs })
}

async function slowType(page, locator, text, perChar = 35) {
  // Triple-click selects existing content (fields default to
  // "Untitled Analysis" etc.); Backspace clears, then type.
  await locator.click({ clickCount: 3 })
  await page.keyboard.press('Backspace')
  for (const ch of text) {
    await page.keyboard.type(ch)
    await page.waitForTimeout(perChar)
  }
}

async function dismissCookieBanner(page) {
  const accept = page.locator('button', { hasText: /^Accept$/i }).first()
  if (await accept.isVisible({ timeout: 1500 }).catch(() => false)) {
    await accept.click()
    await page.waitForTimeout(400)
  }
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  recordVideo: { dir: OUT, size: { width: 1280, height: 800 } },
})

// Pre-decline the cookie banner — it's a Teleport-to-body dialog
// keyed off localStorage. Setting the key before any page load
// keeps the screencast clean.
await context.addInitScript(() => {
  try { localStorage.setItem('gmr-cookie-consent', 'declined') } catch { /* */ }
})

const page = await context.newPage()

try {
  console.log('[0-10s] Landing')
  await page.goto('https://gmr.void42.net/', { waitUntil: 'networkidle' })
  await dismissCookieBanner(page)
  await page.waitForTimeout(2500)
  await smoothScrollTo(page, '[data-testid="howitworks"]', 2400)
  await page.waitForTimeout(1300)
  await smoothScrollTo(page, '[data-testid="recent-reports"]', 1500)
  await page.waitForTimeout(2200)

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await page.waitForTimeout(1500)

  console.log('[10-22s] Click Fujitsu chip → company → contracts')
  await page.click('[data-testid="example-chip-company"]')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2500)

  const procurementCat = page.locator('[data-testid="view-cat-procurement"]').first()
  if (await procurementCat.isVisible({ timeout: 3000 }).catch(() => false)) {
    await procurementCat.click()
    await page.waitForTimeout(800)
  }
  const contractsTab = page.locator('[data-testid="view-opt-contracts"]').first()
  if (await contractsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await contractsTab.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3500)
  }

  console.log('[22-30s] Graph Explorer chip → Siemens')
  await page.goto('https://gmr.void42.net/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.click('[data-testid="example-chip-graph"]')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(4000)

  console.log('[30-37s] Sign in via API, navigate to /my-reports')
  const tokenResp = await page.request.post(
    'https://gmr.void42.net/capi/auth/login',
    {
      data: { email: 'researcher@gmr.test', password: 'TestPass123!' },
      headers: { 'Content-Type': 'application/json' },
    },
  )
  const tokenJson = await tokenResp.json()
  await page.evaluate((args) => {
    localStorage.setItem('gmr-token', args.tok)
    localStorage.setItem('gmr-user', JSON.stringify(args.usr))
  }, { tok: tokenJson.access_token, usr: tokenJson.user })

  await page.goto('https://gmr.void42.net/my-reports', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  console.log('[37-55s] New report, type, save')
  await page.click('[data-testid="new-report-btn"]')
  await page.waitForURL(/\/reports\/.*\/edit/, { timeout: 15_000 })
  await page.waitForTimeout(1500)

  await slowType(
    page,
    page.locator('[data-testid="report-title-input"]'),
    'Fujitsu in Spanish public IT — quick look',
    50,
  )
  await page.waitForTimeout(800)

  await slowType(
    page,
    page.locator('[data-testid="report-abstract-input"]'),
    '34 contracts, €50M total, half through one central buyer.',
    35,
  )
  await page.waitForTimeout(1000)

  const editor = page.locator('.tiptap-editor .tiptap')
  await editor.click()
  await page.keyboard.type(
    'Spain’s central IT-procurement office (DGRCC) places half of Fujitsu Tech Sol ES’s public contracts.',
    { delay: 25 },
  )
  await page.keyboard.press('Enter')
  await page.waitForTimeout(600)
  await page.keyboard.type(
    'The other 17 contracts are spread across regional authorities, mostly in Andalusia.',
    { delay: 25 },
  )
  await page.waitForTimeout(800)

  await page.click('[data-testid="save-report"]')
  await page.waitForTimeout(3000)

  console.log('[55-60s] End frame on saved editor')
  await page.waitForTimeout(2000)
} finally {
  await context.close()
  await browser.close()
}

console.log('\nVideo saved under', OUT)
