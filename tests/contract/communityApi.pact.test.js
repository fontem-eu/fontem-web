/**
 * Consumer pact: fontem-web ↔ fontem-community-api.
 *
 * Each interaction runs the REAL api-client wrapper against Pact's mock
 * provider, so the pact records exactly what the frontend sends — method,
 * path, query (withLang), headers and body — and what it relies on in the
 * response. The provider side never runs: its CI cross-validates these
 * pacts statically against its generated OpenAPI spec.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import { PactV4, MatchersV3 } from '@pact-foundation/pact'
import { _internal } from '../../src/api/session.js'
import { getReport, createReport, listFollowedTags } from '../../src/api/community.js'
import { searchStories } from '../../src/api/search.js'
import { useLang } from '../../src/composables/useLang.js'

// The app always boots the lang composable, so every request carries
// ?lang=<code>; mirror that here or the recorded pacts would misstate
// what the frontend sends.
useLang().init()

const { like, eachLike, regex } = MatchersV3

const pact = new PactV4({
  consumer: 'fontem-web',
  provider: 'fontem-community-api',
  dir: path.resolve(process.cwd(), 'pacts'),
})

// The wrappers call fetch('/capi/<path>'); point that at the mock provider.
const realFetch = globalThis.fetch
function routeCapiTo(mockUrl) {
  globalThis.fetch = (url, init) => {
    const s = String(url)
    if (s.startsWith('/capi/')) return realFetch(mockUrl + s.slice('/capi'.length), init)
    return realFetch(url, init)
  }
}

beforeEach(() => { _internal.clearForTests() })
afterEach(() => { globalThis.fetch = realFetch; _internal.clearForTests() })

describe('data stories', () => {
  it('fetches a public story by id', () =>
    pact
      .addInteraction()
      .given('a public data story exists', { id: '6f9a2b1c-3d4e-5f60-8a9b-0c1d2e3f4a5b' })
      .uponReceiving('a request for one data story')
      .withRequest('GET', '/data-stories/6f9a2b1c-3d4e-5f60-8a9b-0c1d2e3f4a5b', (b) =>
        b.query({ lang: 'en' }))
      .willRespondWith(200, (b) =>
        b.jsonBody({
          id: like('6f9a2b1c-3d4e-5f60-8a9b-0c1d2e3f4a5b'),
          title: like('Water quality in the Tagus'),
          abstract: like('What the data says.'),
        }))
      .executeTest(async (mock) => {
        routeCapiTo(mock.url)
        const story = await getReport('6f9a2b1c-3d4e-5f60-8a9b-0c1d2e3f4a5b')
        expect(story.id).toBe('6f9a2b1c-3d4e-5f60-8a9b-0c1d2e3f4a5b')
        expect(story.title).toBeTruthy()
      }))

  it('creates a story for a signed-in user', () =>
    pact
      .addInteraction()
      .given('the user is authenticated')
      .uponReceiving('a request to create a data story')
      .withRequest('POST', '/data-stories', (b) =>
        b
          .query({ lang: 'en' })
          .headers({
            'Content-Type': 'application/json',
            Authorization: regex(/^Bearer .+/, 'Bearer pact-token'),
          })
          .jsonBody({ title: 'New story', abstract: 'Draft.' }))
      .willRespondWith(201, (b) =>
        b.jsonBody({ id: like('story-2'), title: like('New story') }))
      .executeTest(async (mock) => {
        routeCapiTo(mock.url)
        _internal.setAccessToken('pact-token')
        const created = await createReport('New story', 'Draft.')
        expect(created.id).toBeTruthy()
      }))

  it('searches public stories', () =>
    pact
      .addInteraction()
      .given('published stories exist')
      .uponReceiving('a story keyword search')
      .withRequest('GET', '/data-stories/search', (b) =>
        b.query({ q: 'water', limit: '20', offset: '0', lang: 'en' }))
      .willRespondWith(200, (b) =>
        b.jsonBody(eachLike({ id: like('6f9a2b1c-3d4e-5f60-8a9b-0c1d2e3f4a5b'), title: like('Water quality') })))
      .executeTest(async (mock) => {
        routeCapiTo(mock.url)
        const results = await searchStories({ q: 'water' })
        expect(Array.isArray(results)).toBe(true)
        expect(results[0].id).toBeTruthy()
      }))
})

describe('followed tags', () => {
  it('lists the signed-in user’s followed tags', () =>
    pact
      .addInteraction()
      .given('the user is authenticated', { tags: ['procurement'] })
      .uponReceiving('a request for the followed tags')
      .withRequest('GET', '/me/followed-tags', (b) =>
        b
          .query({ lang: 'en' })
          .headers({ Authorization: regex(/^Bearer .+/, 'Bearer pact-token') }))
      .willRespondWith(200, (b) =>
        b.jsonBody({ tags: eachLike('procurement') }))
      .executeTest(async (mock) => {
        routeCapiTo(mock.url)
        _internal.setAccessToken('pact-token')
        const r = await listFollowedTags()
        expect(r.tags).toContain('procurement')
      }))
})
