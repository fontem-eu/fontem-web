import { computed, ref } from 'vue'

// Module-level singleton so every component sees the same reactive value.
// Valid values: 'light' | 'dark' | 'autumn'.  'autumn' is a warm
// cream-and-rose pastel variant designed to sit between the two extremes.
export const THEMES = ['light', 'dark', 'autumn']

const theme = ref('light')

// Backward-compat: code that only cared about light↔dark can keep
// reading isDark. (autumn counts as "not dark" for this purpose — it's
// a light-ish palette.)
const isDark = computed(() => theme.value === 'dark')

function applyTheme(name) {
  theme.value = name
  // Mutually-exclusive theme classes on <html>. Light is the default
  // (no class); dark and autumn each get their own class.
  const root = document.documentElement
  root.classList.remove('dark', 'autumn')
  if (name === 'dark' || name === 'autumn') {
    root.classList.add(name)
  }
  localStorage.setItem('gmr-theme', name)
}

export function useTheme() {
  function setTheme(name) {
    if (THEMES.includes(name)) applyTheme(name)
  }

  /** Cycle through the three themes: light → dark → autumn → light. */
  function cycle() {
    const idx = THEMES.indexOf(theme.value)
    applyTheme(THEMES[(idx + 1) % THEMES.length])
  }

  /**
   * Backward-compat: code that called `toggle()` expected a light↔dark flip.
   * Preserved so existing tests and the ProfileDropdown's theme row keep
   * working without churn. New call sites should prefer `cycle()` or
   * `setTheme(name)`.
   */
  function toggle() {
    applyTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  /**
   * Read persisted preference (or fall back to OS preference) and apply it.
   * Call once on app mount — the anti-FOUC script in index.html already sets
   * the class synchronously, so this just syncs the reactive ref.
   */
  function init() {
    const saved = localStorage.getItem('gmr-theme')
    if (THEMES.includes(saved)) {
      applyTheme(saved)
      return
    }
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches
    applyTheme(prefersDark ? 'dark' : 'light')
  }

  return { theme, isDark, setTheme, cycle, toggle, init }
}
