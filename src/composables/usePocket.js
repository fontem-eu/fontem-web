/**
 * Pocket — browser-local store for visualization snapshots.
 *
 * Each item is { id, name, widget_type, config, savedAt }.
 * Stored in localStorage under 'gmr-pocket'.
 */
import { ref } from 'vue'

const STORAGE_KEY = 'gmr-pocket'

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

const items = ref(load())

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
  } catch { /* quota exceeded — ignore */ }
}

export function usePocket() {
  /** Refresh from localStorage (useful if another tab writes). */
  function refresh() {
    items.value = load()
  }

  /** Save a visualization snapshot to the pocket. */
  function save(widgetType, config, name) {
    const id = crypto.randomUUID()
    const item = {
      id,
      name: name || `${config.entityId || 'unknown'} — ${widgetType.replaceAll('_', ' ')}`,
      widget_type: widgetType,
      config: { ...config, schema_version: 1 },
      savedAt: new Date().toISOString(),
    }
    items.value.unshift(item)
    persist()
    return item
  }

  /** Remove an item by id. */
  function remove(id) {
    items.value = items.value.filter((i) => i.id !== id)
    persist()
  }

  /** Clear all pocket items. */
  function clear() {
    items.value = []
    persist()
  }

  return { items, save, remove, clear, refresh }
}
