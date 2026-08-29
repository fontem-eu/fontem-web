/**
 * Atlas palette preference — persisted, validated against the catalogue.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('useAtlasPalette', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules() })
  afterEach(() => { localStorage.clear(); vi.resetModules() })

  async function fresh(saved) {
    if (saved != null) localStorage.setItem('gmr-atlas-palette', saved)
    const { useAtlasPalette } = await import('../../src/composables/useAtlasPalette.js')
    return useAtlasPalette()
  }

  it('defaults to auto with nothing saved', async () => {
    const { palette } = await fresh()
    expect(palette.value).toBe('auto')
  })

  it('restores a saved palette id', async () => {
    const { palette } = await fresh('viridis')
    expect(palette.value).toBe('viridis')
  })

  it('falls back to auto for unknown saved values (forward-compat)', async () => {
    const { palette } = await fresh('palette-from-the-future')
    expect(palette.value).toBe('auto')
  })

  it('setPalette persists known ids and ignores unknown ones', async () => {
    const { palette, setPalette } = await fresh()
    setPalette('puor')
    expect(palette.value).toBe('puor')
    expect(localStorage.getItem('gmr-atlas-palette')).toBe('puor')
    setPalette('nope')
    expect(palette.value).toBe('puor')
    expect(localStorage.getItem('gmr-atlas-palette')).toBe('puor')
  })

  it('exposes the shared palette catalogue', async () => {
    const { catalog } = await fresh()
    expect(Object.keys(catalog)).toContain('viridis')
    expect(Object.keys(catalog)).toContain('auto')
  })
})
