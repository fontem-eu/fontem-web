/**
 * Request-conformance sweep.
 *
 * Calls every exported API wrapper once, intercepts the outgoing fetch,
 * and checks the request against the pinned OpenAPI spec:
 *
 *   • does <method> <path> resolve to a real operation? (path templates
 *     like /data-stories/{report_id} are matched, not string-compared)
 *   • does each path parameter satisfy its schema (e.g. the UUID pattern
 *     on report_id — a mock using 'story-1' would be a request the real
 *     API rejects with 422)
 *   • is every query parameter we send actually declared?
 *
 * The spec is a committed artefact of the API repo, so it can be pinned
 * at ANY commit with no deployment:
 *
 *   node scripts/fetch-api-spec.mjs --ref=<sha|branch>   # default: main
 *
 * Run it against an API branch before you break something, and this
 * lists every frontend call site that would need to change.
 *
 * This is a breadth net, not a contract in the pact sense: it says the
 * request is *shaped* like something the API offers. Behaviour is the
 * e2e suite's job; the hand-written pacts carry the flows worth
 * describing precisely.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { useLang } from '../../src/composables/useLang.js'
import { _internal } from '../../src/api/session.js'

import * as community from '../../src/api/community.js'
import * as studio from '../../src/api/studio.js'
import * as search from '../../src/api/search.js'
import * as atlasApi from '../../src/api/atlas.js'
import * as geo from '../../src/api/geo.js'
import * as gmr from '../../src/api/gmr.js'
import * as tickers from '../../src/api/tickers.js'
import * as petitions from '../../src/api/petitions.js'
import * as euroTracker from '../../src/api/euroTracker.js'

const SPEC_PATH = path.resolve('contracts/fontem-community-api.openapi.json')

// Wrappers that are plumbing rather than endpoint calls, or that need a
// live browser surface — not part of the request surface under test.
const SKIP = new Set([
  'request', 'streamRequest', 'buildRequestInit', 'authHeaders', 'withLang',
  'uploadReportImage', 'uploadAvatar', // multipart; covered by their own tests
])

const UUID = '6f9a2b1c-3d4e-5f60-8a9b-0c1d2e3f4a5b'

/**
 * Derive plausible arguments from the wrapper's own signature, so the
 * sweep stays maintenance-free as wrappers come and go: a destructured
 * or body-ish parameter gets an object, everything else gets a UUID
 * (ids dominate, and a UUID satisfies the id patterns the spec pins).
 * ARGS below overrides this only where the shape genuinely matters.
 */
function inferArgs(fn) {
  const src = fn.toString()
  const open = src.indexOf('(')
  if (open === -1) return []
  // Walk to the matching close paren so destructured params survive.
  let depth = 0
  let end = open
  for (let i = open; i < src.length; i += 1) {
    if ('([{'.includes(src[i])) depth += 1
    if (')]}'.includes(src[i])) { depth -= 1; if (depth === 0) { end = i; break } }
  }
  const raw = src.slice(open + 1, end)
  if (!raw.trim()) return []
  // Split on top-level commas only.
  const params = []
  let buf = ''
  depth = 0
  for (const ch of raw) {
    if ('([{'.includes(ch)) depth += 1
    if (')]}'.includes(ch)) depth -= 1
    if (ch === ',' && depth === 0) { params.push(buf); buf = '' } else buf += ch
  }
  if (buf.trim()) params.push(buf)
  return params.map((p) => {
    const name = p.trim()
    const objish = name.startsWith('{')
      || /^(body|fields|data|opts|options|payload|params|patch)\b/.test(name)
    return objish ? {} : UUID
  })
}

const ARGS = {
  createReport: ['Title', 'Abstract'],
  updateReport: [UUID, { title: 'T' }],
  putReportTags: [UUID, ['water']],
  chooseAssistantModel: ['claude-sonnet-4'],
  renameAssistConversation: [`report:${UUID}`, 'New title'],
  createAssistConversation: ['Title'],
  putProviderCredential: [{ provider: 'anthropic', apiKey: 'k', model: 'm' }],
  searchGraph: [{ q: 'water' }],
  searchStories: [{ q: 'water' }],
  fetchRecommendations: ['PRT'],
  searchTickers: ['sie'],
  searchAll: ['sie'],
  fetchPetitionDetail: ['ECI(2024)000001'],
  // `lang` path params take a 2-letter code, not an id.
  getTranslation: [UUID, 'pt'],
  saveTranslation: [UUID, 'pt', { title: 'T' }],
  resolveTranslation: [UUID, 'pt'],
  deleteTranslation: [UUID, 'pt'],
}

const MODULES = {
  community, studio, search, atlas: atlasApi, geo, gmr, tickers, petitions, euroTracker,
}

let spec
let operations // [{ method, segments, params }]

