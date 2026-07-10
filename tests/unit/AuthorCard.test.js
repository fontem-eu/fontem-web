/**
 * AuthorCard — author avatar (photo/initials), name (→ profile), summary, links.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'
import AuthorCard from '../../src/components/AuthorCard.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/users/:id', component: { template: '<div />' } },
    ],
  })
}

async function mountCard(author) {
  const router = makeRouter()
  await router.push('/')
  await router.isReady()
  return mount(AuthorCard, {
    props: { author, userId: 'u1' },
    global: { plugins: [router, makeTestI18n()] },
  })
}

describe('AuthorCard', () => {
  it('renders name (→ profile), summary, links, and initials when no photo', async () => {
    const w = await mountCard({
      name: 'Bernardo Marques',
      avatar_url: null,
      summary: 'Follows the money.',
      links: [{ name: 'Site', url: 'https://s.io' }],
    })
    expect(w.find('[data-testid="author-card-name"]').text()).toBe('Bernardo Marques')
    expect(w.find('[data-testid="author-card-name"]').attributes('href')).toContain('/users/u1')
    expect(w.find('[data-testid="author-card-summary"]').text()).toContain('Follows the money.')
    expect(w.find('[data-testid="author-card-links"]').text()).toContain('Site')
    expect(w.find('[data-testid="author-card-links"] a').attributes('href')).toBe('https://s.io')
    // no photo → initials from UserAvatar
    expect(w.find('[data-testid="user-avatar-initials"]').text()).toBe('BM')
  })

  it('omits summary/links when absent', async () => {
    const w = await mountCard({ name: 'Solo', avatar_url: null, summary: '', links: [] })
    expect(w.find('[data-testid="author-card-summary"]').exists()).toBe(false)
    expect(w.find('[data-testid="author-card-links"]').exists()).toBe(false)
  })
})
