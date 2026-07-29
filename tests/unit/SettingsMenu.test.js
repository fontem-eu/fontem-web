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
async function mountMenu(props = {}) {
  const w = mount(SettingsMenu, {
    props,
    global: { plugins: [makeTestI18n()] },
  })
  await flushPromises()
  return w
}

describe('SettingsMenu', () => {
  beforeEach(() => { _internal.clearForTests(); localStorage.clear() })
  afterEach(() => { _internal.clearForTests(); localStorage.clear(); vi.restoreAllMocks() })

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
    expect(w.find('[data-testid="settings-menu"]').exists()).toBe(false)
    await w.find('[data-testid="settings-trigger"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="settings-menu"]').exists()).toBe(true)
    expect(w.find('[data-testid="settings-theme"]').exists()).toBe(true)
    expect(w.find('[data-testid="settings-lang"]').exists()).toBe(true)
    expect(w.find('[data-testid="settings-palette"]').exists()).toBe(true)
  })

  it('offers all 24 EU languages', async () => {
    const w = await mountMenu()
    await w.find('[data-testid="settings-trigger"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="settings-lang"]').findAll('option')).toHaveLength(24)
  })

  it('persists an anonymous language pick to localStorage', async () => {
    const w = await mountMenu()
    await w.find('[data-testid="settings-trigger"]').trigger('click')
    await flushPromises()
    const select = w.find('[data-testid="settings-lang"]')
    await select.setValue('fr')
    await flushPromises()
    expect(localStorage.getItem('gmr-lang')).toBe('fr')
  })

  it('persists an anonymous theme flip to localStorage', async () => {
    const w = await mountMenu()
    await w.find('[data-testid="settings-trigger"]').trigger('click')
    await flushPromises()
    await w.find('[data-testid="settings-theme"]').trigger('click')
    await flushPromises()
    expect(['light', 'dark']).toContain(localStorage.getItem('gmr-theme'))
  })

  it('carries no account rows — identity lives in ProfileMenu', async () => {
    const w = await mountMenu()
    await w.find('[data-testid="settings-trigger"]').trigger('click')
    await flushPromises()
    const text = w.find('[data-testid="settings-menu"]').text().toLowerCase()
    expect(text).not.toContain('sign out')
    expect(text).not.toContain('delete account')
  })

  it('closes on Escape', async () => {
    const w = await mountMenu()
    await w.find('[data-testid="settings-trigger"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="settings-menu"]').exists()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(w.find('[data-testid="settings-menu"]').exists()).toBe(false)
  })
})
