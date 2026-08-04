/**
 * The manifest is generated, and this test is what keeps it that way.
 *
 * A hand-maintained sitemap is stale the day after it is written, and the
 * failure is silent: the agent simply never learns the new page exists.
 * So the committed artifact is compared against a fresh build on every
 * run, and a route added without a description fails here rather than
 * quietly leaving a blind spot.
 *
 * Regenerate with:  UPDATE_ROUTE_MANIFEST=1 npm run test -- routeManifest
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createFontemRouter } from '../../src/app.js'
import { buildRouteManifest, navigableRoutes, ROUTE_DESCRIPTIONS, NOT_NAVIGABLE } from '../../src/agent/routeManifest.js'

const ARTIFACT = path.resolve(__dirname, '../../src/generated/route-manifest.json')

function fresh() {
  // ssr=true -> memory history, so no DOM/history dependency here.
  return buildRouteManifest(createFontemRouter(true))
}

describe('route manifest', () => {
  it('matches the committed artifact', () => {
    const built = fresh()
    if (process.env.UPDATE_ROUTE_MANIFEST) {
      fs.mkdirSync(path.dirname(ARTIFACT), { recursive: true })
      fs.writeFileSync(ARTIFACT, JSON.stringify(built, null, 2) + '\n')
    }
    expect(fs.existsSync(ARTIFACT), `${ARTIFACT} missing — regenerate it`).toBe(true)
    const committed = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8'))
    expect(committed).toEqual(built)
  })

  it('no route is left unclassified', () => {
    // The point of the whole file: adding a route forces you to say what
    // it is for, or to state that the agent should not go there. Neither
    // is optional, because the failure mode of forgetting is silent.
    const unclassified = fresh().routes
      .filter((r) => !r.redirects_to)
      .filter((r) => !r.description && !NOT_NAVIGABLE.has(r.path))
      .map((r) => r.path)
    expect(unclassified,
      'add a ROUTE_DESCRIPTIONS entry or list it in NOT_NAVIGABLE').toEqual([])
  })

  it('excluded routes are never offered for navigation', () => {
    const nav = new Set(navigableRoutes(fresh()).map((r) => r.path))
    for (const p of NOT_NAVIGABLE) expect(nav.has(p)).toBe(false)
  })

  it('every described path is a real route', () => {
    const paths = new Set(fresh().routes.map((r) => r.path))
    const orphans = Object.keys(ROUTE_DESCRIPTIONS).filter((p) => !paths.has(p))
    expect(orphans, 'descriptions for routes that no longer exist').toEqual([])
  })

  it('navigable routes exclude redirect stubs', () => {
    const m = fresh()
    expect(m.routes.some((r) => r.redirects_to)).toBe(true)
    expect(navigableRoutes(m).every((r) => !r.redirects_to)).toBe(true)
  })

  it('marks auth-gated routes so the agent does not send signed-out users there', () => {
    const m = fresh()
    const mine = m.routes.find((r) => r.path === '/my-stories')
    expect(mine?.requires_auth).toBe(true)
    const home = m.routes.find((r) => r.path === '/')
    expect(home?.requires_auth).toBeUndefined()
  })

  it('captures path params so the agent knows a route needs one', () => {
    const withParams = fresh().routes.filter((r) => r.params)
    expect(withParams.length).toBeGreaterThan(0)
    expect(withParams.every((r) => Array.isArray(r.params) && r.params.length)).toBe(true)
  })
})
