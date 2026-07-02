/**
 * ContractModificationModal: the before→after errata view. Teleport is
 * stubbed inline so the mounted wrapper can query the modal DOM.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k) => k }) }))

import ContractModificationModal from '../../src/components/ContractModificationModal.vue'

const MODIF = {
  title: 'Road works',
  value_currency: 'EUR',
  value_before_eur: 1092.3, value_before_original: 1092.3,
  value_eur: 2184.6, value_original: 2184.6,
  modifies_publication_number: '061165-2023',
}

function mountModal(props = {}) {
  return mount(ContractModificationModal, {
    props: { visible: true, contract: MODIF, ...props },
    global: { stubs: { teleport: true } },
  })
}

describe('ContractModificationModal', () => {
  it('renders nothing when not visible', () => {
    const w = mountModal({ visible: false })
    expect(w.find('[data-testid="errata-backdrop"]').exists()).toBe(false)
  })

  it('renders nothing without a contract', () => {
    const w = mountModal({ contract: null })
    expect(w.find('[data-testid="errata-backdrop"]').exists()).toBe(false)
  })

  it('shows the before→after table with the % change', () => {
    const w = mountModal()
    const table = w.find('[data-testid="errata-table"]')
    expect(table.exists()).toBe(true)
    // 1092.3 → 2184.6 is +100%
    expect(table.text()).toContain('+100%')
  })

  it('links the modified original notice by publication-number', () => {
    const w = mountModal()
    const link = w.find('[data-testid="errata-modifies-link"]')
    expect(link.attributes('href')).toBe(
      'https://ted.europa.eu/en/notice/-/detail/061165-2023',
    )
  })

  it('marks a value increase as a red (up) change', () => {
    const w = mountModal()
    expect(w.find('.em-up').exists()).toBe(true)
    expect(w.find('.em-down').exists()).toBe(false)
  })

  it('emits close from the close button', async () => {
    const w = mountModal()
    await w.find('.em-close').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})
