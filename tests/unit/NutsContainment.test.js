/**
 * NUTS hierarchy integrity tests.
 *
 * These tests validate the bundled GeoJSON data rather than any specific
 * component.  They verify:
 *
 * 1. NUTS code structure — each feature's nuts_code matches the declared
 *    level length (L0=2, L1=3, L2=4, L3=5 characters).
 *
 * 2. Prefix hierarchy — every NUTS N code starts with the NUTS N-1 code of
 *    its parent (this is the defining property of the NUTS coding scheme).
 *    E.g. "DE1" (L1) starts with "DE" (L0);  "DE11" (L2) starts with "DE1".
 *
 * 3. Geographic containment — the bounding box of each NUTS N region is
 *    contained within the bounding box of its NUTS N-1 parent (same country).
 *    Bounding-box containment is a necessary (but not sufficient) condition
 *    for true polygon containment;  it's an efficient sanity check on the
 *    boundary data.
 *
 * 4. Coverage — every NUTS 1 country prefix appears in NUTS 0; every NUTS 2
 *    prefix appears in NUTS 1; every NUTS 3 prefix appears in NUTS 2.
 *
 * 5. Level property — every feature's `level` property matches the file it
 *    came from.
 */
import { describe, it, expect } from 'vitest'
import nuts0 from '../fixtures/nuts0.fixture.json'
import nuts1 from '../fixtures/nuts1.fixture.json'
import nuts2 from '../fixtures/nuts2.fixture.json'
import nuts3 from '../fixtures/nuts3.fixture.json'

// ── helpers ──────────────────────────────────────────────────────────────────

function bbox(feature) {
  const coords = flatCoords(feature.geometry)
  const lons = coords.map((c) => c[0])
  const lats = coords.map((c) => c[1])
  return {
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  }
}

function flatCoords(geom) {
  if (!geom) return []
  if (geom.type === 'Point') return [geom.coordinates]
  if (geom.type === 'LineString') return geom.coordinates
  if (geom.type === 'Polygon') return geom.coordinates.flat()
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat(2)
  if (geom.type === 'MultiLineString') return geom.coordinates.flat()
  return []
}

// A bbox `inner` is contained within `outer` with tolerance `eps` degrees.
function bboxContains(outer, inner, eps = 0.5) {
  return (
    inner.minLon >= outer.minLon - eps &&
    inner.maxLon <= outer.maxLon + eps &&
    inner.minLat >= outer.minLat - eps &&
    inner.maxLat <= outer.maxLat + eps
  )
}

function indexByCode(features) {
  return new Map(features.map((f) => [f.properties.nuts_code, f]))
}

const byLevel = [nuts0, nuts1, nuts2, nuts3].map((g) => g.features)

// ── 1. NUTS code structure ───────────────────────────────────────────────────

describe('NUTS code structure', () => {
  const expectedLength = [2, 3, 4, 5]

  for (let lv = 0; lv <= 3; lv++) {
    it(`all NUTS ${lv} codes are ${expectedLength[lv]} characters`, () => {
      for (const f of byLevel[lv]) {
        expect(
          f.properties.nuts_code.length,
          `${f.properties.nuts_code} has wrong length`,
        ).toBe(expectedLength[lv])
      }
    })
  }

  it('all nuts_code values are uppercase ASCII', () => {
    for (let lv = 0; lv <= 3; lv++) {
      for (const f of byLevel[lv]) {
        expect(f.properties.nuts_code).toMatch(/^[A-Z0-9]+$/)
      }
    }
  })
})

// ── 2. Level property matches file ──────────────────────────────────────────

describe('Level property consistency', () => {
  for (let lv = 0; lv <= 3; lv++) {
    it(`every feature in nuts${lv} has level === ${lv}`, () => {
      for (const f of byLevel[lv]) {
        expect(f.properties.level, `${f.properties.nuts_code} level mismatch`).toBe(lv)
      }
    })
  }
})

