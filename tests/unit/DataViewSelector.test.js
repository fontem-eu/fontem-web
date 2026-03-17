import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DataViewSelector from '../../src/components/DataViewSelector.vue'

const VIEWS = [
  { key: 'fundamentals', label: 'Fundamentals' },
  { key: 'gmr-long',     label: 'GMR Long'     },
]

function mountSelector(modelValue = 'fundamentals') {
  return mount(DataViewSelector, {
    props: { modelValue, views: VIEWS },
  })
}

describe('DataViewSelector', () => {
  it('renders all view labels', () => {
    const wrapper = mountSelector()
    expect(wrapper.text()).toContain('Fundamentals')
    expect(wrapper.text()).toContain('GMR Long')
  })

  it('renders one button per view', () => {
    const wrapper = mountSelector()
    expect(wrapper.findAll('button')).toHaveLength(VIEWS.length)
  })

  it('sets the correct data-testid on each button', () => {
    const wrapper = mountSelector()
    expect(wrapper.find('[data-testid="view-opt-fundamentals"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="view-opt-gmr-long"]').exists()).toBe(true)
  })

  it('applies the active class to the currently selected view', () => {
    const wrapper = mountSelector('fundamentals')
    const activeBtn = wrapper.find('[data-testid="view-opt-fundamentals"]')
    expect(activeBtn.classes()).toContain('gmr-view-sel__item--active')
  })

  it('does not apply the active class to non-selected views', () => {
    const wrapper = mountSelector('fundamentals')
    const inactiveBtn = wrapper.find('[data-testid="view-opt-gmr-long"]')
    expect(inactiveBtn.classes()).not.toContain('gmr-view-sel__item--active')
  })

  it('reflects a different active view when modelValue changes', () => {
    const wrapper = mountSelector('gmr-long')
    expect(wrapper.find('[data-testid="view-opt-gmr-long"]').classes()).toContain('gmr-view-sel__item--active')
    expect(wrapper.find('[data-testid="view-opt-fundamentals"]').classes()).not.toContain('gmr-view-sel__item--active')
  })

  it('emits update:modelValue with the key when an inactive button is clicked', async () => {
    const wrapper = mountSelector('fundamentals')
    await wrapper.find('[data-testid="view-opt-gmr-long"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['gmr-long'])
  })

  it('emits update:modelValue even when clicking the already-active button', async () => {
    const wrapper = mountSelector('fundamentals')
    await wrapper.find('[data-testid="view-opt-fundamentals"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['fundamentals'])
  })

  it('sets aria-current="page" on the active button only', () => {
    const wrapper = mountSelector('fundamentals')
    expect(wrapper.find('[data-testid="view-opt-fundamentals"]').attributes('aria-current')).toBe('page')
    expect(wrapper.find('[data-testid="view-opt-gmr-long"]').attributes('aria-current')).toBeUndefined()
  })

  it('has the view-selector testid on the nav', () => {
    const wrapper = mountSelector()
    expect(wrapper.find('[data-testid="view-selector"]').exists()).toBe(true)
  })
})
