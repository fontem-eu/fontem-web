import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

/**
 * Third-party code loads where it is needed, and nowhere else.
 *
 * Google Identity Services sat in index.html, so Google's script ran on every
 * page of the app — the editor, the Data Studio, every authenticated view —
 * when the only thing that needs it is the sign-in button. DAST reported it as
 * cross-domain script inclusion on 41 pages and missing SRI on 52; the real
 * objection is that a third-party script with full DOM access does not belong
 * on a page that is showing someone else's data.
 *
 * SRI is not the fix and must not be "corrected" later: Google serves that URL
 * mutably and publishes no hash, so pinning one turns their next update into a
 * sign-in outage. Scope is the control.
 */
describe('third-party scripts', () => {
  it('the app shell loads no cross-origin script', () => {
    const html = read('index.html')
    const external = [...html.matchAll(/<script[^>]*src="(https?:\/\/[^"]+)"/g)].map((m) => m[1])
    expect(external).toEqual([])
  })

  it('Google Identity is loaded by the login view, on demand', () => {
    const login = read('src/views/LoginView.vue')
    expect(login).toContain('accounts.google.com/gsi/client')
    expect(login).toMatch(/createElement\(['"`]script['"`]\)/)
  })

  it('is the only view that touches Google', () => {
    // A second loader elsewhere would quietly undo the scoping.
    const views = fs.readdirSync(path.join(ROOT, 'src', 'views'))
      .filter((f) => f.endsWith('.vue'))
      .filter((f) => read(path.join('src', 'views', f)).includes('accounts.google.com'))
    expect(views).toEqual(['LoginView.vue'])
  })
})

/**
 * Response headers. These live in nginx config rather than code, so nothing
 * else would notice them going missing — which is exactly how CSP kept
 * disappearing from locations that set their own add_header.
 */
describe('security headers', () => {
  const headers = read('security-headers.conf')
  const nginx = read('nginx.conf')

  it('keeps script-src free of unsafe-inline and unsafe-eval', () => {
    const csp = headers.match(/add_header Content-Security-Policy "([^"]+)"/)[1]
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'))
    expect(scriptSrc).not.toContain("'unsafe-inline'")
    expect(scriptSrc).not.toContain("'unsafe-eval'")
  })

  it('keeps the clickjacking and object controls', () => {
    const csp = headers.match(/add_header Content-Security-Policy "([^"]+)"/)[1]
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
  })

  it('serves HTML with no-store', () => {
    // The shell and the prerendered pages carry whatever the logged-in user
    // is looking at once Vue hydrates; they must not sit in a shared cache.
    const root = nginx.match(/location \/ \{[\s\S]*?\n {4}\}/)[0]
    expect(root).toContain('add_header Cache-Control "no-store" always;')
  })

  it('re-includes the header snippet in every location that sets a header', () => {
    // nginx drops ALL inherited add_header directives the moment a location
    // sets one of its own. Every location that adds a header must therefore
    // pull the snippet back in, or it silently loses CSP.
    const locations = [...nginx.matchAll(/location [^\{]*\{[\s\S]*?\n {4}\}/g)].map((m) => m[0])
    const offenders = locations
      .filter((b) => /add_header/.test(b))
      .filter((b) => !/include .*security-headers\.conf/.test(b))
      .map((b) => b.split('\n')[0].trim())
    expect(offenders).toEqual([])
  })
})
