import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// useTheme uses a module-level singleton ref.
// We use vi.resetModules() + dynamic import so each test gets fresh state.

function mockMatchMedia(prefersDark = false) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: prefersDark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  )
}

describe('useTheme composable', () => {
  let useTheme

  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    document.documentElement.classList.remove('dark', 'autumn')
    mockMatchMedia(false)
    // Fresh import after resetModules gives us a clean singleton ref
    const mod = await import('../../src/composables/useTheme.js')
    useTheme = mod.useTheme
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to light mode when no localStorage entry and OS is light', () => {
    const { isDark, init } = useTheme()
    init()
    expect(isDark.value).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('applies dark mode when OS prefers dark (no saved preference)', () => {
    mockMatchMedia(true)
    const { isDark, init } = useTheme()
    init()
    expect(isDark.value).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('respects a saved "dark" preference over OS light preference', () => {
    localStorage.setItem('gmr-theme', 'dark')
    mockMatchMedia(false) // OS says light
    const { isDark, init } = useTheme()
    init()
    expect(isDark.value).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('respects a saved "light" preference over OS dark preference', () => {
    localStorage.setItem('gmr-theme', 'light')
    mockMatchMedia(true) // OS says dark
    const { isDark, init } = useTheme()
    init()
    expect(isDark.value).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('toggles from light to dark', () => {
    const { isDark, init, toggle } = useTheme()
    init()
    expect(isDark.value).toBe(false)

    toggle()

    expect(isDark.value).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('gmr-theme')).toBe('dark')
  })

  it('toggles from dark to light', () => {
    localStorage.setItem('gmr-theme', 'dark')
    const { isDark, init, toggle } = useTheme()
    init()
    expect(isDark.value).toBe(true)

    toggle()

    expect(isDark.value).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('gmr-theme')).toBe('light')
  })

  it('persists the chosen theme in localStorage', () => {
    const { init, toggle } = useTheme()
    init()
    expect(localStorage.getItem('gmr-theme')).toBe('light')

    toggle()
    expect(localStorage.getItem('gmr-theme')).toBe('dark')

    toggle()
    expect(localStorage.getItem('gmr-theme')).toBe('light')
  })

  it('defaults to light when matchMedia is undefined (no saved preference)', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { isDark, init } = useTheme()
    init()
    expect(isDark.value).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('defaults to light when matchMedia returns null matches (no saved preference)', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: null }))
    const { isDark, init } = useTheme()
    init()
    expect(isDark.value).toBe(false)
  })

  it('persists under the key gmr-theme specifically', () => {
    const { init } = useTheme()
    init()
    expect(localStorage.getItem('gmr-theme')).not.toBeNull()
    expect(localStorage.getItem('theme')).toBeNull()
  })

  // ── Autumn theme ─────────────────────────────────────────────

  it('restores a saved "autumn" preference on init', () => {
    localStorage.setItem('gmr-theme', 'autumn')
    const { theme, isDark, init } = useTheme()
    init()
    expect(theme.value).toBe('autumn')
    expect(isDark.value).toBe(false)
    expect(document.documentElement.classList.contains('autumn')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('setTheme switches directly to autumn', () => {
    const { theme, setTheme, init } = useTheme()
    init()
    setTheme('autumn')
    expect(theme.value).toBe('autumn')
    expect(document.documentElement.classList.contains('autumn')).toBe(true)
    expect(localStorage.getItem('gmr-theme')).toBe('autumn')
  })

  it('cycle() walks light → dark → autumn → light', () => {
    const { theme, cycle, init } = useTheme()
    init()
    expect(theme.value).toBe('light')
    cycle()
    expect(theme.value).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    cycle()
    expect(theme.value).toBe('autumn')
    expect(document.documentElement.classList.contains('autumn')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    cycle()
    expect(theme.value).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.classList.contains('autumn')).toBe(false)
  })

  it('setTheme ignores unknown names', () => {
    const { theme, setTheme, init } = useTheme()
    init()
    setTheme('hot-pink')
    expect(theme.value).toBe('light') // unchanged
  })

  it('dark and autumn classes are mutually exclusive', () => {
    const { setTheme, init } = useTheme()
    init()
    setTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    setTheme('autumn')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.classList.contains('autumn')).toBe(true)
  })
})
