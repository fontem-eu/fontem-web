import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import TickerSearch from '../../src/components/TickerSearch.vue'
import * as tickersApi from '../../src/api/tickers.js'

// Fake ticker factory for test fixtures
function makeTicker(overrides = {}) {
  return {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    exchange: 'NASDAQ',
    country: 'US',
    sector: 'Unknown',
    is_active: true,
    ...overrides,
  }
}

describe('TickerSearch component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('renders a search input on mount', () => {
    const wrapper = mount(TickerSearch)
    expect(wrapper.find('input[type="search"]').exists()).toBe(true)
  })

  it('shows results after typing a query', async () => {
    vi.spyOn(tickersApi, 'searchTickers').mockResolvedValue({
      query: 'aapl',
      results: [makeTicker()],
      count: 1,
      total_available: 10416,
    })

    const wrapper = mount(TickerSearch)
    await wrapper.find('input').setValue('aapl')
    await nextTick()               // let Vue's watch fire
    vi.advanceTimersByTime(300)    // past the 280 ms debounce
    await flushPromises()          // resolve the fetch

    expect(wrapper.find('[role="listitem"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('AAPL')
    expect(wrapper.text()).toContain('Apple Inc.')
  })

  it('displays the result count in the status line', async () => {
    vi.spyOn(tickersApi, 'searchTickers').mockResolvedValue({
      query: 'aapl',
      results: [makeTicker()],
      count: 1,
      total_available: 10416,
    })

    const wrapper = mount(TickerSearch)
    await wrapper.find('input').setValue('aapl')
    await nextTick()
    vi.advanceTimersByTime(300)
    await flushPromises()

    const status = wrapper.find('.gmr-status')
    expect(status.text()).toContain('1 result')
    expect(status.text()).toContain('10,416 total tickers')
  })

  it('shows the empty state when the search returns no results', async () => {
    vi.spyOn(tickersApi, 'searchTickers').mockResolvedValue({
      query: 'zzznotreal',
      results: [],
      count: 0,
      total_available: 10416,
    })

    const wrapper = mount(TickerSearch)
    await wrapper.find('input').setValue('zzznotreal')
    await nextTick()
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.find('.gmr-empty').exists()).toBe(true)
    expect(wrapper.text()).toContain('No tickers found')
    expect(wrapper.text()).toContain('zzznotreal')
  })

  it('shows an error message when the API call fails', async () => {
    vi.spyOn(tickersApi, 'searchTickers').mockRejectedValue(new Error('network error'))

    const wrapper = mount(TickerSearch)
    await wrapper.find('input').setValue('aapl')
    await nextTick()
    vi.advanceTimersByTime(300)
    await flushPromises()

    const status = wrapper.find('.gmr-status')
    expect(status.text()).toContain('Error')
    expect(status.classes()).toContain('gmr-status--err')
  })

  it('clears results when the input is emptied', async () => {
    vi.spyOn(tickersApi, 'searchTickers').mockResolvedValue({
      query: 'aapl',
      results: [makeTicker()],
      count: 1,
      total_available: 10416,
    })

    const wrapper = mount(TickerSearch)
    await wrapper.find('input').setValue('aapl')
    await nextTick()
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(wrapper.findAll('[role="listitem"]')).toHaveLength(1)

    // Clear the input
    await wrapper.find('input').setValue('')
    await nextTick()
    await flushPromises()

    expect(wrapper.findAll('[role="listitem"]')).toHaveLength(0)
    expect(wrapper.find('.gmr-empty').exists()).toBe(false)
  })

  it('only fires the API once after rapid keystrokes (debounce)', async () => {
    const spy = vi.spyOn(tickersApi, 'searchTickers').mockResolvedValue({
      query: 'a',
      results: [],
      count: 0,
      total_available: 0,
    })

    const wrapper = mount(TickerSearch)
    const input = wrapper.find('input')

    // Simulate rapid typing — each keystroke resets the timer
    await input.setValue('a')
    await nextTick()
    vi.advanceTimersByTime(100)

    await input.setValue('ap')
    await nextTick()
    vi.advanceTimersByTime(100)

    await input.setValue('app')
    await nextTick()
    vi.advanceTimersByTime(300) // now the debounce fires for "app"
    await flushPromises()

    // Only ONE call should have been made
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('app')
  })
})
