import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/geo.js', () => ({
  fetchNutsRegions: vi.fn(),
  fetchNutsSearchIndex: vi.fn(),
}))

import NutsRegionInput from '../../src/components/NutsRegionInput.vue'
import { fetchNutsRegions, fetchNutsSearchIndex } from '../../src/api/geo.js'
import { __resetNutsCache } from '../../src/composables/useNutsRegions.js'

const REGIONS = [
  { code: 'PT', name: 'Portugal', level: 0 },
  { code: 'PT1', name: 'Continente', level: 1 },
  { code: 'PT16', name: 'Centro', level: 2 },
  { code: 'PT165', name: 'Coimbra', level: 3 },
  { code: 'PT1A0', name: 'Lisbon metropolitan area', level: 3,
    name_latn: 'Grande Lisboa', name_native: 'Grande Lisboa' },
  { code: 'ES', name: 'Spain', level: 0 },
  { code: 'ES3', name: 'Comunidad de Madrid', level: 1 },
  { code: 'DE', name: 'Germany', level: 0 },
  { code: 'DE715', name: 'Bergstraße', level: 3, name_native: 'Bergstraße' },
  { code: 'PL71', name: 'Łódzkie', level: 2 },
  // The case that started this: Eurostat only names EL3 in Greek, and its
  // Latin transliteration is not what an English or French reader types.
  { code: 'EL3', name: 'Attica Region', level: 1,
    name_latn: 'Attiki', name_native: 'Αττική' },
  { code: 'EL303', name: 'Kentrikos Tomeas Athinon', level: 3,
    name_latn: 'Kentrikos Tomeas Athinon', name_native: 'Κεντρικός Τομέας Αθηνών' },
]

// Folded exactly as the API ships it: lowercase, accents stripped, one
// region per entry with its names in every language joined by spaces.
const SEARCH_TERMS = {
  EL3: 'attika attica region perifereia attikis atica periferia de atica',
  EL303: 'kentrikos tomeas athinon athina κεντρικος τομεας αθηνων',
  PT1A0: 'grande lisboa lisbon metropolitan area aire metropolitaine de lisbonne '
    + 'area metropolitana de lisboa lissabon',
}

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
  fetchNutsSearchIndex.mockResolvedValue({ terms: SEARCH_TERMS })
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

  describe('across languages', () => {
    it('finds a Greek region by its English name', async () => {
      const w = await mountInput()
      await type(w, 'attica')
      const codes = w.findAll('[data-testid^="region-option-"]')
        .map((li) => li.attributes('data-testid'))
      expect(codes).toContain('region-option-EL3')
    })

    it('finds it by the Latin transliteration Eurostat publishes', async () => {
      const w = await mountInput()
      await type(w, 'attiki')
      expect(w.find('[data-testid="region-option-EL3"]').exists()).toBe(true)
    })

    it('finds it by its Greek name, accents or none', async () => {
      const w = await mountInput()
      await type(w, 'Αττική')
      expect(w.find('[data-testid="region-option-EL3"]').exists()).toBe(true)
      await type(w, 'αττικη')
      expect(w.find('[data-testid="region-option-EL3"]').exists()).toBe(true)
    })

    it('finds Lisbon from any of the languages it is named in', async () => {
      const w = await mountInput()
      for (const term of ['lisboa', 'lisbonne', 'lissabon', 'Grande Lisboa']) {
        await type(w, term)
        expect(
          w.find('[data-testid="region-option-PT1A0"]').exists(),
          `"${term}" should find PT1A0`,
        ).toBe(true)
      }
    })

    it('finds a NUTS 3 unit by the city it is the metro region of', async () => {
      /** Nobody looks for central Athens by typing "Kentrikos Tomeas". */
      const w = await mountInput()
      await type(w, 'athina')
      expect(w.find('[data-testid="region-option-EL303"]').exists()).toBe(true)
    })

    it('matches ß as ss, the way the server folded it', async () => {
      const w = await mountInput()
      await type(w, 'bergstrasse')
      expect(w.find('[data-testid="region-option-DE715"]').exists()).toBe(true)
    })

    it('ranks the name on screen above a name in another language', async () => {
      const w = await mountInput()
      await type(w, 'attica')
      expect(optionText(w)[0]).toContain('Attica Region')
    })

    it('shows the national-language name next to a translated one', async () => {
      const w = await mountInput()
      await type(w, 'attica')
      expect(w.find('[data-testid="region-option-EL3"]').text()).toContain('Αττική')
    })

    it('loads the index when the input is touched, not on mount', async () => {
      await mountInput()
      expect(fetchNutsSearchIndex).not.toHaveBeenCalled()
      const w = await mountInput()
      await w.find('[data-testid="region-input"]').trigger('focus')
      await flushPromises()
      expect(fetchNutsSearchIndex).toHaveBeenCalledTimes(1)
    })

    it('still matches the visible names when the index fails to load', async () => {
      fetchNutsSearchIndex.mockRejectedValue(new Error('offline'))
      const w = await mountInput()
      await type(w, 'coimbra')
      expect(w.find('[data-testid="region-option-PT165"]').exists()).toBe(true)
    })
  })
})
