/**
 * Consumer pact: the AI assistant surface.
 *
 * This is the highest-value contract in the app. The turn request carries
 * flags the server uses to SCOPE THE TOOL ARRAY — `has_editor` decides
 * whether propose_edit is offered at all, and omitting it once produced a
 * model that narrated edits it had never been given a tool to make. A pact
 * pins that request shape so the field cannot silently disappear.
 *
 * It also pins the tool NAMES that come back in the stream
 * (`mcp__gmr__set_title` …). Those names are duplicated in
 * fontem-community-api/src/assistant/doc_tools.py (PROPOSAL_TOOL_ACTIONS)
 * and in src/composables/useEditProposals.js — a cross-repo coupling that
 * until now was checked by grepping the sibling repo's source off disk,
 * which skips entirely in CI. The pact is the proper home for it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MatchersV3 } from '@pact-foundation/pact'
import { _internal } from '../../src/api/session.js'
import {
  streamRequest,
  listAssistConversations,
  getAssistConversation,
  getAssistConversationPage,
  listAssistantModels,
  chooseAssistantModel,
} from '../../src/api/community.js'
import { PROPOSAL_TOOL_ACTIONS } from '../../src/composables/useEditProposals.js'
import { makePact, routeCapiTo, restoreFetch } from './support/pactHarness.js'

const { like, eachLike, regex, boolean } = MatchersV3

const pact = makePact()

// A conversation key is `report:<uuid>` while editing, `global` otherwise —
// the colon must survive encoding, so pin a report-scoped key.
const CONV_KEY = 'report:6f9a2b1c-3d4e-5f60-8a9b-0c1d2e3f4a5b'

// One SSE frame per line, exactly as AssistPanel's reader consumes it.
const STREAM_BODY = [
  'data: {"type":"text","text":"Looking at the contract values…"}',
  'data: {"type":"tool_use","id":"tu-1","name":"mcp__gmr__set_title",'
    + '"input":{"title":"Water quality in the Tagus"}}',
  'data: {"type":"tool_result","tool_use_id":"tu-1","ok":true}',
  'data: {"type":"done"}',
  '',
].join('\n')

beforeEach(() => { _internal.clearForTests() })
afterEach(() => { restoreFetch(); _internal.clearForTests() })

describe('assistant turn', () => {
  it('sends the editor-scoped turn that unlocks the propose_edit tool', () =>
    pact
      .addInteraction()
      .given('the user is authenticated with an open report editor')
      .uponReceiving('an assistant turn with an editor present')
      .withRequest('POST', '/assist/chat/stream', (b) =>
        b
          .query({ lang: 'en' })
          .headers({
            'Content-Type': 'application/json',
            Authorization: regex(/^Bearer .+/, 'Bearer pact-token'),
          })
          .jsonBody({
            message: like('summarise the contract values'),
            conversation_key: like(CONV_KEY),
            // Load-bearing: the server scopes propose_edit out unless true.
            has_editor: boolean(true),
            context_block: like('# Water quality\n\nDraft body.'),
            nav: {
              current: like('/stories/6f9a2b1c-3d4e-5f60-8a9b-0c1d2e3f4a5b/edit'),
              title: like('Water quality — Fontem'),
              routes: eachLike({ path: like('/spending'), description: like('EU procurement') }),
            },
          }))
      .willRespondWith(200, (b) =>
        b
          .headers({ 'Content-Type': 'text/event-stream' })
          .body('text/event-stream', Buffer.from(STREAM_BODY)))
      .executeTest(async (mock) => {
        routeCapiTo(mock.url)
        _internal.setAccessToken('pact-token')
        const res = await streamRequest('/assist/chat/stream', {
          message: 'summarise the contract values',
          conversation_key: CONV_KEY,
          has_editor: true,
          context_block: '# Water quality\n\nDraft body.',
          nav: {
            current: '/stories/6f9a2b1c-3d4e-5f60-8a9b-0c1d2e3f4a5b/edit',
            title: 'Water quality — Fontem',
            routes: [{ path: '/spending', description: 'EU procurement' }],
          },
        })
        expect(res.ok).toBe(true)
        const text = await res.text()
        // The tool names the panel matches tool_result cards against.
        expect(text).toContain('mcp__gmr__set_title')
        expect(Object.keys(PROPOSAL_TOOL_ACTIONS)).toContain('mcp__gmr__set_title')
      }))
})

describe('assistant conversations', () => {
  it('lists conversations', () =>
    pact
      .addInteraction()
      .given('the user is authenticated')
      .uponReceiving('a request for the conversation list')
      .withRequest('GET', '/assist/conversations', (b) =>
        b.query({ lang: 'en' })
          .headers({ Authorization: regex(/^Bearer .+/, 'Bearer pact-token') }))
      .willRespondWith(200, (b) =>
        b.jsonBody({
          conversations: eachLike({
            conversation_key: like(CONV_KEY),
            title: like('Water quality'),
            updated_at: like('2026-08-30T09:00:00Z'),
          }),
        }))
      .executeTest(async (mock) => {
        routeCapiTo(mock.url)
        _internal.setAccessToken('pact-token')
        const r = await listAssistConversations()
        expect(r.conversations[0].conversation_key).toBeTruthy()
      }))

  it('fetches one conversation by its report-scoped key', () =>
    pact
      .addInteraction()
      .given('the user is authenticated with an existing conversation')
      .uponReceiving('a request for one conversation')
      // The colon in `report:<uuid>` is percent-encoded by the client.
      .withRequest('GET', `/assist/conversations/${encodeURIComponent(CONV_KEY)}`, (b) =>
        b.query({ lang: 'en' })
          .headers({ Authorization: regex(/^Bearer .+/, 'Bearer pact-token') }))
      .willRespondWith(200, (b) =>
        b.jsonBody({
          conversation_key: like(CONV_KEY),
          messages: eachLike({ role: like('user'), content: like('hello') }),
        }))
      .executeTest(async (mock) => {
        routeCapiTo(mock.url)
        _internal.setAccessToken('pact-token')
        const r = await getAssistConversation(CONV_KEY)
        expect(r.conversation_key).toBeTruthy()
      }))

  it('pages back through a conversation', () =>
    pact
      .addInteraction()
      .given('the user is authenticated with a long conversation')
      .uponReceiving('a request for an older page of messages')
      .withRequest('GET', `/assist/conversations/${encodeURIComponent(CONV_KEY)}/messages`, (b) =>
        b.query({ before: 'msg-40', limit: '30', lang: 'en' })
          .headers({ Authorization: regex(/^Bearer .+/, 'Bearer pact-token') }))
      .willRespondWith(200, (b) =>
        b.jsonBody({
          messages: eachLike({ id: like('msg-39'), role: like('assistant'), content: like('…') }),
          has_more: boolean(true),
        }))
      .executeTest(async (mock) => {
        routeCapiTo(mock.url)
        _internal.setAccessToken('pact-token')
        const r = await getAssistConversationPage(CONV_KEY, { before: 'msg-40' })
        expect(Array.isArray(r.messages)).toBe(true)
      }))
})

describe('assistant model selection', () => {
  it('lists the available models', () =>
    pact
      .addInteraction()
      .given('the user is authenticated')
      .uponReceiving('a request for the assistant model list')
      .withRequest('GET', '/assist/models', (b) =>
        b.query({ lang: 'en' })
          .headers({ Authorization: regex(/^Bearer .+/, 'Bearer pact-token') }))
      .willRespondWith(200, (b) =>
        b.jsonBody({
          models: eachLike({ id: like('claude-sonnet-4'), label: like('Claude Sonnet') }),
          selected: like('claude-sonnet-4'),
        }))
      .executeTest(async (mock) => {
        routeCapiTo(mock.url)
        _internal.setAccessToken('pact-token')
        const r = await listAssistantModels()
        expect(r.models[0].id).toBeTruthy()
      }))

  it('chooses a model', () =>
    pact
      .addInteraction()
      .given('the user is authenticated')
      .uponReceiving('a request to choose the assistant model')
      .withRequest('PUT', '/assist/models', (b) =>
        b
          .query({ lang: 'en' })
          .headers({
            'Content-Type': 'application/json',
            Authorization: regex(/^Bearer .+/, 'Bearer pact-token'),
          })
          .jsonBody({ model_id: like('claude-sonnet-4') }))
      .willRespondWith(200, (b) => b.jsonBody({ selected: like('claude-sonnet-4') }))
      .executeTest(async (mock) => {
        routeCapiTo(mock.url)
        _internal.setAccessToken('pact-token')
        const r = await chooseAssistantModel('claude-sonnet-4')
        expect(r.selected).toBeTruthy()
      }))
})
