import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const LOCALES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'locales')

const read = (name) => JSON.parse(fs.readFileSync(path.join(LOCALES, name), 'utf8'))

function flatten(obj, prefix = '') {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key))
    else out[key] = v
  }
  return out
}

const others = fs.readdirSync(LOCALES).filter((f) => f.endsWith('.json') && f !== 'en.json')
const en = flatten(read('en.json'))

describe('locale parity', () => {
  // The platform ships 24 EU languages. A key added to en.json and nowhere
  // else does not fail loudly — vue-i18n falls back to English — so the UI
  // silently goes half-translated and nobody notices until a speaker of
  // that language looks at it. That is exactly how the Help page, the MCP
  // token card and the provider-key card ended up untranslated.
  it('ships 23 locales besides English', () => {
    expect(others).toHaveLength(23)
  })

  it.each(others)('%s has every key en.json has, and no others', (file) => {
    const loc = flatten(read(file))
    const missing = Object.keys(en).filter((k) => !(k in loc))
    const extra = Object.keys(loc).filter((k) => !(k in en))
    expect({ missing, extra }).toEqual({ missing: [], extra: [] })
  })

  it.each(others)('%s preserves every interpolation placeholder', (file) => {
    // A dropped {date} or a translated {n} does not throw — vue-i18n just
    // renders the braces literally, so the user sees "added {date}".
    const loc = flatten(read(file))
    const names = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    const drift = Object.keys(en)
      .filter((k) => k in loc)
      .map((k) => ({ key: k, en: names(en[k]), loc: names(loc[k]) }))
      .filter((r) => r.en.join() !== r.loc.join())
    expect(drift).toEqual([])
  })

  it.each(others)('%s is not a verbatim copy of English', (file) => {
    // Some values legitimately match — brand names, "Claude Code", "{n} min".
    // A locale that matches on most of its long strings has not been
    // translated at all, which a key-parity check alone would call fine.
    const loc = flatten(read(file))
    const long = Object.keys(en).filter((k) => typeof en[k] === 'string' && en[k].length > 40)
    const identical = long.filter((k) => loc[k] === en[k])
    expect(identical.length / long.length).toBeLessThan(0.2)
  })
})
