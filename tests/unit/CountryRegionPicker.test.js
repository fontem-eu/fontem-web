/**
 * CountryRegionPicker — single-select story region (country or the whole EU),
 * with legacy deep-code collapse.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { makeTestI18n } from './helpers/i18n.js'

const fetchNutsRegions = vi.fn()
vi.mock('../../src/api/geo.js', () => ({ fetchNutsRegions: (...a) => fetchNutsRegions(...a) }))

import CountryRegionPicker from '../../src/components/CountryRegionPicker.vue'

beforeEach(() => {
  fetchNutsRegions.mockReset()
  fetchNutsRegions.mockResolvedValue({
    regions: [
      { code: 'PT', name: 'Portugal', level: 0 },
      { code: 'DE', name: 'Germany', level: 0 },
      { code: 'EL', name: 'Greece', level: 0 },
      { code: 'PT1', name: 'Continente', level: 1 },
      { code: 'PT17', name: 'Área Metropolitana de Lisboa', level: 2 },
    ],
  })
})

async function mountPicker(modelValue = '') {
  const w = mount(CountryRegionPicker, {
    props: { modelValue },
    global: { plugins: [makeTestI18n()] },
  })
  await flushPromises()
  return w
}

describe('CountryRegionPicker', () => {
  it('defaults to European Union and lists only level-0 countries sorted by name', async () => {
    const w = await mountPicker()
    const sel = w.find('[data-testid="country-region-select"]')
    expect(sel.exists()).toBe(true)
    expect(sel.element.value).toBe('')
    const optionTexts = sel.findAll('option').map((o) => o.text())
    expect(optionTexts[0]).toBe('European Union')
    // level-1/level-2 regions excluded; countries sorted alphabetically
    expect(optionTexts).toEqual(['European Union', 'Germany', 'Greece', 'Portugal'])
    expect(optionTexts).not.toContain('Continente')
  })

  it('mounting with the empty default does not emit', async () => {
    const w = await mountPicker('')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('normalizes a legacy deep code (PT170) to its country and emits PT', async () => {
    const w = await mountPicker('PT170')
    // the collapsed country is emitted so the next save rewrites the deep code
    expect(w.emitted('update:modelValue')).toBeTruthy()
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['PT'])
    // and the select shows the country selected
    expect(w.find('[data-testid="country-region-select"]').element.value).toBe('PT')
  })

  it('selecting a country emits its 2-letter code', async () => {
    const w = await mountPicker('')
    await w.find('[data-testid="country-region-select"]').setValue('DE')
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['DE'])
  })

  it('selecting European Union emits the empty string', async () => {
    const w = await mountPicker('PT')
    await w.find('[data-testid="country-region-select"]').setValue('')
    expect(w.emitted('update:modelValue').at(-1)).toEqual([''])
  })
})
