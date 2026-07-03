import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('../../src/api/studio.js', async () => (await import('./helpers/studioApiMock.js')).makeStudioApiMock())
vi.mock('../../src/api/community.js', () => ({ listInvestigations: vi.fn() }))

import * as api from '../../src/api/studio.js'
import { listInvestigations } from '../../src/api/community.js'
import { useStudio } from '../../src/composables/useStudio.js'
import StudioShareModal from '../../src/components/StudioShareModal.vue'

const stubs = { teleport: { template: '<div><slot /></div>' } }

describe('StudioShareModal', () => {
  beforeEach(() => { api.__reset(); useStudio().reset(); listInvestigations.mockReset() })

  it('offers only contributor+ investigations and attaches', async () => {
    api.__seed([{ id: 'p1', name: 'Corruption', created_by: 'u', investigation_id: null, queries: [], plots: [] }])
    listInvestigations.mockResolvedValue([
      { id: 'inv1', name: 'Panama', membership: { role: 'contributor' } },
      { id: 'inv2', name: 'ReadOnly', membership: { role: 'viewer' } },
    ])
    const w = mount(StudioShareModal, {
      props: { project: { id: 'p1', name: 'Corruption', investigation_id: null } },
      global: { stubs },
    })
    await flushPromises()
    const opts = w.find('[data-testid="studio-attach-select"]').findAll('option').map((o) => o.text())
    expect(opts).toContain('Panama')
    expect(opts).not.toContain('ReadOnly')
    await w.find('[data-testid="studio-attach-select"]').setValue('inv1')
    await w.find('[data-testid="studio-attach"]').trigger('click'); await flushPromises()
    expect(api.attachProject).toHaveBeenCalledWith('p1', 'inv1')
  })

  it('shares by email then revokes the grant', async () => {
    api.__seed([{ id: 'p1', name: 'Corruption', created_by: 'u', investigation_id: null, queries: [], plots: [] }])
    listInvestigations.mockResolvedValue([])
    const w = mount(StudioShareModal, {
      props: { project: { id: 'p1', name: 'Corruption', investigation_id: null } },
      global: { stubs },
    })
    await flushPromises()
    await w.find('[data-testid="studio-share-email"]').setValue('ana@fontem.eu')
    await w.find('[data-testid="studio-share-level"]').setValue('editor')
    await w.find('[data-testid="studio-share-add"]').trigger('click'); await flushPromises()
    expect(api.shareProject).toHaveBeenCalledWith('p1', { email: 'ana@fontem.eu', level: 'editor' })
    expect(w.find('[data-testid="studio-grant"]').text()).toContain('ana@fontem.eu')
    await w.find('[data-testid="studio-grant-remove"]').trigger('click'); await flushPromises()
    expect(api.revokeProjectAccess).toHaveBeenCalled()
  })

  it('shows detach when already attached', async () => {
    api.__seed([{ id: 'p1', name: 'C', created_by: 'u', investigation_id: 'inv1', queries: [], plots: [] }])
    listInvestigations.mockResolvedValue([{ id: 'inv1', name: 'Panama', membership: { role: 'admin' } }])
    const w = mount(StudioShareModal, {
      props: { project: { id: 'p1', name: 'C', investigation_id: 'inv1' } },
      global: { stubs },
    })
    await flushPromises()
    expect(w.find('[data-testid="studio-attached"]').text()).toContain('Panama')
    await w.find('[data-testid="studio-detach"]').trigger('click'); await flushPromises()
    expect(api.detachProject).toHaveBeenCalledWith('p1')
  })
})
