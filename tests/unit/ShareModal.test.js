import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({
  getAccess: vi.fn(),
  grantAccess: vi.fn(),
  revokeAccess: vi.fn(),
  updateReport: vi.fn(),
  reportEffectiveAccess: vi.fn(),
}))

import ShareModal from '../../src/components/ShareModal.vue'
import { getAccess, reportEffectiveAccess } from '../../src/api/community.js'

beforeEach(() => {
  getAccess.mockReset(); reportEffectiveAccess.mockReset()
  getAccess.mockResolvedValue({ access: [], visibility: 'private' })
})

describe('ShareModal — who has access', () => {
  it('lists effective access with sources when opened', async () => {
    reportEffectiveAccess.mockResolvedValue([
      { user_id: 'o', email: 'owner@x.io', level: 'owner', source: 'owner' },
      { user_id: 'c', email: 'mate@x.io', level: 'editor', source: 'inherited:contributor' },
      { user_id: 'x', email: 'guest@x.io', level: 'viewer', source: 'direct' },
    ])
    const w = mount(ShareModal, {
      props: { reportId: 'r1', visible: false },
      global: { plugins: [makeTestI18n()] },
    })
    await w.setProps({ visible: true })  // the watcher fetches on open (false -> true)
    await flushPromises()
    // ShareModal teleports to <body>, so query the document
    expect(document.querySelector('[data-testid="report-effective-access"]')).toBeTruthy()
    expect(document.querySelector('[data-testid="report-access-c"]')).toBeTruthy()
    expect(document.body.textContent).toContain('Investigation contributor')
    expect(document.body.textContent).toContain('Shared directly')
    w.unmount()
  })
})
