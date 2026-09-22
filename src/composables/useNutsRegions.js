/**
 * The NUTS region list, fetched once per language and shared.
 *
 * 1798 regions is ~41 KB gzipped that never changes within a language, and
 * two components mounting at once should not fetch it twice. The in-flight
 * promise is what is cached, not just the result, so concurrent callers await
 * the same request rather than racing to start their own.
 *
 * Names are localised server-side, so the cache is keyed by language: a
 * visitor switching to Greek has to see Greek region names, and a cache that
 * outlived the switch would leave them looking at English ones.
 *
 * The list is for showing and labelling — what a region is called, what its
 * ancestors are called, what the chosen one is called. SEARCHING it is not
 * this composable's job: `/api/nuts/search` ranks across all 24 languages
 * server-side, and having a second ranking here is what this replaced.
 */
import { ref } from 'vue'
import { fetchNutsRegions } from '../api/nuts.js'
import { currentLang } from './useLang.js'

const regions = ref([])
const error = ref(null)
let inflight = null
let loadedLang = null

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

  return { regions, error, load }
}

/** Reset between tests — the module-level cache outlives a component. */
export function __resetNutsCache() {
  regions.value = []
  error.value = null
  inflight = null
  loadedLang = null
}
