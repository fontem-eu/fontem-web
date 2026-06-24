import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({
  dossierEffectiveAccess: vi.fn(),
  shareDossier: vi.fn(),
  revokeDossierAccess: vi.fn(),
}))

import DossierShareModal from '../../src/components/DossierShareModal.vue'
import { dossierEffectiveAccess, shareDossier, revokeDossierAccess } from '../../src/api/community.js'

const ACCESS = [
  { user_id: 'o', email: 'owner@x.io', level: 'owner', source: 'owner' },
  { user_id: 'c', email: 'mate@x.io', level: 'editor', source: 'inherited:contributor' },
  { user_id: 'x', email: 'guest@x.io', level: 'viewer', source: 'direct' },
]

async function mountModal() {
  dossierEffectiveAccess.mockResolvedValue(ACCESS)
  const w = mount(DossierShareModal, {
    props: { dossierId: 'd1' },
    global: { plugins: [makeTestI18n()] },
  })
  await flushPromises()
  return w
}

beforeEach(() => {
  dossierEffectiveAccess.mockReset()
  shareDossier.mockReset()
  revokeDossierAccess.mockReset()
})

describe('DossierShareModal', () => {
  it('lists who has access with the source, remove only on direct grants', async () => {
    const w = await mountModal()
    expect(w.find('[data-testid="share-access-o"]').exists()).toBe(true)
    expect(w.text()).toContain('owner@x.io')
    expect(w.text()).toContain('Investigation contributor') // inherited source label
    // only the direct grant (x) has a remove button
    expect(w.find('[data-testid="share-remove-x"]').exists()).toBe(true)
    expect(w.find('[data-testid="share-remove-o"]').exists()).toBe(false)
    expect(w.find('[data-testid="share-remove-c"]').exists()).toBe(false)
  })

  it('adds a direct grant', async () => {
    shareDossier.mockResolvedValue({ status: 'ok' })
    const w = await mountModal()
    await w.find('[data-testid="share-email-input"]').setValue('new@x.io')
    await w.find('[data-testid="share-level"]').setValue('editor')
    await w.find('[data-testid="share-add-btn"]').trigger('click')
    await flushPromises()
    expect(shareDossier).toHaveBeenCalledWith('d1', { email: 'new@x.io', level: 'editor' })
  })

  it('revokes a direct grant', async () => {
    revokeDossierAccess.mockResolvedValue({})
    const w = await mountModal()
    await w.find('[data-testid="share-remove-x"]').trigger('click')
    await flushPromises()
    expect(revokeDossierAccess).toHaveBeenCalledWith('d1', 'x')
  })
})
