/**
 * MultiSelect component tests — shared dropdown used for node/edge type filters.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MultiSelect from '../../src/components/MultiSelect.vue'

function mountMs(props = {}) {
  return mount(MultiSelect, {
    props: {
      label: 'Nodes',
      modelValue: { Company: true, Contract: true, Person: false },
      colors: { Company: '#3b82f6', Contract: '#f59e0b' },
      ...props,
    },
    attachTo: document.body,
  })
}

describe('MultiSelect', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a trigger button with label and count', () => {
    const wrapper = mountMs()
    const trigger = wrapper.find('[data-testid="ms-trigger-nodes"]')
    expect(trigger.exists()).toBe(true)
    expect(trigger.text()).toContain('Nodes')
    expect(trigger.text()).toContain('2/3') // 2 checked out of 3
    wrapper.unmount()
  })

  it('dropdown is hidden by default', () => {
    const wrapper = mountMs()
    expect(wrapper.find('[data-testid="ms-dropdown"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('clicking trigger opens the dropdown', async () => {
    const wrapper = mountMs()
    await wrapper.find('[data-testid="ms-trigger-nodes"]').trigger('click')
    expect(wrapper.find('[data-testid="ms-dropdown"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('dropdown lists all items with checkboxes', async () => {
    const wrapper = mountMs()
    await wrapper.find('[data-testid="ms-trigger-nodes"]').trigger('click')
    const items = wrapper.findAll('.ms__item')
    expect(items).toHaveLength(3)
    // Company and Contract are checked, Person is not
    const checkboxes = wrapper.findAll('.ms__item input[type="checkbox"]')
    expect(checkboxes[0].element.checked).toBe(true)  // Company
    expect(checkboxes[1].element.checked).toBe(true)  // Contract
    expect(checkboxes[2].element.checked).toBe(false)  // Person
    wrapper.unmount()
  })

  it('toggling a checkbox emits update:modelValue', async () => {
    const wrapper = mountMs()
    await wrapper.find('[data-testid="ms-trigger-nodes"]').trigger('click')
    // Uncheck Company
    const checkbox = wrapper.find('[data-testid="ms-item-company"] input')
    await checkbox.trigger('change')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted[0][0]).toEqual({ Company: false, Contract: true, Person: false })
    wrapper.unmount()
  })

  it('"All" button checks all items', async () => {
    const wrapper = mountMs({ modelValue: { A: false, B: false } })
    await wrapper.find('[data-testid="ms-trigger-nodes"]').trigger('click')
    await wrapper.find('[data-testid="ms-all"]').trigger('click')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted[0][0]).toEqual({ A: true, B: true })
    wrapper.unmount()
  })

  it('"None" button unchecks all items', async () => {
    const wrapper = mountMs({ modelValue: { A: true, B: true } })
    await wrapper.find('[data-testid="ms-trigger-nodes"]').trigger('click')
    await wrapper.find('[data-testid="ms-none"]').trigger('click')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted[0][0]).toEqual({ A: false, B: false })
    wrapper.unmount()
  })

  it('shows color dots when colors prop is provided', async () => {
    const wrapper = mountMs()
    await wrapper.find('[data-testid="ms-trigger-nodes"]').trigger('click')
    const dots = wrapper.findAll('.ms__dot')
    // Company and Contract have colors, Person does not
    expect(dots.length).toBe(2)
    wrapper.unmount()
  })

  it('clicking outside closes the dropdown', async () => {
    const wrapper = mountMs()
    await wrapper.find('[data-testid="ms-trigger-nodes"]').trigger('click')
    expect(wrapper.find('[data-testid="ms-dropdown"]').exists()).toBe(true)

    // Click outside
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(wrapper.find('[data-testid="ms-dropdown"]').exists()).toBe(false)
    document.body.removeChild(outside)
    wrapper.unmount()
  })
})
