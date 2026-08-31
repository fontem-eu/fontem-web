/**
 * The history panel is how an author discovers that the published text
 * is not what they left — and how they get back. Both halves are worth
 * pinning: what it shows, and that restoring never rewrites the chain.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'
import * as communityApi from '../../src/api/community.js'
import RevisionHistory from '../../src/components/RevisionHistory.vue'

const REVISIONS = [
  {
    id: 'rev-3',
    parent_id: 'rev-2',
    author_kind: 'assistant',
    created_at: '2026-08-30T09:00:00Z',
    changes: { added: 2, changed: 1, removed: 0 },
    published_by: null,
    reviews: [{ id: 'review-open', kind: 'change', title: 'Tighten the lead', state: 'open' }],
  },
  {
    id: 'rev-2',
    parent_id: 'rev-1',
    author_kind: 'human',
    created_at: '2026-08-30T08:00:00Z',
    changes: { added: 0, changed: 1, removed: 0 },
    published_by: {
      id: 'review-merged', kind: 'change', title: 'First pass',
      state: 'merged', self_merged: true,
    },
    reviews: [],
  },
]

const DIFF = {
  from: 'rev-2',
  to: 'rev-3',
  operations: [
    { op: 'equal', before: { text: 'Intro', label: 'paragraph' }, after: { text: 'Intro', label: 'paragraph' } },
    { op: 'replace', before: { text: 'old line', label: 'paragraph' }, after: { text: 'new line', label: 'paragraph' } },
    { op: 'insert', before: null, after: { text: 'added line', label: 'paragraph' } },
    { op: 'delete', before: { text: 'dropped line', label: 'paragraph' }, after: null },
  ],
}

function mountHistory(open = true) {
  // A router, because a history row links straight to the conversation
  // about that change.
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/stories/:id/reviews/:reviewId', component: { template: '<div/>' } },
    ],
  })
  return mount(RevisionHistory, {
    props: { reportId: 'r1', open },
    global: { plugins: [router, makeTestI18n()] },
  })
}

describe('RevisionHistory', () => {
  beforeEach(() => {
    vi.spyOn(communityApi, 'listRevisions').mockResolvedValue(REVISIONS)
    vi.spyOn(communityApi, 'diffRevisions').mockResolvedValue(DIFF)
    vi.spyOn(communityApi, 'restoreRevision').mockResolvedValue({ ok: true, revision: 'rev-4' })
  })
  afterEach(() => vi.restoreAllMocks())

  it('lists the revisions newest first with what each changed', async () => {
    const w = mountHistory()
    await flushPromises()
    const rows = w.findAll('[data-testid="history-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('2 added')
    expect(rows[0].text()).toContain('1 changed')
  })

  it('marks an assistant revision as one, so it can be told apart', async () => {
    const w = mountHistory()
    await flushPromises()
    const badges = w.findAll('[data-testid="history-assistant"]')
    expect(badges).toHaveLength(1)
    expect(w.findAll('[data-testid="history-row"]')[0].text()).toContain('assistant')
  })

  it('shows the selected revision as added, removed and rewritten blocks', async () => {
    const w = mountHistory()
    await flushPromises()
    const blocks = w.findAll('[data-testid="diff-block"]')
    expect(blocks.map((b) => b.attributes('data-op')))
      .toEqual(['equal', 'replace', 'insert', 'delete'])
    // A rewrite shows both sides — that is the point of reviewing it.
    expect(blocks[1].text()).toContain('old line')
    expect(blocks[1].text()).toContain('new line')
  })

  it('loads the diff for whichever revision is picked', async () => {
    const w = mountHistory()
    await flushPromises()
    communityApi.diffRevisions.mockClear()
    await w.findAll('[data-testid="history-pick"]')[1].trigger('click')
    await flushPromises()
    expect(communityApi.diffRevisions).toHaveBeenCalledWith('r1', null, 'rev-2')
  })

  it('restores through the API and reloads, never rewriting the chain', async () => {
    const w = mountHistory()
    await flushPromises()
    communityApi.listRevisions.mockClear()

    await w.findAll('[data-testid="history-restore"]')[1].trigger('click')
    await flushPromises()

    expect(communityApi.restoreRevision).toHaveBeenCalledWith('r1', 'rev-2')
    // The panel re-reads: a restore is a new revision, so the list grew.
    expect(communityApi.listRevisions).toHaveBeenCalled()
    expect(w.emitted().restored[0]).toEqual(['rev-4'])
  })

  it('says so plainly when there is no history yet', async () => {
    communityApi.listRevisions.mockResolvedValue([])
    const w = mountHistory()
    await flushPromises()
    expect(w.find('[data-testid="history-empty"]').exists()).toBe(true)
  })

  it('surfaces a failure instead of rendering an empty panel', async () => {
    communityApi.listRevisions.mockRejectedValue(new Error('HTTP 500: nope'))
    const w = mountHistory()
    await flushPromises()
    expect(w.find('[data-testid="history-error"]').text()).toContain('500')
  })

  it('fetches nothing until it is opened', async () => {
    mountHistory(false)
    await flushPromises()
    expect(communityApi.listRevisions).not.toHaveBeenCalled()
  })
})

describe('RevisionHistory — the reviews behind each change', () => {
  beforeEach(() => {
    vi.spyOn(communityApi, 'listRevisions').mockResolvedValue(REVISIONS)
    vi.spyOn(communityApi, 'diffRevisions').mockResolvedValue(DIFF)
  })
  afterEach(() => vi.restoreAllMocks())

  it('names the review that published a change', async () => {
    const w = mountHistory()
    await flushPromises()
    const rows = w.findAll('[data-testid="history-row"]')
    expect(rows[1].find('[data-testid="history-published-by"]').text())
      .toContain('First pass')
    // Self-merged: the record says nobody else read it.
    expect(rows[1].text()).toContain('no second reader')
  })

  it('shows a change that is still under review as such', async () => {
    const w = mountHistory()
    await flushPromises()
    const rows = w.findAll('[data-testid="history-row"]')
    const open = rows[0].find('[data-testid="history-open-review"]')
    expect(open.text()).toContain('Tighten the lead')
    expect(open.text()).toContain('open')
  })

  it('links straight to the conversation', async () => {
    const w = mountHistory()
    await flushPromises()
    const links = w.findAll('[data-testid="history-review-link"]')
    expect(links).toHaveLength(2)
    expect(links[0].attributes('href')).toContain('/reviews/review-open')
    expect(links[1].attributes('href')).toContain('/reviews/review-merged')
  })
})
