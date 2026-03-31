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
    vi.spyOn(tickersApi, 'searchAll').mockResolvedValue({
      query: 'aapl',
      companies: [makeTicker()],
      authorities: [],
    })

    const wrapper = mount(TickerSearch)
    await wrapper.find('input').setValue('aapl')
    await nextTick() // let Vue's watch fire
    vi.advanceTimersByTime(300) // past the 280 ms debounce
    await flushPromises() // resolve the fetch

    expect(wrapper.find('[role="listitem"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('AAPL')
    expect(wrapper.text()).toContain('Apple Inc.')
  })

  it('displays the result count in the status line', async () => {
    vi.spyOn(tickersApi, 'searchAll').mockResolvedValue({
      query: 'aapl',
      companies: [makeTicker()],
      authorities: [],
    })

    const wrapper = mount(TickerSearch)
    await wrapper.find('input').setValue('aapl')
    await nextTick()
    vi.advanceTimersByTime(300)
    await flushPromises()

    const status = wrapper.find('.gmr-status')
    expect(status.text()).toContain('1 result')
  })

  it('shows the empty state when the search returns no results', async () => {
    vi.spyOn(tickersApi, 'searchAll').mockResolvedValue({
      query: 'zzznotreal',
      companies: [],
      authorities: [],
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
    vi.spyOn(tickersApi, 'searchAll').mockRejectedValue(new Error('network error'))

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
    vi.spyOn(tickersApi, 'searchAll').mockResolvedValue({
      query: 'aapl',
      companies: [makeTicker()],
      authorities: [],
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
    const spy = vi.spyOn(tickersApi, 'searchAll').mockResolvedValue({
      query: 'a',
      companies: [],
      authorities: [],
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

  it('emits "select" with the ticker symbol when a card is clicked', async () => {
    vi.spyOn(tickersApi, 'searchAll').mockResolvedValue({
      query: 'aapl',
      companies: [makeTicker()],
      authorities: [],
    })

    const wrapper = mount(TickerSearch)
    await wrapper.find('input').setValue('aapl')
    await nextTick()
    vi.advanceTimersByTime(300)
    await flushPromises()

    await wrapper.find('[role="listitem"]').trigger('click')

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')[0]).toEqual(['AAPL'])
  })

  it('clears the query and results when selectedSymbol prop changes to a new ticker', async () => {
    vi.spyOn(tickersApi, 'searchAll').mockResolvedValue({
      query: 'aapl',
      companies: [makeTicker()],
      authorities: [],
    })

    const wrapper = mount(TickerSearch, { props: { selectedSymbol: null } })
    await wrapper.find('input').setValue('aapl')
    await nextTick()
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.find('[role="list"]').exists()).toBe(true)

    // Parent signals a ticker was selected — list and query should clear
    await wrapper.setProps({ selectedSymbol: 'AAPL' })
    await nextTick()

    expect(wrapper.find('[role="list"]').exists()).toBe(false)
    expect(wrapper.find('input').element.value).toBe('')
  })

  it('shows results while a ticker is already selected (search while viewing financials)', async () => {
    vi.spyOn(tickersApi, 'searchAll').mockResolvedValue({
      query: 'msft',
      companies: [makeTicker({ symbol: 'MSFT', name: 'Microsoft Corp.' })],
      authorities: [],
    })

    // Ticker already selected — simulates having /AAPL open
    const wrapper = mount(TickerSearch, { props: { selectedSymbol: 'AAPL' } })

    await wrapper.find('input').setValue('msft')
    await nextTick()
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.find('[role="list"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('MSFT')
  })

  it('clears results when clicking outside the search container', async () => {
    vi.spyOn(tickersApi, 'searchAll').mockResolvedValue({
      query: 'aapl',
      companies: [makeTicker()],
      authorities: [],
    })

    const wrapper = mount(TickerSearch, { attachTo: document.body })
    await wrapper.find('input').setValue('aapl')
    await nextTick()
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.findAll('[role="listitem"]')).toHaveLength(1)

    // Simulate a click on an element outside the component
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(wrapper.findAll('[role="listitem"]')).toHaveLength(0)

    document.body.removeChild(outside)
    wrapper.unmount()
  })

  // ── Keyboard navigation ────────────────────────────────────

  async function mountWithResults(symbols = ['AAPL', 'MSFT']) {
    vi.spyOn(tickersApi, 'searchAll').mockResolvedValue({
      companies: symbols.map((s) => makeTicker({ symbol: s, name: s })),
      authorities: [],
    })
    const wrapper = mount(TickerSearch, { attachTo: document.body })
    await wrapper.find('input').setValue('a')
    await nextTick()
    vi.advanceTimersByTime(300)
    await flushPromises()
    return wrapper
  }

  it('ArrowDown highlights the first result', async () => {
    const wrapper = await mountWithResults()
    await wrapper.find('input').trigger('keydown', { key: 'ArrowDown' })
    const cards = wrapper.findAll('[role="listitem"]')
    expect(cards[0].classes()).toContain('gmr-card--active')
    expect(cards[1].classes()).not.toContain('gmr-card--active')
    wrapper.unmount()
  })

  it('ArrowDown then ArrowDown highlights the second result', async () => {
    const wrapper = await mountWithResults()
    const input = wrapper.find('input')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    const cards = wrapper.findAll('[role="listitem"]')
    expect(cards[1].classes()).toContain('gmr-card--active')
    wrapper.unmount()
  })

  it('ArrowUp does not go below index 0', async () => {
    const wrapper = await mountWithResults()
    const input = wrapper.find('input')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowUp' })
    // index should still be 0 (can't go negative)
    const cards = wrapper.findAll('[role="listitem"]')
    expect(cards[0].classes()).toContain('gmr-card--active')
    wrapper.unmount()
  })

  it('Enter emits select for the highlighted result', async () => {
    const wrapper = await mountWithResults(['AAPL', 'MSFT'])
    const input = wrapper.find('input')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')[0]).toEqual(['MSFT'])
    wrapper.unmount()
  })

  it('Escape clears query and results', async () => {
    const wrapper = await mountWithResults()
    await wrapper.find('input').trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(wrapper.findAll('[role="listitem"]')).toHaveLength(0)
    expect(wrapper.find('input').element.value).toBe('')
    wrapper.unmount()
  })
})
