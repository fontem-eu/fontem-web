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
    const mod = await import('../../src/composables/useTheme.js')
    useTheme = mod.useTheme
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to light when no localStorage entry and OS is light', () => {
    const { isDark, theme, init } = useTheme()
    init()
    expect(theme.value).toBe('light')
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
    mockMatchMedia(false)
    const { isDark, init } = useTheme()
    init()
    expect(isDark.value).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('respects a saved "light" preference over OS dark preference', () => {
    localStorage.setItem('gmr-theme', 'light')
    mockMatchMedia(true)
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

  it('defaults to light when matchMedia is undefined', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { isDark, init } = useTheme()
    init()
    expect(isDark.value).toBe(false)
  })

  // ── Migration from the retired "autumn" theme ────────────────

  it('migrates a saved "autumn" preference to the new light theme', () => {
    localStorage.setItem('gmr-theme', 'autumn')
    const { theme, isDark, init } = useTheme()
    init()
    expect(theme.value).toBe('light')
    expect(isDark.value).toBe(false)
    // The retired .autumn class must not leak onto <html>
    expect(document.documentElement.classList.contains('autumn')).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    // Migration persists: next read gets 'light', not 'autumn'
    expect(localStorage.getItem('gmr-theme')).toBe('light')
  })

  it('setTheme ignores unknown names', () => {
    const { theme, setTheme, init } = useTheme()
    init()
    setTheme('autumn')  // retired name is no longer accepted via setTheme
    setTheme('hot-pink')
    expect(theme.value).toBe('light')
  })
})
