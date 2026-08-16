import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/geo.js', () => ({ fetchNutsRegions: vi.fn() }))

import NutsRegionInput from '../../src/components/NutsRegionInput.vue'
import { fetchNutsRegions } from '../../src/api/geo.js'
import { __resetNutsCache } from '../../src/composables/useNutsRegions.js'

const REGIONS = [
  { code: 'PT', name: 'Portugal', level: 0 },
  { code: 'PT1', name: 'Continente', level: 1 },
  { code: 'PT16', name: 'Centro', level: 2 },
  { code: 'PT165', name: 'Coimbra', level: 3 },
  { code: 'PT17', name: 'Área Metropolitana de Lisboa', level: 2 },
  { code: 'ES', name: 'Spain', level: 0 },
  { code: 'ES3', name: 'Comunidad de Madrid', level: 1 },
  { code: 'DE', name: 'Germany', level: 0 },
  { code: 'PL71', name: 'Łódzkie', level: 2 },
]

async function mountInput(props = {}) {
  const w = mount(NutsRegionInput, {
    props, global: { plugins: [makeTestI18n()] },
  })
  await flushPromises()
  return w
}

async function type(w, term) {
  const input = w.find('[data-testid="region-input"]')
  await input.trigger('focus')
  await input.setValue(term)
  await flushPromises()
  return input
}

const optionText = (w) => w.findAll('[data-testid="region-suggestions"] li')
  .map((li) => li.text())

beforeEach(() => {
  vi.clearAllMocks()
  __resetNutsCache()
  fetchNutsRegions.mockResolvedValue({ regions: REGIONS })
})

describe('NutsRegionInput', () => {
  it('offers countries before anything is typed', async () => {
    const w = await mountInput()
    await w.find('[data-testid="region-input"]').trigger('focus')
    await flushPromises()
    const text = optionText(w).join('|')
    expect(text).toContain('Portugal')
    expect(text).toContain('Spain')
    // A level-3 region is not a useful first suggestion.
    expect(text).not.toContain('Coimbra')
  })

  it('finds a region by typing its name', async () => {
    const w = await mountInput()
    await type(w, 'coimbra')
    expect(optionText(w).join('|')).toContain('Coimbra')
  })

  it('finds a region by its NUTS code too', async () => {
    const w = await mountInput()
    await type(w, 'PT16')
    const codes = w.findAll('[data-testid^="region-option-"]')
      .map((li) => li.attributes('data-testid'))
    expect(codes).toContain('region-option-PT16')
  })

  it('ranks a name prefix above a mere substring', async () => {
    /** Typing "port" should offer Portugal first, not a region that merely
     *  contains the letters. */
    const w = await mountInput()
    await type(w, 'port')
    expect(optionText(w)[0]).toContain('Portugal')
  })

  it('prefers the shallower region when both match', async () => {
    const w = await mountInput()
    await type(w, 'pt1')
    const first = w.findAll('[data-testid^="region-option-"]')[0]
    expect(first.attributes('data-testid')).toBe('region-option-PT1')
  })

  it('disambiguates with the parent chain', async () => {
    /** "Coimbra" alone is ambiguous; the ancestors make it not. */
    const w = await mountInput()
    await type(w, 'coimbra')
    const option = w.find('[data-testid="region-option-PT165"]')
    expect(option.text()).toContain('Portugal')
    expect(option.text()).toContain('Centro')
  })

  it('offers Europe as a real choice, not an empty value', async () => {
    const w = await mountInput()
    await w.find('[data-testid="region-input"]').trigger('focus')
    await flushPromises()
    await w.find('[data-testid="region-option-EU"]').trigger('mousedown')
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['EU'])
  })

  it('can hide Europe when a caller needs a concrete region', async () => {
    const w = await mountInput({ allowEverywhere: false })
    await w.find('[data-testid="region-input"]').trigger('focus')
    await flushPromises()
    expect(w.find('[data-testid="region-option-EU"]').exists()).toBe(false)
  })

  it('emits the chosen code', async () => {
    const w = await mountInput()
    await type(w, 'coimbra')
    await w.find('[data-testid="region-option-PT165"]').trigger('mousedown')
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['PT165'])
  })

  it('shows what is selected, and can clear it', async () => {
    const w = await mountInput({ modelValue: 'PT16' })
    const chip = w.find('[data-testid="region-selected"]')
    expect(chip.text()).toContain('Centro')
    expect(w.find('[data-testid="region-input"]').exists()).toBe(false)

    await w.find('[data-testid="region-clear"]').trigger('click')
    expect(w.emitted('update:modelValue').at(-1)).toEqual([''])
  })

  it('respects maxLevel', async () => {
    const w = await mountInput({ maxLevel: 1 })
    await type(w, 'pt')
    const codes = w.findAll('[data-testid^="region-option-"]')
      .map((li) => li.attributes('data-testid'))
    expect(codes).toContain('region-option-PT')
    expect(codes).not.toContain('region-option-PT16')
  })

  it('says so when nothing matches', async () => {
    const w = await mountInput()
    await type(w, 'atlantis')
    expect(w.find('[data-testid="region-no-match"]').text()).toContain('atlantis')
  })

  it('is keyboard-operable: arrows move, Enter selects', async () => {
    const w = await mountInput()
    const input = await type(w, 'pt')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue')).toBeTruthy()
  })

  it('closes on Escape without choosing', async () => {
    const w = await mountInput()
    const input = await type(w, 'pt')
    expect(w.find('[data-testid="region-suggestions"]').exists()).toBe(true)
    await input.trigger('keydown', { key: 'Escape' })
    expect(w.find('[data-testid="region-suggestions"]').exists()).toBe(false)
    expect(w.emitted('update:modelValue')).toBeFalsy()
  })

  it('tells a screen reader which option is current', async () => {
    const w = await mountInput()
    const input = await type(w, 'pt')
    expect(input.attributes('role')).toBe('combobox')
    expect(input.attributes('aria-expanded')).toBe('true')
    const activeId = input.attributes('aria-activedescendant')
    expect(activeId).toBeTruthy()
    expect(w.find(`#${activeId}`).attributes('aria-selected')).toBe('true')
  })

  it('fetches the region list once even for several inputs', async () => {
    await mountInput()
    await mountInput()
    expect(fetchNutsRegions).toHaveBeenCalledTimes(1)
  })
})
