#!/usr/bin/env node
/**
 * Fetch an API's OpenAPI spec at a given git ref and cache it locally.
 *
 *   node scripts/fetch-api-spec.mjs [--ref=<sha|branch>] [--repo=<name>]
 *
 * The spec is generated FROM CODE in the API repo (scripts/generate_openapi.py)
 * and committed there, so any ref resolves to the contract at that commit —
 * no deployment, no environment. Default ref: main.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const GITEA = process.env.GITEA_HOST || 'contribute.void42.internal'
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => a.replace(/^--/, '').split('=')),
)
const repo = args.repo || 'fontem-community-api'
const ref = args.ref || 'main'
const out = path.resolve('contracts', `${repo}.openapi.json`)

const token = process.env.GITEA_TOKEN || ''
const auth = token ? { Authorization: `token ${token}` } : {}
const url = `http://${GITEA}/api/v1/repos/fontem/${repo}/raw/openapi.json?ref=${encodeURIComponent(ref)}`

const res = await fetch(url, { headers: auth })
if (!res.ok) {
  console.error(`Could not fetch ${repo}@${ref}: HTTP ${res.status}`)
  console.error('The API repo must commit its generated openapi.json (CI keeps it fresh).')
  process.exit(1)
}
const spec = await res.json()
mkdirSync(path.dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(spec, null, 1))
console.warn(`${repo}@${ref} → ${path.relative(process.cwd(), out)} (${Object.keys(spec.paths).length} paths)`)
