import { ref } from 'vue'

// Module-level singleton so all components share the same reactive state.
const isDark = ref(false)

export function useTheme() {
  function applyTheme(dark) {
    isDark.value = dark
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('gmr-theme', dark ? 'dark' : 'light')
  }

  function toggle() {
    applyTheme(!isDark.value)
  }

  /**
   * Read persisted preference (or fall back to OS preference) and apply it.
   * Call once on app mount — the anti-FOUC script in index.html already sets
   * the class synchronously, so this just syncs the reactive ref.
   */
  function init() {
    const saved = localStorage.getItem('gmr-theme')
    if (saved !== null) {
      applyTheme(saved === 'dark')
    } else {
      const prefersDark =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches
      applyTheme(Boolean(prefersDark))
    }
  }

  return { isDark, toggle, init }
}
