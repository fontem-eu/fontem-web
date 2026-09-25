/**
 * A query proposal must show up as a real diff in a real CodeMirror — and
 * be accepted or rejected whole.
 *
 * Why this exists: every unit test of the Studio query view stubs the editor
 * with a <textarea>, because CodeMirror needs a layout pass jsdom cannot
 * give it. That stub can prove the view hands the editor a proposal; it
 * cannot prove the editor draws it, that the merge view grew no per-hunk
 * accept/reject buttons (which would quietly break the owner's all-or-
 * nothing rule), or that the swap into diff mode never reached the parent's
 * autosave. So this runs the built bundle in Chromium with the network
 * stubbed: sign in through the bootstrap seam, open the query, ask the
 * assistant, and let a canned stream propose a change.
 */
import { test, expect } from '@playwright/test'

const ORIGINAL = 'MATCH (c:Company)\nRETURN c.name AS name\nLIMIT 5'
const PROPOSED = 'MATCH (c:Company) RETURN count(c) AS companies'
const PROJECT = {
  id: 'p1', name: 'Proposals', created_by: 'u1', investigation_id: null,
  my_access: { level: 'owner', can_edit: true, can_delete: true, can_share: true },
  queries: [
    { id: 'q1', project_id: 'p1', name: 'Companies', lang: 'cypher', query: ORIGINAL },
    { id: 'q2', project_id: 'p1', name: 'Other', lang: 'cypher', query: 'MATCH (a:Authority) RETURN a.name LIMIT 5' },
  ],
  plots: [],
}
const USER = { id: 'u1', name: 'Tester', email: 'tester@example.test', email_verified: true }

// JWT-shaped, far-future exp. Nothing client-side decodes it; the API
// client only forwards it, and every call it rides on is stubbed below.
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const TOKEN = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', exp: 4102444800 })}.sig`

const TOOL = 'mcp__gmr__studio_propose_query'
const ARGS = { project_id: 'p1', query_id: 'q1', query: PROPOSED, explanation: 'Counts the companies instead of listing five.' }
const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
// The server announces the tool call (with the proposal, so the card can be
// drawn at once), then confirms it validated, then writes its prose.
const STREAM = [
  sse('status', { phase: 'tool_use', tool: TOOL, detail: 'Proposing a query', proposal: { ...ARGS, action: 'propose_query' } }),
  sse('tool_result', { tool: TOOL, args: ARGS, result: JSON.stringify({ proposed: true, action: 'propose_query', project_id: 'p1', query_id: 'q1', columns: ['companies'], warnings: [] }) }),
  sse('chunk', { text: 'I propose counting them instead.' }),
  sse('done', {}),
].join('')

