/**
 * ErrataIcon: a clickable "modified" marker shown next to a contract's
 * value when it carries a before→after change.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k) => k }) }))

import ErrataIcon from '../../src/components/ErrataIcon.vue'

describe('ErrataIcon', () => {
  it('renders a clickable button with an svg glyph', () => {
    const w = mount(ErrataIcon)
    expect(w.find('[data-testid="errata-icon"]').exists()).toBe(true)
    expect(w.find('button[type="button"]').exists()).toBe(true)
    expect(w.find('svg').exists()).toBe(true)
  })

  it('emits click when pressed', async () => {
    const w = mount(ErrataIcon)
    await w.find('[data-testid="errata-icon"]').trigger('click')
    expect(w.emitted('click')).toHaveLength(1)
  })
})
