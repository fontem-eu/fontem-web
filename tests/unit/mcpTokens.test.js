/**
 * Connecting an external client.
 *
 * The token is shown exactly once. That is the property to protect: a
 * token you can re-read later is one an attacker can re-read later.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import McpTokensCard from '../../src/components/McpTokensCard.vue'
import * as api from '../../src/api/community.js'

const LIST = { tokens: [
  { id: 't1', label: 'Claude Desktop', created_at: '2026-08-01T00:00:00Z', last_used_at: null },
] }

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(api, 'listMcpTokens').mockResolvedValue(LIST)
  vi.spyOn(api, 'createMcpToken').mockResolvedValue({
    id: 't2', label: 'New', created_at: '2026-08-04T00:00:00Z',
    last_used_at: null, token: 'fontem_mcp_PLAINTEXT_ONCE',
  })
  vi.spyOn(api, 'revokeMcpToken').mockResolvedValue({})
})

const stubs = { RouterLink: { template: '<a><slot /></a>' } }

describe('McpTokensCard', () => {
  it('lists connected clients without exposing any token', async () => {
    const w = mount(McpTokensCard, { global: { stubs } })
    await flushPromises()
    expect(w.get('[data-testid="mcp-tokens-list"]').text()).toContain('Claude Desktop')
    expect(w.html()).not.toContain('fontem_mcp_')
  })

  it('shows a new token once, with the warning that it will not return', async () => {
    const w = mount(McpTokensCard, { global: { stubs } })
    await flushPromises()
    await w.get('[data-testid="mcp-token-create"]').trigger('submit')
    await flushPromises()
    const fresh = w.get('[data-testid="mcp-token-fresh"]')
    expect(w.get('[data-testid="mcp-token-value"]').text()).toBe('fontem_mcp_PLAINTEXT_ONCE')
    expect(fresh.text()).toMatch(/shown once/i)
  })

  it('dismissing removes the plaintext from the page', async () => {
    const w = mount(McpTokensCard, { global: { stubs } })
    await flushPromises()
    await w.get('[data-testid="mcp-token-create"]').trigger('submit')
    await flushPromises()
    await w.get('[data-testid="mcp-token-dismiss"]').trigger('click')
    await flushPromises()
    expect(w.html()).not.toContain('fontem_mcp_PLAINTEXT_ONCE')
  })

  it('revokes a client', async () => {
    const w = mount(McpTokensCard, { global: { stubs } })
    await flushPromises()
    await w.get('[data-testid="mcp-revoke-t1"]').trigger('click')
    await flushPromises()
    expect(api.revokeMcpToken).toHaveBeenCalledWith('t1')
  })

  it('says plainly when nothing is connected', async () => {
    vi.spyOn(api, 'listMcpTokens').mockResolvedValue({ tokens: [] })
    const w = mount(McpTokensCard, { global: { stubs } })
    await flushPromises()
    expect(w.get('[data-testid="mcp-tokens-empty"]').text()).toMatch(/no clients connected/i)
  })
})
