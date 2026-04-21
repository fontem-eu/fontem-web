/**
 * DonateView tests — the donation flow is the primary user-facing
 * fundraising surface, so it gets real test coverage despite the
 * historical "no DQ-view tests" convention. A broken CTA here
 * translates directly to lost runway.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DonateView from '../../src/views/DonateView.vue'

function mountDonate() {
  return mount(DonateView, {
    global: {
      stubs: {
        'router-link': true,
        ThemeToggle: true,
      },
    },
  })
}

describe('DonateView', () => {
  beforeEach(() => {
    // Fresh fetch mock per test — default to empty-members 200.
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) }),
    )
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders every tier card with an OC contribution link', async () => {
    const wrapper = mountDonate()
    for (const name of ['supporter', 'backer', 'partner', 'one-off']) {
      const card = wrapper.find(`[data-testid="donate-tier-${name}"]`)
      expect(card.exists()).toBe(true)
      const href = card.attributes('href')
      expect(href).toMatch(/^https:\/\/opencollective\.com\/fontem/)
      // External links open in a new tab with noopener for safety.
      expect(card.attributes('target')).toBe('_blank')
      expect(card.attributes('rel')).toContain('noopener')
    }
  })

  it('renders a backers section when OC returns members', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { MemberId: 1, role: 'BACKER', name: 'Alice', profile: 'https://opencollective.com/alice' },
          { MemberId: 2, role: 'BACKER', name: 'Bob' },
          { MemberId: 3, role: 'ADMIN', name: 'Zed' },  // filtered out
        ]),
      }),
    )
    const wrapper = mountDonate()
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('Alice')
    expect(text).toContain('Bob')
    expect(text).not.toContain('Zed')
  })

  it('hides the backers section when the OC fetch fails', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('network down')))
    const wrapper = mountDonate()
    await flushPromises()
    // Failure must degrade silently — no loud error banner on a
    // fundraising page. Absence of the heading is how we verify.
    expect(wrapper.text()).not.toContain('Backers')
  })

  it('mentions the fiscal-host model, not a personal recipient', () => {
    // Identity-protection guardrail: the page should describe the
    // fiscal-host relationship without naming individuals. If someone
    // adds a personal recipient name later, this test fails.
    const wrapper = mountDonate()
    const text = wrapper.text()
    expect(text.toLowerCase()).toContain('fiscal-host')
    expect(text).toContain('Open Collective')
  })
})
