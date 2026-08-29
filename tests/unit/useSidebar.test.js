import { describe, it, expect, beforeEach } from 'vitest'
import { useSidebar } from '../../src/composables/useSidebar.js'

describe('useSidebar', () => {
  beforeEach(() => { localStorage.clear() })
  it('toggleCollapsed flips + persists', () => {
    const s = useSidebar()
    const before = s.collapsed.value
    s.toggleCollapsed()
    expect(s.collapsed.value).toBe(!before)
    expect(localStorage.getItem('fontem-sidebar-collapsed')).toBe(s.collapsed.value ? '1' : '0')
    s.toggleCollapsed()
    expect(s.collapsed.value).toBe(before)
  })
  it('mobile open/close/toggle', () => {
    const s = useSidebar()
    s.closeMobile(); expect(s.mobileOpen.value).toBe(false)
    s.openMobile(); expect(s.mobileOpen.value).toBe(true)
    s.toggleMobile(); expect(s.mobileOpen.value).toBe(false)
    s.toggleMobile(); expect(s.mobileOpen.value).toBe(true)
    s.closeMobile()
  })
})

// ── Mutation-hardening: persistence key + toggle semantics ─────────
describe('useSidebar persistence', () => {
  it('persists collapse state under fontem-sidebar-collapsed as 1/0', () => {
    const { collapsed, toggleCollapsed } = useSidebar()
    const before = collapsed.value
    toggleCollapsed()
    expect(collapsed.value).toBe(!before)
    expect(localStorage.getItem('fontem-sidebar-collapsed')).toBe(collapsed.value ? '1' : '0')
    toggleCollapsed()
    expect(collapsed.value).toBe(before)
    expect(localStorage.getItem('fontem-sidebar-collapsed')).toBe(collapsed.value ? '1' : '0')
  })

  it('mobile drawer opens, closes and toggles', () => {
    const s = useSidebar()
    s.closeMobile()
    expect(s.mobileOpen.value).toBe(false)
    s.openMobile()
    expect(s.mobileOpen.value).toBe(true)
    s.toggleMobile()
    expect(s.mobileOpen.value).toBe(false)
    s.toggleMobile()
    expect(s.mobileOpen.value).toBe(true)
    s.closeMobile()
    expect(s.mobileOpen.value).toBe(false)
  })
})
