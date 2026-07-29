import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { makeTestI18n } from './helpers/i18n.js'
import { _internal } from '../../src/api/session.js'
import SettingsMenu from '../../src/components/SettingsMenu.vue'

/**
 * The regression these guard: display preferences were folded into the
 * signed-in-only profile surface (5dd542d), leaving anonymous visitors
 * with no way to change language. Every case below therefore runs with
 * NO session token — if any of them starts needing one, the regression
 * is back.
 */
const wrappers = []

async function mountMenu(props = {}) {
  const w = mount(SettingsMenu, {
    props,
    global: { plugins: [makeTestI18n()] },
  })
  wrappers.push(w)
  await flushPromises()
  return w
}

/**
 * The menu is teleported to <body>, so it is NOT inside the wrapper's
 * subtree and `wrapper.find` will never see it. Everything that inspects
 * the open menu has to go through the document.
 */
function menuEl() {
  return document.body.querySelector('[data-testid="settings-menu"]')
}
function inMenu(sel) {
  return menuEl()?.querySelector(sel) ?? null
}
async function openMenu(w, trigger = 'settings-trigger') {
  await w.find(`[data-testid="${trigger}"]`).trigger('click')
  await flushPromises()
  return menuEl()
}

describe('SettingsMenu', () => {
  beforeEach(() => { _internal.clearForTests(); localStorage.clear() })
  afterEach(() => {
    // Unmount so Vue removes the teleported node; otherwise menus pile
    // up in <body> and later tests match a stale one.
    while (wrappers.length) wrappers.pop().unmount()
    document.body.innerHTML = ''
    _internal.clearForTests(); localStorage.clear(); vi.restoreAllMocks()
  })

  it('renders the header gear for an anonymous visitor', async () => {
    const w = await mountMenu()
    expect(w.find('[data-testid="settings-trigger"]').exists()).toBe(true)
  })

  it('renders the rail gear for an anonymous visitor', async () => {
    const w = await mountMenu({ placement: 'rail' })
    expect(w.find('[data-testid="rail-settings"]').exists()).toBe(true)
  })

  it('opens theme + language + palette with no session', async () => {
    const w = await mountMenu()
    expect(menuEl()).toBeNull()
    await openMenu(w)
    expect(menuEl()).not.toBeNull()
    expect(inMenu('[data-testid="settings-theme"]')).not.toBeNull()
    expect(inMenu('[data-testid="settings-lang"]')).not.toBeNull()
    expect(inMenu('[data-testid="settings-palette"]')).not.toBeNull()
  })

  it('offers all 24 EU languages', async () => {
    const w = await mountMenu()
    await openMenu(w)
    expect(inMenu('[data-testid="settings-lang"]').querySelectorAll('option')).toHaveLength(24)
  })

  it('persists an anonymous language pick to localStorage', async () => {
    const w = await mountMenu()
    await openMenu(w)
    const select = inMenu('[data-testid="settings-lang"]')
    select.value = 'fr'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    expect(localStorage.getItem('gmr-lang')).toBe('fr')
  })

  it('persists an anonymous theme flip to localStorage', async () => {
    const w = await mountMenu()
    await openMenu(w)
    inMenu('[data-testid="settings-theme"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(['light', 'dark']).toContain(localStorage.getItem('gmr-theme'))
  })

  it('carries no account rows — identity lives in ProfileMenu', async () => {
    const w = await mountMenu()
    await openMenu(w)
    const text = menuEl().textContent.toLowerCase()
    expect(text).not.toContain('sign out')
    expect(text).not.toContain('delete account')
  })

  /**
   * Regression: RailIcon's sizing lived only in AppSidebar's *scoped*
   * style, so rendering it from SettingsMenu dropped the rule entirely
   * and the SVG fell back to the default replaced-element size — a gear
   * several times the size of every other rail icon. The dimensions are
   * intrinsic attributes now, which is what makes this assertable.
   */
  it('renders the rail gear at the same 20px as every other rail icon', async () => {
    const w = await mountMenu({ placement: 'rail' })
    const svg = w.find('[data-testid="rail-settings"] svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('width')).toBe('20')
    expect(svg.attributes('height')).toBe('20')
  })

  /**
   * Regression: the popover was clipped on mobile. `.rail` sets
   * `overflow-y: auto` (which forces overflow-x to `auto` too) and, below
   * 900px, `transform: translateX(...)` for the drawer slide — and a
   * transformed ancestor becomes the containing block for `position:
   * fixed` descendants, so even fixed positioning stayed trapped inside
   * the rail. The menu is teleported to <body> so nothing between it and
   * the document root can hide it.
   */
  it.each(['header', 'rail'])('teleports the %s menu out to <body>', async (placement) => {
    const trigger = placement === 'rail' ? 'rail-settings' : 'settings-trigger'
    const w = await mountMenu({ placement })
    const menu = await openMenu(w, trigger)
    expect(menu).not.toBeNull()
    // Not nested inside the component's own subtree — that subtree is
    // what the rail clips.
    expect(w.element.contains(menu)).toBe(false)
    expect(menu.style.position).toBe('fixed')
  })

  it('keeps the menu open when clicking inside it', async () => {
    // The teleport moves the menu out of the component subtree, so an
    // outside-click handler that only checked the root would treat the
    // language picker as "outside" and close on first interaction.
    const w = await mountMenu()
    const menu = await openMenu(w)
    menu.querySelector('[data-testid="settings-lang"]').dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    )
    await flushPromises()
    expect(document.body.querySelector('[data-testid="settings-menu"]')).not.toBeNull()
  })

  it('closes on Escape', async () => {
    const w = await mountMenu()
    await openMenu(w)
    expect(menuEl()).not.toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(menuEl()).toBeNull()
  })
})
