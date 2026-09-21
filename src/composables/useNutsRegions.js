/**
 * The NUTS region list, fetched once per language and shared.
 *
 * 1798 regions across four levels is ~37 KB gzipped that never changes
 * within a language, and two components mounting at once should not fetch it
 * twice. The in-flight promise is what is cached, not just the result, so
 * concurrent callers await the same request rather than racing to start
 * their own.
 *
 * Names are localised server-side, so the cache is keyed by language: a
 * visitor switching to Greek has to see Greek region names, and a cache that
 * outlived the switch would leave them looking at English ones.
 *
 * The cross-language search index is separate and loaded lazily. It is four
 * times the size of the list and only matters once somebody types, so the
 * picker asks for it on first input rather than on mount.
 */
import { ref } from 'vue'
import { fetchNutsRegions, fetchNutsSearchIndex } from '../api/geo.js'
import { currentLang } from './useLang.js'

const regions = ref([])
const searchTerms = ref({})
const error = ref(null)
let inflight = null
let loadedLang = null
let indexInflight = null

export function useNutsRegions() {
  async function load() {
    const lang = currentLang()
    if (regions.value.length && loadedLang === lang) return regions.value
    if (!inflight || loadedLang !== lang) {
      loadedLang = lang
      inflight = fetchNutsRegions()
        .then((data) => {
          regions.value = data?.regions || []
          return regions.value
        })
        .catch((err) => {
          // Clear the cached promise so a later mount can retry; a failed
          // fetch that poisons the cache forever is worse than a slow one.
          inflight = null
          error.value = err.message
          return []
        })
    }
    return inflight
  }

  /**
   * Load the folded cross-language name index.
   *
   * Failure is deliberately quiet: matching still works on the names
   * already on screen, so a visitor whose index request fails gets the
   * pre-index behaviour rather than a broken picker.
   */
  async function loadSearchIndex() {
    if (Object.keys(searchTerms.value).length) return searchTerms.value
    if (!indexInflight) {
      indexInflight = fetchNutsSearchIndex()
        .then((data) => {
          searchTerms.value = data?.terms || {}
          return searchTerms.value
        })
        .catch(() => {
          indexInflight = null
          return {}
        })
    }
    return indexInflight
  }

  return { regions, searchTerms, error, load, loadSearchIndex }
}

/** Reset between tests — the module-level cache outlives a component. */
export function __resetNutsCache() {
  regions.value = []
  searchTerms.value = {}
  error.value = null
  inflight = null
  indexInflight = null
  loadedLang = null
}