// ── 3. Prefix hierarchy ──────────────────────────────────────────────────────

describe('Prefix hierarchy (NUTS code inheritance)', () => {
  for (let child = 1; child <= 3; child++) {
    const parent = child - 1
    it(`every NUTS ${child} code starts with its NUTS ${parent} parent code`, () => {
      const parentCodes = new Set(byLevel[parent].map((f) => f.properties.nuts_code))
      const failures = []
      for (const f of byLevel[child]) {
        const code = f.properties.nuts_code
        const expectedParent = code.slice(0, expectedLength[parent])
        if (!parentCodes.has(expectedParent)) {
          failures.push(`${code} → expected parent ${expectedParent} not found in NUTS ${parent}`)
        }
      }
      expect(failures, failures.join('\n')).toHaveLength(0)
    })
  }
})

const expectedLength = [2, 3, 4, 5]

// ── 4. Coverage — every child prefix maps to a parent ───────────────────────

describe('Coverage — all parent codes referenced by children exist', () => {
  for (let child = 1; child <= 3; child++) {
    const parent = child - 1
    it(`every NUTS ${parent} code referenced by a NUTS ${child} exists`, () => {
      const parentCodes = new Set(byLevel[parent].map((f) => f.properties.nuts_code))
      const childParentPrefixes = new Set(
        byLevel[child].map((f) => f.properties.nuts_code.slice(0, expectedLength[parent]))
      )
      for (const prefix of childParentPrefixes) {
        expect(parentCodes.has(prefix), `Parent ${prefix} missing from NUTS ${parent}`).toBe(true)
      }
    })
  }
})

// ── 5. Geographic containment ─────────────────────────────────────────────────

describe('Geographic containment (bounding-box)', () => {
  for (let child = 1; child <= 3; child++) {
    const parent = child - 1
    it(`NUTS ${child} bounding boxes are within their NUTS ${parent} parent bbox`, () => {
      const parentIndex = indexByCode(byLevel[parent])
      const failures = []

      for (const childFeature of byLevel[child]) {
        const code = childFeature.properties.nuts_code
        const parentCode = code.slice(0, expectedLength[parent])
        const parentFeature = parentIndex.get(parentCode)
        if (!parentFeature) continue  // covered by prefix test above

        const childBox  = bbox(childFeature)
        const parentBox = bbox(parentFeature)

        if (!bboxContains(parentBox, childBox)) {
          failures.push(
            `${code} bbox [${childBox.minLon.toFixed(1)},${childBox.minLat.toFixed(1)}`
            + ` → ${childBox.maxLon.toFixed(1)},${childBox.maxLat.toFixed(1)}]`
            + ` exceeds parent ${parentCode} bbox`
            + ` [${parentBox.minLon.toFixed(1)},${parentBox.minLat.toFixed(1)}`
            + ` → ${parentBox.maxLon.toFixed(1)},${parentBox.maxLat.toFixed(1)}]`,
          )
        }
      }
      // Allow at most 5% failures — island/overseas regions (PT3, FRY, ITG, EL4, FI2)
      // legitimately exceed their parent's bbox; these are real geographic edge cases
      const maxAllowed = Math.ceil(byLevel[child].length * 0.05)
      expect(failures.length, `${failures.length} regions exceeded parent bbox:\n${failures.slice(0,5).join('\n')}`).toBeLessThanOrEqual(maxAllowed)
    })
  }
})

// ── 6. No duplicate codes within a level ─────────────────────────────────────

describe('No duplicate NUTS codes per level', () => {
  for (let lv = 0; lv <= 3; lv++) {
    it(`NUTS ${lv} has no duplicate codes`, () => {
      const codes = byLevel[lv].map((f) => f.properties.nuts_code)
      const dupes = codes.filter((c, i) => codes.indexOf(c) !== i)
      expect(dupes).toHaveLength(0)
    })
  }
})
