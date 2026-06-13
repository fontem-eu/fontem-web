/**
 * Unit tests for FlowerButton — the Medium-style clap on stories.
 *
 * Mocks the community-api module so we never actually hit fetch; the
 * tests assert on optimistic update, rollback, the sign-in-disabled
 * state, and the 50-cap.
 */
import { _internal } from '../../src/api/session.js'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('../../src/api/community.js', () => ({
  getFlowers: vi.fn(),
  giveFlower: vi.fn(),
}))

import FlowerButton from '../../src/components/FlowerButton.vue'
import * as api from '../../src/api/community.js'

const REPORT_ID = '00000000-0000-4000-8000-000000000000'

function mountBtn(opts = {}) {
  return mount(FlowerButton, {
    props: { reportId: REPORT_ID, ...opts.props },
    ...opts,
  })
}

beforeEach(() => {
  _internal.clearForTests(); localStorage.clear()
  vi.clearAllMocks()
  api.getFlowers.mockResolvedValue({ total: 0, mine: 0, max_per_user: 50 })
  api.giveFlower.mockResolvedValue({ total: 1, mine: 1, max_per_user: 50 })
})
afterEach(() => {
  _internal.clearForTests(); localStorage.clear()
  vi.restoreAllMocks()
})

describe('FlowerButton — render + initial load', () => {
  it('renders the button + total + a lavender icon', async () => {
    const w = mountBtn()
    await flushPromises()
    expect(w.find('[data-testid="flower-button"]').exists()).toBe(true)
    expect(w.find('[data-testid="flower-count"]').text()).toBe('0')
    // Lavender bud cluster — at least one circle in the inline SVG.
    expect(w.find('svg circle').exists()).toBe(true)
  })

  it('loads server state on mount and renders total + mine when authed', async () => {
    _internal.setAccessToken('jwt')
    api.getFlowers.mockResolvedValueOnce({ total: 7, mine: 3, max_per_user: 50 })
    const w = mountBtn()
    await flushPromises()
    expect(api.getFlowers).toHaveBeenCalledWith(REPORT_ID)
    expect(w.find('[data-testid="flower-count"]').text()).toBe('7')
    expect(w.find('[data-testid="flower-mine"]').text()).toContain('3')
  })

  it('does not surface mine when 0 (clean idle state)', async () => {
    _internal.setAccessToken('jwt')
    api.getFlowers.mockResolvedValueOnce({ total: 7, mine: 0, max_per_user: 50 })
    const w = mountBtn()
    await flushPromises()
    expect(w.find('[data-testid="flower-mine"]').exists()).toBe(false)
  })

  it('survives a getFlowers failure without crashing', async () => {
    api.getFlowers.mockRejectedValueOnce(new Error('boom'))
    const w = mountBtn()
    await flushPromises()
    expect(w.find('[data-testid="flower-count"]').text()).toBe('0')
  })
})

describe('FlowerButton — auth gating', () => {
  it('is disabled when no token is present', async () => {
    const w = mountBtn()
    await flushPromises()
    const btn = w.find('[data-testid="flower-button"]')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('title')).toContain('Sign in')
  })

  it('clicking while signed-out does NOT call giveFlower', async () => {
    const w = mountBtn()
    await flushPromises()
    await w.find('[data-testid="flower-button"]').trigger('click')
    await flushPromises()
    expect(api.giveFlower).not.toHaveBeenCalled()
  })

  it('enables and clears the disabled tooltip once a token appears', async () => {
    _internal.setAccessToken('jwt')
    const w = mountBtn()
    await flushPromises()
    const btn = w.find('[data-testid="flower-button"]')
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(btn.attributes('title')).toContain('flower')
  })
})

