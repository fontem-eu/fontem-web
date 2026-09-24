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
   * The menu is teleported to <body> so no ancestor's overflow or
   * transform can clip it (the rail's did, when it carried a gear).
   */
  it('teleports the menu out to <body>', async () => {
    const w = await mountMenu()
    const menu = await openMenu(w)
    expect(menu).not.toBeNull()
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