// The model speaking twice in one turn: the second proposal replaces the
// first, and the diff the user sees must be against THEIR text — not
// against the first proposal, which is what the editor's document held
// while that one was on screen.
const PROPOSED_TWICE = 'MATCH (c:Company) RETURN count(DISTINCT c) AS companies'
const ARGS_TWICE = { ...ARGS, query: PROPOSED_TWICE, explanation: 'Distinct, in case of duplicates.' }
const STREAM_TWICE = [
  sse('status', { phase: 'tool_use', tool: TOOL, detail: 'Proposing a query', proposal: { ...ARGS, action: 'propose_query' } }),
  sse('tool_result', { tool: TOOL, args: ARGS, result: JSON.stringify({ proposed: true, action: 'propose_query', project_id: 'p1', query_id: 'q1', columns: ['companies'], warnings: [] }), bytes: 0, truncated: false, elapsed: 0.2 }),
  sse('status', { phase: 'tool_use', tool: TOOL, detail: 'Proposing a query', proposal: { ...ARGS_TWICE, action: 'propose_query' } }),
  sse('tool_result', { tool: TOOL, args: ARGS_TWICE, result: JSON.stringify({ proposed: true, action: 'propose_query', project_id: 'p1', query_id: 'q1', columns: ['companies'], warnings: [] }), bytes: 0, truncated: false, elapsed: 0.2 }),
  sse('chunk', { text: 'Second thoughts: distinct.' }),
  sse('done', {}),
].join('')

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/** Sign in through the bootstrap seam and stub every network call. */
async function setUp(page) {
  await page.addInitScript(({ token, user }) => {
    window.__FONTEM_BOOTSTRAP_TOKEN__ = token
    localStorage.setItem('fontem-user', JSON.stringify(user))
  }, { token: TOKEN, user: USER })

  const puts = []
  await page.route(/^https?:\/\/[^/]+\/capi\//, (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    if (path === '/capi/studio/projects' && req.method() === 'GET') return json(route, [PROJECT])
    if (path === '/capi/studio/projects/p1' && req.method() === 'GET') return json(route, PROJECT)
    if (path === '/capi/studio/projects/p1/queries/q1' && req.method() === 'PUT') {
      const body = req.postDataJSON()
      puts.push(body)
      return json(route, { ...PROJECT.queries[0], ...body })
    }
    if (path === '/capi/assist/models') return json(route, { models: [], selected: '', active: true })
    if (path === '/capi/assist/conversations') return json(route, { conversations: [], has_more: false })
    if (path.startsWith('/capi/assist/conversations/')) return json(route, { messages: [], has_more: false })
    if (path === '/capi/assist/chat/stream') {
      const twice = /twice/i.test(req.postDataJSON()?.message || '')
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: twice ? STREAM_TWICE : STREAM })
    }
    // Not a 401: that would send the client to /auth/refresh and then /login.
    return json(route, { detail: 'stubbed' }, 404)
  })
  await page.route(/^https?:\/\/[^/]+\/api\//, (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.startsWith('/api/query/schema/')) return json(route, { labels: [], relationships: [], tables: [], classes: [], predicates: [] })
    return json(route, { detail: 'stubbed' }, 404)
  })
  return puts
}

