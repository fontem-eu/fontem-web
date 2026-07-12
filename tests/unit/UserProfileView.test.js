/**
 * UserProfileView — renders a public author profile: identity + summary +
 * links (left), articles + recent activity (right), initials when no avatar.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({
  getUserProfile: vi.fn(),
  updateMyProfile: vi.fn(),
  uploadAvatar: vi.fn(),
}))
vi.mock('../../src/api/session.js', () => ({
  currentUser: { value: null },  // viewer is not the profile owner
  setSessionAvatar: vi.fn(),
  setSessionName: vi.fn(),
}))
vi.mock('../../src/api/geo.js', () => ({
  fetchNutsRegions: vi.fn().mockResolvedValue({
    regions: [
      { code: 'PT', name: 'Portugal', level: 0 },
      { code: 'PT1', name: 'Continente', level: 1 },
      { code: 'PT17', name: 'Lisboa', level: 2 },
    ],
  }),
  fetchClientRegion: vi.fn().mockResolvedValue({ country_alpha3: 'PRT', nuts0: 'PT' }),
}))

import UserProfileView from '../../src/views/UserProfileView.vue'
import { getUserProfile, uploadAvatar, updateMyProfile } from '../../src/api/community.js'
import { currentUser } from '../../src/api/session.js'

const PROFILE = {
  id: 'u1',
  name: 'Bernardo Marques',
  avatar_url: null,
  trust_level: 'contributor',
  created_at: '2026-01-15T00:00:00Z',
  summary: 'Follows the money.',
  links: [{ name: 'Site', url: 'https://s.io' }],
  articles: [
    { id: 'a1', title: 'Money trail', abstract: 'x',
      visibility: 'public_open', created_at: '2026-02-01T00:00:00Z' },
  ],
  recent_activity: [
    { entity_type: 'story', entity_id: 'a1', action: 'created',
      summary: 'Money trail', created_at: '2026-02-01T00:00:00Z' },
  ],
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/users/:id', component: UserProfileView },
      { path: '/stories/:id', component: { template: '<div />' } },
    ],
  })
}

async function mountAt(id = 'u1') {
  const router = makeRouter()
  router.push(`/users/${id}`)
  await router.isReady()
  const w = mount(UserProfileView, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises()
  return w
}

describe('UserProfileView', () => {
  it('renders name, summary, links, articles, activity + initials fallback', async () => {
    getUserProfile.mockResolvedValue(PROFILE)
    const w = await mountAt()
    expect(w.find('[data-testid="profile-name"]').text()).toBe('Bernardo Marques')
    expect(w.find('[data-testid="profile-summary"]').text()).toContain('Follows the money.')
    expect(w.find('[data-testid="profile-links"]').text()).toContain('Site')
    expect(w.find('[data-testid="profile-articles"]').text()).toContain('Money trail')
    expect(w.find('[data-testid="profile-activity"]').text()).toContain('Money trail')
    // no avatar_url -> initials "BM"
    expect(w.find('[data-testid="user-avatar-initials"]').text()).toBe('BM')
    // viewer is not the owner -> no edit affordance
    expect(w.find('[data-testid="profile-edit-btn"]').exists()).toBe(false)
  })

  it('shows a not-found message on 404', async () => {
    getUserProfile.mockRejectedValue({ status: 404 })
    const w = await mountAt('ghost')
    expect(w.find('[data-testid="profile-not-found"]').exists()).toBe(true)
  })

  it('links the article to its story page', async () => {
    getUserProfile.mockResolvedValue(PROFILE)
    const w = await mountAt()
    const link = w.find('[data-testid="profile-articles"] a')
    expect(link.attributes('href')).toContain('/stories/a1')
  })

  it('own profile: edit form has name + email settings; save sends them', async () => {
    getUserProfile.mockResolvedValue({
      ...PROFILE, id: 'u1', name: 'Old Name', email: '', account_email: 'me@acct.io',
      show_email: false, use_custom_email: false, custom_email: '',
    })
    updateMyProfile.mockResolvedValue({
      name: 'New Name', summary: 'Follows the money.', links: PROFILE.links,
      avatar_x: 50, avatar_y: 50, show_email: true, use_custom_email: true,
      custom_email: 'pub@x.io',
    })
    currentUser.value = { id: 'u1' }
    try {
      const w = await mountAt('u1')
      await w.find('[data-testid="profile-edit-btn"]').trigger('click')
      // name input prefilled
      expect(w.find('[data-testid="profile-edit-name"]').element.value).toBe('Old Name')
      await w.find('[data-testid="profile-edit-name"]').setValue('New Name')
      // display-email off -> custom fields hidden
      expect(w.find('[data-testid="profile-custom-email"]').exists()).toBe(false)
      await w.find('[data-testid="profile-show-email"]').setValue(true)
      // now the use-different-email + custom input appear
      await w.find('[data-testid="profile-use-custom-email"]').setValue(true)
      await w.find('[data-testid="profile-custom-email"]').setValue('pub@x.io')
      await w.find('[data-testid="profile-edit-form"]').trigger('submit')
      await flushPromises()
      expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Name', show_email: true, use_custom_email: true, custom_email: 'pub@x.io',
      }))
    } finally {
      currentUser.value = null
    }
  })

  it('own profile: exposes avatar upload + reposition; upload sets the avatar', async () => {
    getUserProfile.mockResolvedValue({ ...PROFILE, avatar_url: 'https://img/a.png' })
    uploadAvatar.mockResolvedValue({ avatar_url: 'https://img/new.png' })
    currentUser.value = { id: 'u1' } // viewer IS the profile owner
    try {
      const w = await mountAt('u1')
      expect(w.find('[data-testid="profile-avatar-input"]').exists()).toBe(true)
      expect(w.find('[data-testid="profile-reposition"]').exists()).toBe(true)
      const input = w.find('[data-testid="profile-avatar-input"]')
      const file = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })
      Object.defineProperty(input.element, 'files', { value: [file] })
      await input.trigger('change')
      await flushPromises()
      expect(uploadAvatar).toHaveBeenCalled()
    } finally {
      currentUser.value = null
    }
  })

  it('shows the owner\'s home region by descriptive name (view mode)', async () => {
    getUserProfile.mockResolvedValue({ ...PROFILE, home_nuts: 'PT17' })
    const w = await mountAt('u1')
    const line = w.find('[data-testid="profile-home-region"]')
    expect(line.exists()).toBe(true)
    expect(line.text()).toContain('Lisboa')   // resolved from the region map, not the code
    expect(line.text()).not.toContain('PT17')
  })

  it('own profile: the where-you-from picker sends home_nuts on save', async () => {
    getUserProfile.mockResolvedValue({ ...PROFILE, id: 'u1', home_nuts: '' })
    updateMyProfile.mockResolvedValue({
      name: PROFILE.name, summary: PROFILE.summary, links: PROFILE.links, home_nuts: 'PT',
    })
    currentUser.value = { id: 'u1' }
    try {
      const w = await mountAt('u1')
      await w.find('[data-testid="profile-edit-btn"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-testid="nuts-picker"]').exists()).toBe(true)
      await w.find('[data-testid="nuts-l0"]').setValue('PT')
      await w.find('[data-testid="profile-edit-form"]').trigger('submit')
      await flushPromises()
      expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ home_nuts: 'PT' }))
    } finally {
      currentUser.value = null
    }
  })
})
