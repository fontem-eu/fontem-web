import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({ myReviews: vi.fn() }))

import MyReviewsView from '../../src/views/MyReviewsView.vue'
import { myReviews } from '../../src/api/community.js'

// Most recently active first, as the API returns them.
const review = (i) => ({
  id: `r${i}`, report_id: 's1', report_title: `Story ${i}`, kind: 'article', state: 'open',
  mine: true, changes: {}, updated_at: `2026-10-09T13:${String(59 - i).padStart(2, '0')}:00+00:00`,
})
const range = (a, b) => Array.from({ length: b - a }, (_, k) => review(a + k))

async function mountView() {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/my-reviews', component: MyReviewsView },
    { path: '/stories/:id/reviews/:rid', component: { template: '<div />' } }] })
  await router.push('/my-reviews'); await router.isReady()
  const w = mount(MyReviewsView, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises()
  return w
}

describe('MyReviewsView — thirty at a time', () => {
  beforeEach(() => myReviews.mockReset())
  const rows = (w) => w.findAll('[data-testid="my-review-row"]')
  const more = (w) => w.find('[data-testid="my-reviews-show-more"]')

  it('shows the first thirty and a Show more that fetches the next page', async () => {
    myReviews.mockResolvedValueOnce(range(0, 30)).mockResolvedValueOnce(range(30, 33))
    const w = await mountView()
    expect(rows(w)).toHaveLength(30)
    await more(w).trigger('click'); await flushPromises()
    expect(myReviews).toHaveBeenLastCalledWith({ before: `${review(29).updated_at}|r29` })
    expect(rows(w)).toHaveLength(33)
    expect(more(w).exists()).toBe(false)
  })

  it('has no Show more when the first page is the whole list', async () => {
    myReviews.mockResolvedValueOnce(range(0, 2))
    const w = await mountView()
    expect(rows(w)).toHaveLength(2)
    expect(more(w).exists()).toBe(false)
  })

  it('hides Show more when a full page brings nothing new', async () => {
    myReviews.mockResolvedValueOnce(range(0, 30)).mockResolvedValueOnce(range(0, 30))
    const w = await mountView()
    await more(w).trigger('click'); await flushPromises()
    expect(rows(w)).toHaveLength(30)
    expect(more(w).exists()).toBe(false)
  })
})
