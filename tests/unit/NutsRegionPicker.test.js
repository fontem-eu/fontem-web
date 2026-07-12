/**
 * NutsRegionPicker — cascading region selects (names, parent-gating, reset).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { makeTestI18n } from './helpers/i18n.js'

const fetchNutsRegions = vi.fn()
vi.mock('../../src/api/geo.js', () => ({ fetchNutsRegions: (...a) => fetchNutsRegions(...a) }))

import NutsRegionPicker from '../../src/components/NutsRegionPicker.vue'

beforeEach(() => {
  fetchNutsRegions.mockReset()
  fetchNutsRegions.mockResolvedValue({
    regions: [
      { code: 'PT', name: 'Portugal', level: 0 },
      { code: 'DE', name: 'Germany', level: 0 },
      { code: 'PT1', name: 'Continente', level: 1 },
      { code: 'PT17', name: 'Área Metropolitana de Lisboa', level: 2 },
      { code: 'DE2', name: 'Bayern', level: 1 },
    ],
  })
})

async function mountPicker(modelValue = '') {
  const w = mount(NutsRegionPicker, {
    props: { modelValue },
    global: { plugins: [makeTestI18n()] },
  })
  await flushPromises()
  return w
}

describe('NutsRegionPicker', () => {
  it('shows level-0 countries by name and gates deeper levels', async () => {
    const w = await mountPicker()
    expect(w.find('[data-testid="nuts-l0"]').text()).toContain('Portugal')
    // deeper levels disabled until the one above is chosen
    expect(w.find('[data-testid="nuts-l1"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid="nuts-l2"]').attributes('disabled')).toBeDefined()
  })

  it('choosing a parent enables + filters the next level and emits the code', async () => {
    const w = await mountPicker()
    await w.find('[data-testid="nuts-l0"]').setValue('PT')
    // emits the selected code
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['PT'])
    // level 1 now enabled and shows only PT children (Continente, not Bayern)
    const l1 = w.find('[data-testid="nuts-l1"]')
    expect(l1.attributes('disabled')).toBeUndefined()
    expect(l1.text()).toContain('Continente')
    expect(l1.text()).not.toContain('Bayern')
  })

  it('reconstructs the full cascade from a deep code in modelValue', async () => {
    const w = await mountPicker('PT17')
    expect(w.find('[data-testid="nuts-l0"]').element.value).toBe('PT')
    expect(w.find('[data-testid="nuts-l1"]').element.value).toBe('PT1')
    expect(w.find('[data-testid="nuts-l2"]').element.value).toBe('PT17')
  })

  it('changing a higher level resets the levels below it', async () => {
    const w = await mountPicker('PT17')
    await w.find('[data-testid="nuts-l0"]').setValue('DE')
    // now emits just DE (children reset)
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['DE'])
    expect(w.find('[data-testid="nuts-l1"]').element.value).toBe('')
  })
})
