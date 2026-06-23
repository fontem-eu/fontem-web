import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { _internal } from '../../src/api/session.js'

vi.mock('../../src/api/community.js', () => ({
  listInvestigations: vi.fn(),
  createVisualization: vi.fn(),
}))

import PocketButton from '../../src/components/PocketButton.vue'
import { listInvestigations, createVisualization } from '../../src/api/community.js'

const PROPS = {
  widgetType: 'chart_snapshot',
  config: { entityId: 'AAPL' },
  defaultName: 'AAPL snapshot',
  // a captureTarget switches PocketButton into the ⋮ menu mode
  captureTarget: () => document.createElement('div'),
}

beforeEach(() => {
  _internal.clearForTests?.()
  localStorage.clear()
  listInvestigations.mockReset()
  createVisualization.mockReset()
})

describe('PocketButton — Add to investigation', () => {
  it('lists writable investigations and saves the viz server-side', async () => {
    listInvestigations.mockResolvedValue([
      { id: 'inv-w', name: 'Writable', membership: { role: 'owner' } },
      { id: 'inv-v', name: 'ViewerOnly', membership: { role: 'viewer' } },
    ])
    createVisualization.mockResolvedValue({ id: 'v1' })
    const w = mount(PocketButton, { props: PROPS })

    await w.find('[data-testid="pocket-menu-btn"]').trigger('click')
    await w.find('[data-testid="pocket-add-investigation-btn"]').trigger('click')
    await flushPromises()

    expect(w.find('[data-testid="pocket-inv-picker"]').exists()).toBe(true)
    // only investigations with add-viz capability are offered
    expect(w.find('[data-testid="pocket-inv-pick-inv-w"]').exists()).toBe(true)
    expect(w.find('[data-testid="pocket-inv-pick-inv-v"]').exists()).toBe(false)

    await w.find('[data-testid="pocket-inv-pick-inv-w"]').trigger('click')
    await flushPromises()
    expect(createVisualization).toHaveBeenCalledWith(expect.objectContaining({
      widget_type: 'chart_snapshot',
      investigation_id: 'inv-w',
      config: expect.objectContaining({ entityId: 'AAPL' }),
    }))
    expect(w.find('[data-testid="pocket-inv-picker"]').exists()).toBe(false)
  })
})
