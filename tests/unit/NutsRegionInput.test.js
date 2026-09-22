import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/nuts.js', () => ({
  fetchNutsRegions: vi.fn(),
  searchNutsRegions: vi.fn(),
}))

import NutsRegionInput from '../../src/components/NutsRegionInput.vue'
import { fetchNutsRegions, searchNutsRegions } from '../../src/api/nuts.js'
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

// What /api/nuts/search answers. The server ranks — these tests assert the
// component shows what it is given, in the order it is given, and says which
// form matched; the ranking itself is tested where it lives, in fontem-api.
const BY_CODE = Object.fromEntries(REGIONS.map((r) => [r.code, r]))

function match(code, { matched, lang = null, kind = 'name', rank = 1 } = {}) {
  const r = BY_CODE[code]
  return {
    code,
    level: r.level,
    country: code.slice(0, 2),
    name: r.name,
    name_native: r.name_native || r.name,
    matched: matched || r.name,
    matched_language: lang,
    matched_kind: kind,
    rank,
  }
}

/** Stand in for the server: substring over every name a fixture region has,
 *  which is enough to drive the component. */
function fakeSearch(q, { maxLevel = 3 } = {}) {
  const term = q.trim().toLowerCase()
  const norm = (s) => (s || '').toLowerCase()
  const matches = REGIONS
    .filter((r) => r.level <= maxLevel)
    .map((r) => {
      const forms = [r.name, r.name_latn, r.name_native, r.code].filter(Boolean)
      const hit = forms.find((f) => norm(f).includes(term))
        || (SERVER_ALIASES[r.code] || []).find((f) => norm(f).includes(term))
      return hit ? match(r.code, { matched: hit }) : null
    })
    .filter(Boolean)
  return Promise.resolve({ matches })
}

/** Names the fixture regions answer to that are not on the record itself —
 *  the server knows them from the gazetteer. */
const SERVER_ALIASES = {
  EL3: ['Attica', 'Αττική', 'αττικη'],
  EL303: ['Athina'],
  PT1A0: ['Lisboa', 'Lisbonne', 'Lissabon'],
  DE715: ['Bergstrasse'],
}

async function mountInput(props = {}) {
  const w = mount(NutsRegionInput, {
    props, global: { plugins: [makeTestI18n()] },
  })
  await flushPromises()
  return w
}

/** Type, then wait out the debounce and let the search settle. The
 *  component asks the server 140ms after the last keystroke. */
async function type(w, term) {
  const input = w.find('[data-testid="region-input"]')
  await input.trigger('focus')
  await input.setValue(term)
  await new Promise((r) => { setTimeout(r, 180) })
  await flushPromises()
  return input
}

const optionText = (w) => w.findAll('[data-testid="region-suggestions"] li')
  .map((li) => li.text())

beforeEach(() => {
  vi.clearAllMocks()
  __resetNutsCache()
  fetchNutsRegions.mockResolvedValue({ regions: REGIONS })
  searchNutsRegions.mockImplementation((q, opts) => fakeSearch(q, opts))
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

    it('asks the server once for a burst of typing, not once per keystroke', async () => {
      const w = await mountInput()
      const input = w.find('[data-testid="region-input"]')
      await input.trigger('focus')
      for (const term of ['c', 'co', 'coi', 'coim', 'coimbra']) {
        await input.setValue(term)
      }
      await new Promise((r) => { setTimeout(r, 200) })
      await flushPromises()
      expect(searchNutsRegions).toHaveBeenCalledTimes(1)
      expect(searchNutsRegions.mock.calls[0][0]).toBe('coimbra')
    })

    it('never lets a slow answer overwrite a newer query', async () => {
      /** The classic typeahead bug: "att" comes back after "coimbra" and the
       *  list flips to the wrong regions under the cursor. */
      const w = await mountInput()
      let releaseSlow
      searchNutsRegions.mockImplementationOnce(() => new Promise((resolve) => {
        releaseSlow = () => resolve(fakeSearch('att'))
      }))
      const input = w.find('[data-testid="region-input"]')
      await input.trigger('focus')
      await input.setValue('att')
      await new Promise((r) => { setTimeout(r, 180) })
      await type(w, 'coimbra')
      releaseSlow()
      await flushPromises()
      expect(optionText(w).join('|')).toContain('Coimbra')
      expect(optionText(w).join('|')).not.toContain('Attica')
    })

    it('keeps the last good list when a search fails', async () => {
      const w = await mountInput()
      await type(w, 'coimbra')
      searchNutsRegions.mockRejectedValueOnce(new Error('offline'))
      await type(w, 'coimbras')
      expect(optionText(w).join('|')).toContain('Coimbra')
    })

    it('shows the form that matched when the row does not already say it', async () => {
      /** Typing "Lisbonne" on the English site returns "Lisbon metropolitan
       *  area"; without the matched form the reader has to take it on
       *  trust. */
      const w = await mountInput()
      await type(w, 'Lisbonne')
      expect(w.find('[data-testid="region-option-PT1A0"]').text()).toContain('Lisbonne')
      // …and not when the row already shows it.
      await type(w, 'Coimbra')
      expect(w.find('[data-testid="region-option-PT165"]').text()).not.toContain('“')
    })

    it('asks only as deep as the caller allows', async () => {
      const w = await mountInput({ maxLevel: 1 })
      await type(w, 'lisboa')
      expect(searchNutsRegions.mock.calls.at(-1)[1].maxLevel).toBe(1)
    })
  })
})
