/**
 * The NUTS region list, fetched once per page load and shared.
 *
 * 1798 regions across four levels is ~60 KB of JSON that never changes within
 * a session, and two components mounting at once should not fetch it twice.
 * The in-flight promise is what is cached, not just the result, so concurrent
 * callers await the same request rather than racing to start their own.
 */
import { ref } from 'vue'
import { fetchNutsRegions } from '../api/geo.js'

const regions = ref([])
const error = ref(null)
let inflight = null

export function useNutsRegions() {
  async function load() {
    if (regions.value.length) return regions.value
    if (!inflight) {
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
}