test.describe('Studio query proposals in a real editor', () => {
  test('a proposal is drawn as a diff with no per-hunk controls, and accepted whole', async ({ page }) => {
    const puts = await setUp(page)
    await page.goto('/studio/p/p1/q/q1')
    const editor = page.locator('[data-testid="query-editor"]')
    await expect(editor.locator('.cm-content')).toContainText('c.name')

    await page.getByTestId('assist-toggle').click()
    const input = page.getByTestId('assist-input')
    await input.fill('Count the companies instead')
    await page.getByTestId('assist-send').click()

    // Diff mode: the editor carries the proposal, shows what it drops, and
    // grew no accept/reject buttons of its own.
    await expect(page.locator('[data-testid="query-editor"][data-proposal="1"]')).toBeVisible()
    await expect(page.getByTestId('query-proposal')).toBeVisible()
    expect(await editor.locator('.cm-deletedChunk').count()).toBeGreaterThanOrEqual(1)
    await expect(editor.locator('.cm-chunkButtons')).toHaveCount(0)
    await expect(editor.locator('.cm-content')).toContainText('count(c)')
    // The assistant waits for the decision.
    await expect(input).toBeDisabled()
    // Nothing was written while the proposal was only on screen: the swap
    // into diff mode must not have reached the autosave.
    await page.waitForTimeout(800)
    expect(puts).toEqual([])

    await page.getByTestId('query-proposal-accept').click()
    await expect(page.locator('[data-testid="query-editor"][data-proposal="1"]')).toHaveCount(0)
    await expect(page.getByTestId('query-proposal')).toHaveCount(0)
    await expect(editor.locator('.cm-content')).toHaveText(PROPOSED)
    await expect(editor.locator('.cm-deletedChunk')).toHaveCount(0)
    await expect(input).toBeEnabled()
    await expect.poll(() => puts.length).toBe(1)
    expect(puts[0].query).toBe(PROPOSED)
    // The debounced autosave has nothing left to add.
    await page.waitForTimeout(800)
    expect(puts).toHaveLength(1)
  })

  test('a second proposal in the same turn is diffed against the user\'s text, not the first proposal', async ({ page }) => {
    const puts = await setUp(page)
    await page.goto('/studio/p/p1/q/q1')
    const editor = page.locator('[data-testid="query-editor"]')
    await expect(editor.locator('.cm-content')).toContainText('c.name')

    await page.getByTestId('assist-toggle').click()
    await page.getByTestId('assist-input').fill('Count the companies, twice')
    await page.getByTestId('assist-send').click()
    await expect(page.locator('[data-testid="query-editor"][data-proposal="1"]')).toBeVisible()
    // The document is the SECOND proposal; the deleted chunk is the user's
    // line, and nothing of the first proposal is anywhere in the editor.
    await expect(editor.locator('.cm-content')).toContainText('count(DISTINCT c)')
    await expect(editor.locator('.cm-deletedChunk')).toContainText('c.name')
    await expect(editor).not.toContainText('count(c) AS')
    // The first card says it was replaced; the bar decides on the second.
    await expect(page.getByTestId('proposal-superseded')).toHaveCount(1)
    await expect(page.getByTestId('query-proposal-explanation')).toContainText('Distinct')

    await page.getByTestId('query-proposal-accept').click()
    await expect(editor.locator('.cm-content')).toHaveText(PROPOSED_TWICE)
    await expect.poll(() => puts.length).toBe(1)
    expect(puts[0].query).toBe(PROPOSED_TWICE)
  })

  test('leaving the query and coming back through the lock notice redraws the diff, still read-only', async ({ page }) => {
    const puts = await setUp(page)
    await page.goto('/studio/p/p1/q/q1')
    const editor = page.locator('[data-testid="query-editor"]')
    await expect(editor.locator('.cm-content')).toContainText('c.name')

    await page.getByTestId('assist-toggle').click()
    await page.getByTestId('assist-input').fill('Count the companies instead')
    await page.getByTestId('assist-send').click()
    await expect(page.locator('[data-testid="query-editor"][data-proposal="1"]')).toBeVisible()

    // In-app navigation to another query of the project (a reload would
    // drop the in-memory proposal, which is a different, accepted fact).
    await page.getByTestId('assist-close').click()
    await page.locator('[data-testid="studio-nav-query"] .srow-label', { hasText: 'Other' }).click()
    await expect(page).toHaveURL(/\/studio\/p\/p1\/q\/q2$/)
    await expect(editor.locator('.cm-content')).toContainText('Authority')
    // Another query: no diff, no bar — but the assistant stays locked and
    // offers the way back.
    await expect(page.locator('[data-testid="query-editor"][data-proposal="1"]')).toHaveCount(0)
    await expect(page.getByTestId('query-proposal')).toHaveCount(0)
    await page.getByTestId('assist-toggle').click()
    await expect(page.getByTestId('assist-input')).toBeDisabled()
    await page.getByTestId('assist-locked-open').click()
    await expect(page).toHaveURL(/\/studio\/p\/p1\/q\/q1$/)

    // Back on the query: the editor was rebuilt, and the diff with it.
    await expect(page.locator('[data-testid="query-editor"][data-proposal="1"]')).toBeVisible()
    await expect(page.getByTestId('query-proposal')).toBeVisible()
    expect(await editor.locator('.cm-deletedChunk').count()).toBeGreaterThanOrEqual(1)
    await expect(editor.locator('.cm-content')).toContainText('count(c)')
    // Read-only while reviewing: typing does not land.
    await page.getByTestId('assist-close').click()
    await editor.locator('.cm-content').click()
    await page.keyboard.type('ZZZ')
    await expect(editor.locator('.cm-content')).not.toContainText('ZZZ')
    await page.waitForTimeout(800)
    expect(puts).toEqual([])
  })

  test('rejecting restores the user\'s text and writes nothing', async ({ page }) => {
    const puts = await setUp(page)
    await page.goto('/studio/p/p1/q/q1')
    const editor = page.locator('[data-testid="query-editor"]')
    await expect(editor.locator('.cm-content')).toContainText('c.name')

    await page.getByTestId('assist-toggle').click()
    await page.getByTestId('assist-input').fill('Count the companies instead')
    await page.getByTestId('assist-send').click()
    await expect(page.locator('[data-testid="query-editor"][data-proposal="1"]')).toBeVisible()

    await page.getByTestId('query-proposal-reject').click()
    await expect(page.locator('[data-testid="query-editor"][data-proposal="1"]')).toHaveCount(0)
    await expect(editor.locator('.cm-content')).toContainText('c.name')
    await expect(editor.locator('.cm-content')).not.toContainText('count(c)')
    await expect(page.getByTestId('assist-input')).toBeEnabled()
    await page.waitForTimeout(800)
    expect(puts).toEqual([])
  })
})
