/**
 * Fetches + caches each store's schema (/api/query/schema/{lang}) for the
 * editor's autocomplete and the schema reference panel. Cached per language for
 * the page session; the backend caches server-side too.
 */
import { reactive } from 'vue'

const cache = reactive({})   // lang -> schema | null
const inflight = {}

export function useQuerySchema() {
  async function loadSchema(lang) {
    if (lang in cache) return cache[lang]
    if (inflight[lang]) return inflight[lang]
    inflight[lang] = fetch(`/api/query/schema/${lang}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => { cache[lang] = s; return s })
      .catch(() => { cache[lang] = null; return null })
      .finally(() => { delete inflight[lang] })
    return inflight[lang]
  }
  return { loadSchema, cache }
}
