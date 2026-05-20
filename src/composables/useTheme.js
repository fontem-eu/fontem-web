import { computed, ref } from 'vue'

/**
 * Theme singleton.  Two modes: 'light' (cream + rose, the default) and
 * 'dark' (warm near-black + rose).  Earlier 'autumn' saved values are
 * mapped to 'light' on load — the autumn palette *became* the light
 * palette after the rebrand.
 */
export const THEMES = ['light', 'dark']

const theme = ref('light')
// Backward-compat: existing code reads isDark.
const isDark = computed(() => theme.value === 'dark')

function applyTheme(name) {
  theme.value = name
  const root = document.documentElement
  root.classList.remove('dark', 'autumn')
  if (name === 'dark') root.classList.add('dark')
  localStorage.setItem('gmr-theme', name)
}

function normalizeSaved(raw) {
  // Migration: anything that's not 'dark' (including the now-retired
  // 'autumn' and the old stark-white 'light') collapses into the new
  // warm 'light'.
  if (raw === 'dark') return 'dark'
  if (raw === 'light' || raw === 'autumn') return 'light'
  return null // unknown → fall back to OS preference
}

function setTheme(name) {
  if (THEMES.includes(name)) applyTheme(name)
}

function toggle() {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark')
}

/**
 * Read persisted preference (or fall back to OS preference) and apply
 * it.  The anti-FOUC script in index.html has already set the class
 * synchronously; this mainly syncs the reactive ref and migrates any
 * legacy 'autumn' value to 'light'.
 */
function init() {
  const saved = normalizeSaved(localStorage.getItem('gmr-theme'))
  if (saved !== null) {
    applyTheme(saved)
    return
  }
  const prefersDark =
    globalThis.window?.matchMedia?.('(prefers-color-scheme: dark)').matches
  applyTheme(prefersDark ? 'dark' : 'light')
}

export function useTheme() {
  return { theme, isDark, setTheme, toggle, init }
}