function specOperations(s) {
  const ops = []
  for (const [tmpl, methods] of Object.entries(s.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue
      const inherited = methods.parameters || []
      ops.push({
        method: method.toUpperCase(),
        template: tmpl,
        segments: tmpl.split('/').filter(Boolean),
        params: [...inherited, ...(op.parameters || [])],
      })
    }
  }
  return ops
}

/** Match a concrete path against a spec template, honouring {placeholders}. */
function matchOperation(method, pathname) {
  const parts = pathname.split('/').filter(Boolean)
  return operations.find((op) => {
    if (op.method !== method) return false
    if (op.segments.length !== parts.length) return false
    return op.segments.every((seg, i) =>
      (seg.startsWith('{') && seg.endsWith('}')) || seg === parts[i])
  })
}

function pathParamProblems(op, pathname) {
  const parts = pathname.split('/').filter(Boolean)
  const problems = []
  op.segments.forEach((seg, i) => {
    if (!(seg.startsWith('{') && seg.endsWith('}'))) return
    const rawName = seg.slice(1, -1).split(':')[0] // {key:path} → key
    const decl = op.params.find((p) => p.in === 'path' && p.name === rawName)
    const pattern = decl?.schema?.pattern
    if (!pattern) return
    const value = decodeURIComponent(parts[i])
    if (!new RegExp(pattern).test(value)) {
      problems.push(`path param ${rawName}="${value}" violates ${pattern}`)
    }
  })
  return problems
}

function queryProblems(op, url) {
  const declared = new Set(op.params.filter((p) => p.in === 'query').map((p) => p.name))
  const problems = []
  for (const name of url.searchParams.keys()) {
    if (!declared.has(name)) problems.push(`query param "${name}" is not declared`)
  }
  return problems
}

/** Invoke one wrapper with the fetch layer stubbed; return the request it made. */
async function captureRequest(fn, args) {
  let captured = null
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, init = {}) => {
    captured = { url: String(url), method: (init.method || 'GET').toUpperCase() }
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
      body: null,
    }
  }
  try {
    await fn(...args)
  } catch {
    // A wrapper may reject on our empty stub response; the REQUEST is
    // what we are inspecting and it has already been captured.
  } finally {
    globalThis.fetch = realFetch
  }
  return captured
}

beforeAll(() => {
  if (!existsSync(SPEC_PATH)) {
    throw new Error(
      `No pinned spec at ${SPEC_PATH}. Run: node scripts/fetch-api-spec.mjs [--ref=<sha>]`)
  }
  spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8'))
  operations = specOperations(spec)
  useLang().init()
})
beforeEach(() => { _internal.setAccessToken('sweep-token') })
afterAll(() => { _internal.clearForTests() })

describe('request conformance against the pinned API spec', () => {
  const cases = []
  for (const [modName, mod] of Object.entries(MODULES)) {
    for (const [name, fn] of Object.entries(mod)) {
      if (typeof fn !== 'function' || SKIP.has(name)) continue
      cases.push([`${modName}.${name}`, fn, name])
    }
  }

  it('has wrappers to sweep', () => {
    expect(cases.length).toBeGreaterThan(100)
  })

  // Report, don't obstruct: findings are printed (and counted) but do not
  // fail the run, matching how the rest of contract testing behaves here.
  // Set CONTRACT_SWEEP_STRICT=1 to turn them into failures — which is what
  // you want when deliberately sweeping against an API branch:
  //   npm run contracts:pin -- --ref=<sha> && CONTRACT_SWEEP_STRICT=1 npm run test:contract
  const STRICT = process.env.CONTRACT_SWEEP_STRICT === '1'
  const findings = []

  it.each(cases)('%s', async (label, fn, name) => {
    const args = ARGS[name] || inferArgs(fn)
    const req = await captureRequest(fn, args)
    if (!req) return // wrapper short-circuits without a request (blank query etc.)

    const url = new URL(req.url, 'http://local')
    // Only the community API is pinned here; /api (graph) has no spec yet.
    if (!url.pathname.startsWith('/capi/')) return
    const pathname = url.pathname.slice('/capi'.length)

    const op = matchOperation(req.method, pathname)
    if (!op) {
      const msg = `${label}: ${req.method} ${pathname} is not in the API spec`
      findings.push(msg)
      if (STRICT) expect.fail(msg)
      return
    }

    const problems = [...pathParamProblems(op, pathname), ...queryProblems(op, url)]
    if (problems.length) {
      const msg = `${label}: ${req.method} ${pathname} — ${problems.join('; ')}`
      findings.push(msg)
      if (STRICT) expect.fail(msg)
    }
  })

  afterAll(() => {
    if (!findings.length) return
    // eslint-disable-next-line no-console
    console.warn(
      `\n⚠ contract sweep: ${findings.length} request(s) do not match the pinned spec:\n`
      + findings.map((f) => `   • ${f}`).join('\n')
      + '\n   (re-run with CONTRACT_SWEEP_STRICT=1 to fail on these)\n',
    )
  })
})
