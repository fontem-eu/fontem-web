/**
 * Atlas palette preference — persisted to localStorage so the user's
 * choice survives across visits, even when signed out.
 *
 * Singleton-style ref shared across every map component (AtlasView,
 * AtlasMapEmbed, EntityNutsMap, the legend) so the palette flips
 * everywhere the moment the user picks a different one in the
 * preferences menu.
 *
 * Falls back to 'auto' (CVD-safe by-kind default) when:
 *   - localStorage is unavailable (SSR)
 *   - the saved value isn't a known palette ID (forward-compat with
 *     a future user who's used a newer build)
 */
import { ref } from 'vue'

import { PALETTE_CATALOG } from '../widgets/atlas/colorScale.js'

const STORAGE_KEY = 'gmr-atlas-palette'

function _readSaved() {
  if (typeof localStorage === 'undefined') return 'auto'
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw && raw in PALETTE_CATALOG ? raw : 'auto'
  } catch {
    return 'auto'
  }
}

const palette = ref(_readSaved())

function setPalette(id) {
  if (!(id in PALETTE_CATALOG)) return
  palette.value = id
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(STORAGE_KEY, id) } catch { /* noop */ }
  }
}

export function useAtlasPalette() {
  return { palette, setPalette, catalog: PALETTE_CATALOG }
}
