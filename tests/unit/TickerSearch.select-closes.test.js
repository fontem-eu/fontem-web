/**
 * TS-REG-01: Dropdown must close after selecting a search result.
 *
 * Bug: clicking a result or pressing Enter on a highlighted result emits the
 * 'select' event but never clears the results array, so the dropdown stays
 * visible and blocks the UI.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import TickerSearch from '../../src/components/TickerSearch.vue'
import * as tickersApi from '../../src/api/tickers.js'

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

/** Mount TickerSearch, type a query, and wait for results to appear. */
async function mountWithResults() {
  vi.spyOn(tickersApi, 'searchAll').mockResolvedValue({
    query: 'aapl',
    companies: [makeTicker(), makeTicker({ symbol: 'MSFT', name: 'Microsoft Corp.' })],
    authorities: [],
  })

  const wrapper = mount(TickerSearch, { attachTo: document.body })
  await wrapper.find('input').setValue('aapl')
  await nextTick()
  vi.advanceTimersByTime(300) // past the 280 ms debounce
  await flushPromises()

  // Sanity check — dropdown should be visible before we interact
  expect(wrapper.find('ul.gmr-results').exists()).toBe(true)
  return wrapper
}

describe('TickerSearch — dropdown closes on selection (TS-REG-01)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('dropdown closes after clicking a result', async () => {
    const wrapper = await mountWithResults()

    // Click the first result
    await wrapper.find('li.gmr-card').trigger('click')
    await nextTick()

    // The select event must have been emitted
    expect(wrapper.emitted('select')).toBeTruthy()

    // The dropdown must be gone
    expect(wrapper.find('ul.gmr-results').exists()).toBe(false)

    // The query input must be cleared
    expect(wrapper.find('input').element.value).toBe('')

    wrapper.unmount()
  })

  it('dropdown closes after pressing Enter on a highlighted result', async () => {
    const wrapper = await mountWithResults()
    const input = wrapper.find('input')

    // Highlight the second result and press Enter
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })
    await nextTick()

    // The select event must have been emitted
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')[0]).toEqual(['MSFT'])

    // The dropdown must be gone
    expect(wrapper.find('ul.gmr-results').exists()).toBe(false)

    // The query input must be cleared
    expect(wrapper.find('input').element.value).toBe('')

    wrapper.unmount()
  })
})
