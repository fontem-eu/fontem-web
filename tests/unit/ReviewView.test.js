/**
 * The review screen, in both kinds.
 *
 * A change review is read as an inline diff and published from here; an
 * article review is the same screen with the article's blocks and no
 * publish button. What both must get right is the conversation: a
 * comment belongs to a block, and a block you commented on shows it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'
import * as communityApi from '../../src/api/community.js'
import ReviewView from '../../src/views/ReviewView.vue'

const CHANGE_REVIEW = {
  id: 'rev-1',
  report_id: 'r1',
  kind: 'change',
  title: 'Proposed changes',
  state: 'open',
  behind: 0,
  can_publish: true,
  reviewers: [],
  comments: [],
  changes: { added: 1, changed: 1, removed: 0 },
  operations: [
    { op: 'equal', before: { text: 'Intro', label: 'paragraph' }, after: { text: 'Intro', label: 'paragraph' } },
    { op: 'replace', before: { text: 'old lead', label: 'paragraph' }, after: { text: 'new lead', label: 'paragraph' } },
    { op: 'insert', before: null, after: { text: 'added para', label: 'paragraph' } },
  ],
}

const ARTICLE_REVIEW = {
  id: 'rev-2',
  report_id: 'r1',
  kind: 'article',
  title: 'Read-through',
  state: 'open',
  behind: 0,
  can_publish: false,
  reviewers: [],
  comments: [],
  changes: {},
  blocks: [
    { text: 'The lead paragraph.', label: 'paragraph', type: 'paragraph' },
    { text: 'The second one.', label: 'paragraph', type: 'paragraph' },
  ],
}

async function mountReview(review = CHANGE_REVIEW) {
  vi.spyOn(communityApi, 'getReview').mockResolvedValue(review)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/stories/:id/reviews/:reviewId', component: ReviewView },
      { path: '/stories/:id', component: { template: '<div/>' } },
      { path: '/stories/:id/edit', component: { template: '<div/>' } },
    ],
  })
  await router.push(`/stories/r1/reviews/${review.id}`)
  await router.isReady()
  const wrapper = mount(ReviewView, {
    global: { plugins: [router, makeTestI18n()] },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('ReviewView', () => {
  beforeEach(() => {
    vi.spyOn(communityApi, 'commentOnReview').mockResolvedValue({ id: 'c1' })
    vi.spyOn(communityApi, 'resolveReviewComment').mockResolvedValue({ resolved: true })
    vi.spyOn(communityApi, 'publishReview').mockResolvedValue({ state: 'merged' })
    vi.spyOn(communityApi, 'closeReview').mockResolvedValue({ state: 'closed' })
    vi.spyOn(communityApi, 'inviteReviewer').mockResolvedValue({ reviewers: ['u2'] })
  })
  afterEach(() => vi.restoreAllMocks())

  it('reads a change as an inline diff, one column', async () => {
    const { wrapper } = await mountReview()
    const rows = wrapper.findAll('[data-testid="review-row"]')
    expect(rows.map((r) => r.attributes('data-op')))
      .toEqual(['equal', 'replace', 'insert'])
    // A rewrite shows both sides in the same column — side by side on a
    // phone is two unreadable columns.
    expect(rows[1].text()).toContain('old lead')
    expect(rows[1].text()).toContain('new lead')
  })

  it('publishes a change review', async () => {
    const { wrapper } = await mountReview()
    await wrapper.find('[data-testid="review-publish"]').trigger('click')
    await flushPromises()
    expect(communityApi.publishReview).toHaveBeenCalledWith('r1', 'rev-1')
  })

  it('will not offer to publish a proposal that fell behind', async () => {
    const { wrapper } = await mountReview({
      ...CHANGE_REVIEW, behind: 2, can_publish: false,
    })
    expect(wrapper.find('[data-testid="review-behind"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="review-publish"]').attributes('disabled'))
      .toBeDefined()
  })

  it('says so when the text moved on mid-review, without overwriting', async () => {
    const { wrapper } = await mountReview()
    const conflict = new Error('HTTP 409')
    conflict.status = 409
    communityApi.publishReview.mockRejectedValueOnce(conflict)

    await wrapper.find('[data-testid="review-publish"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="review-error"]').text()).toContain('moved on')
  })

  it('shows an article review as blocks, with nothing to publish', async () => {
    const { wrapper } = await mountReview(ARTICLE_REVIEW)
    const rows = wrapper.findAll('[data-testid="review-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('The lead paragraph.')
    expect(wrapper.find('[data-testid="review-publish"]').exists()).toBe(false)
  })

  it('posts a comment anchored to the block it is about', async () => {
    const { wrapper } = await mountReview(ARTICLE_REVIEW)
    await wrapper.findAll('[data-testid="review-add-comment"]')[1].trigger('click')
    await wrapper.find('[data-testid="review-comment-input"]')
      .setValue('This buries the number.')
    await wrapper.find('[data-testid="review-comment-submit"]').trigger('click')
    await flushPromises()

    const [reportId, reviewId, body, anchor] =
      communityApi.commentOnReview.mock.calls[0]
    expect([reportId, reviewId, body])
      .toEqual(['r1', 'rev-2', 'This buries the number.'])
    // Anchored by content, so it stays with its paragraph when something
    // above it is edited.
    expect(anchor).toContain('The second one.')
  })

  it('shows existing comments against their block, and resolves them', async () => {
    const withComment = {
      ...ARTICLE_REVIEW,
      comments: [{
        id: 'c1',
        author_id: 'u1',
        anchor: 'paragraph The lead paragraph.',
        body: 'Too long.',
        resolved: false,
      }],
    }
    const { wrapper } = await mountReview(withComment)
    const rows = wrapper.findAll('[data-testid="review-row"]')
    expect(rows[0].text()).toContain('Too long.')
    expect(rows[1].text()).not.toContain('Too long.')

    await wrapper.find('[data-testid="review-comment-resolve"]').trigger('click')
    await flushPromises()
    expect(communityApi.resolveReviewComment)
      .toHaveBeenCalledWith('r1', 'rev-2', 'c1')
  })

  it('invites a reviewer', async () => {
    const { wrapper } = await mountReview()
    await wrapper.find('[data-testid="review-invite-input"]').setValue('user-2')
    await wrapper.find('[data-testid="review-invite"]').trigger('click')
    await flushPromises()
    expect(communityApi.inviteReviewer).toHaveBeenCalledWith('r1', 'rev-1', 'user-2')
  })

  it('marks an article read as done rather than withdrawing it', async () => {
    const { wrapper } = await mountReview(ARTICLE_REVIEW)
    await wrapper.find('[data-testid="review-finish"]').trigger('click')
    await flushPromises()
    expect(communityApi.closeReview).toHaveBeenCalledWith('r1', 'rev-2', 'completed')
  })
})

describe('ReviewView — widgets are reviewed, not described', () => {
  /**
   * A widget block carries no text. Rendering its label
   * ("widget:graph_explorer:00d87075") shows a reviewer a description of
   * the thing rather than the thing, which is not reviewing it.
   */
  const WIDGET_REVIEW = {
    ...ARTICLE_REVIEW,
    blocks: [
      { type: 'paragraph', label: 'paragraph', text: 'Prose above.' },
      {
        type: 'widget',
        label: 'widget:graph_explorer:e-1',
        text: '',
        attrs: { widget_type: 'graph_explorer', entityId: 'e-1', depth: 2 },
      },
    ],
  }

  beforeEach(() => {
    vi.spyOn(communityApi, 'commentOnReview').mockResolvedValue({ id: 'c1' })
  })
  afterEach(() => vi.restoreAllMocks())

  it('mounts the real widget instead of printing its label', async () => {
    const { wrapper } = await mountReview(WIDGET_REVIEW)
    const rows = wrapper.findAll('[data-testid="review-row"]')
    expect(rows[1].find('[data-testid="review-widget"]').exists()).toBe(true)
    expect(rows[1].text()).not.toContain('widget:graph_explorer')
  })

  it('renders both sides of a widget that changed', async () => {
    const changed = {
      ...CHANGE_REVIEW,
      operations: [{
        op: 'replace',
        before: {
          type: 'widget', label: 'widget:contracts_table:old', text: '',
          attrs: { widget_type: 'contracts_table', entityId: 'old' },
        },
        after: {
          type: 'widget', label: 'widget:contracts_table:new', text: '',
          attrs: { widget_type: 'contracts_table', entityId: 'new' },
        },
      }],
    }
    const { wrapper } = await mountReview(changed)
    // Both the removed and the added widget render: a reviewer compares
    // the things, not two identifiers.
    expect(wrapper.findAll('[data-testid="review-widget"]')).toHaveLength(2)
  })

  it('still renders prose as prose', async () => {
    const { wrapper } = await mountReview(WIDGET_REVIEW)
    const rows = wrapper.findAll('[data-testid="review-row"]')
    expect(rows[0].text()).toContain('Prose above.')
    expect(rows[0].find('[data-testid="review-widget"]').exists()).toBe(false)
  })
})