describe('FlowerButton — give() flow', () => {
  it('optimistically bumps total and mine on click', async () => {
    _internal.setAccessToken('jwt')
    api.getFlowers.mockResolvedValueOnce({ total: 4, mine: 1, max_per_user: 50 })
    // Make the POST hang so the test can see the optimistic state.
    let resolveGive
    api.giveFlower.mockReturnValueOnce(new Promise((r) => { resolveGive = r }))

    const w = mountBtn()
    await flushPromises()
    await w.find('[data-testid="flower-button"]').trigger('click')
    // Optimistic increment is visible BEFORE the POST resolves.
    expect(w.find('[data-testid="flower-count"]').text()).toBe('5')
    expect(w.find('[data-testid="flower-mine"]').text()).toContain('2')
    expect(api.giveFlower).toHaveBeenCalledWith(REPORT_ID)

    // Let the POST resolve with an authoritative server value (a
    // concurrent clapper also gave one, so total is 6, mine is 2).
    resolveGive({ total: 6, mine: 2, max_per_user: 50 })
    await flushPromises()
    expect(w.find('[data-testid="flower-count"]').text()).toBe('6')
    expect(w.find('[data-testid="flower-mine"]').text()).toContain('2')
  })

  it('rolls back the optimistic update when the server rejects', async () => {
    _internal.setAccessToken('jwt')
    api.getFlowers.mockResolvedValueOnce({ total: 4, mine: 1, max_per_user: 50 })
    api.giveFlower.mockRejectedValueOnce(new Error('400'))
    const w = mountBtn()
    await flushPromises()
    await w.find('[data-testid="flower-button"]').trigger('click')
    await flushPromises()
    // Rollback happened — total is back at 4 and mine back at 1.
    expect(w.find('[data-testid="flower-count"]').text()).toBe('4')
    expect(w.find('[data-testid="flower-mine"]').text()).toContain('1')
  })

  it('disables the button at the 50-cap and tooltip reflects the limit', async () => {
    _internal.setAccessToken('jwt')
    api.getFlowers.mockResolvedValueOnce({ total: 50, mine: 50, max_per_user: 50 })
    const w = mountBtn()
    await flushPromises()
    const btn = w.find('[data-testid="flower-button"]')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('title')).toContain('50')
  })

  it('clicking at the cap does NOT call giveFlower', async () => {
    _internal.setAccessToken('jwt')
    api.getFlowers.mockResolvedValueOnce({ total: 50, mine: 50, max_per_user: 50 })
    const w = mountBtn()
    await flushPromises()
    await w.find('[data-testid="flower-button"]').trigger('click')
    await flushPromises()
    expect(api.giveFlower).not.toHaveBeenCalled()
  })
})

describe('FlowerButton — pulse + double-click guard + aria', () => {
  it('applies the just-given pulse class on click and clears it after the timer', async () => {
    vi.useFakeTimers()
    try {
      _internal.setAccessToken('jwt')
      const w = mountBtn()
      await flushPromises()
      await w.find('[data-testid="flower-button"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-testid="flower-button"]').classes()).toContain('flower-given')
      vi.advanceTimersByTime(1300)
      await flushPromises()
      expect(w.find('[data-testid="flower-button"]').classes()).not.toContain('flower-given')
    } finally {
      vi.useRealTimers()
    }
  })

  it('busy gate prevents a second click while the first POST is in flight', async () => {
    _internal.setAccessToken('jwt')
    api.giveFlower.mockImplementationOnce(() => new Promise(() => {}))
    const w = mountBtn()
    await flushPromises()
    const btn = w.find('[data-testid="flower-button"]')
    await btn.trigger('click')
    await btn.trigger('click')
    await flushPromises()
    expect(api.giveFlower).toHaveBeenCalledTimes(1)
  })

  it('confirmedMine gates capReached — optimistic 50th does NOT flash cap state', async () => {
    _internal.setAccessToken('jwt')
    api.getFlowers.mockResolvedValueOnce({ total: 49, mine: 49, max_per_user: 50 })
    let resolveGive
    api.giveFlower.mockReturnValueOnce(new Promise((r) => { resolveGive = r }))
    const w = mountBtn()
    await flushPromises()
    await w.find('[data-testid="flower-button"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="flower-count"]').text()).toBe('50')
    expect(w.find('[data-testid="flower-button"]').classes()).not.toContain('flower-cap')
    expect(w.find('[data-testid="flower-button"]').attributes('title'))
      .not.toMatch(/maximum/i)

    resolveGive({ total: 50, mine: 50, max_per_user: 50 })
    await flushPromises()
    expect(w.find('[data-testid="flower-button"]').classes()).toContain('flower-cap')
    expect(w.find('[data-testid="flower-button"]').attributes('disabled')).toBeDefined()
  })

  it('aria-label includes the total and mine counts', async () => {
    _internal.setAccessToken('jwt')
    api.getFlowers.mockResolvedValueOnce({ total: 7, mine: 3, max_per_user: 50 })
    const w = mountBtn()
    await flushPromises()
    const aria = w.find('[data-testid="flower-button"]').attributes('aria-label')
    expect(aria).toContain('7')
    expect(aria).toContain('3')
  })
})
