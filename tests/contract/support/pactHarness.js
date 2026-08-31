/**
 * Shared plumbing for the consumer pact suites.
 *
 * The api clients call `fetch('/capi/…')` with `?lang=` appended by
 * withLang(). Both facts are part of what we promise the provider, so
 * the harness boots the lang composable (as the app does) and routes the
 * /capi prefix at Pact's mock server rather than stubbing fetch — the
 * point of a pact is that the REAL client code produces the request.
 */
import path from 'node:path'
import { PactV4 } from '@pact-foundation/pact'
import { useLang } from '../../../src/composables/useLang.js'

useLang().init()

export function makePact(provider = 'fontem-community-api') {
  return new PactV4({
    consumer: 'fontem-web',
    provider,
    dir: path.resolve(process.cwd(), 'pacts'),
  })
}

const realFetch = globalThis.fetch

/** Point the app's /capi calls at the mock provider for one interaction. */
export function routeCapiTo(mockUrl) {
  globalThis.fetch = (url, init) => {
    const s = String(url)
    if (s.startsWith('/capi/')) return realFetch(mockUrl + s.slice('/capi'.length), init)
    return realFetch(url, init)
  }
}

export function restoreFetch() {
  globalThis.fetch = realFetch
}
