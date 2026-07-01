import { ref, computed } from 'vue'

const KEY = 'fontem-sidebar-collapsed'
const _read = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }

// Module-level state + operations (they only touch these refs, so they live at
// module scope — one instance shared across every useSidebar() caller).
const collapsed = ref(_read())
const mobileOpen = ref(false)

function toggleCollapsed() {
  collapsed.value = !collapsed.value
  try { localStorage.setItem(KEY, collapsed.value ? '1' : '0') } catch { /* quota */ }
}
function openMobile() { mobileOpen.value = true }
function closeMobile() { mobileOpen.value = false }
function toggleMobile() { mobileOpen.value = !mobileOpen.value }

const collapsedRO = computed(() => collapsed.value)
const mobileOpenRO = computed(() => mobileOpen.value)

export function useSidebar() {
  return {
    collapsed: collapsedRO,
    mobileOpen: mobileOpenRO,
    toggleCollapsed, openMobile, closeMobile, toggleMobile,
  }
}
