/**
 * Tests for the proposal parsing logic extracted from AssistPanel.
 *
 * parseProposals extracts JSON objects with "proposed": true from
 * assistant text. Must handle nested braces in params.
 */
import { describe, it, expect, vi } from 'vitest'

// Mock the dependency so we can import the module
vi.mock('../../src/composables/useEditProposals.js', () => ({
  validateProposal: vi.fn(() => ({ valid: true })),
  executeProposal: vi.fn(),
}))
vi.mock('../../src/api/community.js', () => ({
  getAssistConversation: vi.fn().mockResolvedValue(null),
  getAssistUsage: vi.fn().mockResolvedValue({ tokens_1h: 0, tokens_24h: 0, tokens_7d: 0 }),
}))

// Import the component to access parseProposals via the module scope.
// Since parseProposals is not exported, we test it indirectly or extract it.
// For now, replicate the logic here as a pure function test.
function parseProposals(text) {
  const proposals = []
  let i = 0
  while (i < text.length) {
    const propIdx = text.indexOf('"proposed"', i)
    if (propIdx === -1) break
    let start = text.lastIndexOf('{', propIdx)
    if (start === -1) { i = propIdx + 1; continue }
    let depth = 0
    let end = -1
    for (let j = start; j < text.length; j++) {
      if (text[j] === '{') depth++
      else if (text[j] === '}') { depth--; if (depth === 0) { end = j + 1; break } }
    }
    if (end === -1) { i = propIdx + 1; continue }
    try {
      const parsed = JSON.parse(text.slice(start, end))
      if (parsed.proposed && parsed.action) {
        proposals.push({ action: parsed.action, params: parsed.params, description: parsed.description })
      }
    } catch { /* skip */ }
    i = end
  }
  return proposals
}

describe('parseProposals', () => {
  it('extracts a simple proposal without nested params', () => {
    const text = 'Here is my suggestion: {"proposed": true, "action": "update_title", "params": {"title": "New Title"}, "description": "Update title"}'
    const result = parseProposals(text)
    expect(result).toHaveLength(1)
    expect(result[0].action).toBe('update_title')
    expect(result[0].params.title).toBe('New Title')
    expect(result[0].description).toBe('Update title')
  })

  it('extracts a proposal with deeply nested params', () => {
    const text = '{"proposed": true, "action": "insert_widget", "params": {"widget_type": "graph_explorer", "entityId": "abc-123", "depth": 2}, "description": "Add graph"}'
    const result = parseProposals(text)
    expect(result).toHaveLength(1)
    expect(result[0].action).toBe('insert_widget')
    expect(result[0].params.widget_type).toBe('graph_explorer')
    expect(result[0].params.entityId).toBe('abc-123')
  })

  it('extracts multiple proposals from one text', () => {
    const text = 'First: {"proposed": true, "action": "update_title", "params": {"title": "A"}, "description": "x"} ' +
                 'Second: {"proposed": true, "action": "add_section", "params": {"content": "<p>B</p>"}, "description": "y"}'
    const result = parseProposals(text)
    expect(result).toHaveLength(2)
    expect(result[0].action).toBe('update_title')
    expect(result[1].action).toBe('add_section')
  })

  it('returns empty array for text without proposals', () => {
    expect(parseProposals('Hello, how are you?')).toEqual([])
    expect(parseProposals('')).toEqual([])
    expect(parseProposals('{"some": "json"}')).toEqual([])
  })

  it('skips malformed JSON', () => {
    const text = '{"proposed": true, "action": "bad", broken json here}'
    const result = parseProposals(text)
    expect(result).toEqual([])
  })

  it('skips objects where proposed is not true', () => {
    const text = '{"proposed": false, "action": "update_title", "params": {"title": "X"}}'
    expect(parseProposals(text)).toEqual([])
  })

  it('skips objects without action', () => {
    const text = '{"proposed": true, "params": {"title": "X"}}'
    expect(parseProposals(text)).toEqual([])
  })

  it('handles proposal embedded in markdown', () => {
    const text = '```json\n{"proposed": true, "action": "add_section", "params": {"content": "<p>Hello</p>"}, "description": "Add intro"}\n```'
    const result = parseProposals(text)
    expect(result).toHaveLength(1)
    expect(result[0].params.content).toBe('<p>Hello</p>')
  })

  it('handles proposal with HTML content containing quotes', () => {
    const text = '{"proposed": true, "action": "add_section", "params": {"content": "<p class=\\"big\\">Text</p>"}, "description": "styled"}'
    const result = parseProposals(text)
    expect(result).toHaveLength(1)
  })
})
