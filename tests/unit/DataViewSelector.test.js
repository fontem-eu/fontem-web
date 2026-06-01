import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DataViewSelector from '../../src/components/DataViewSelector.vue'

const GROUPS = [
  {
    key: 'overview', label: 'Overview',
    views: [{ key: 'profile', label: 'Profile' }],
  },
  {
    key: 'financials', label: 'Financials',
    views: [
      { key: 'fundamentals', label: 'Fundamentals' },
      { key: 'income', label: 'Income' },
    ],
  },
  {
    key: 'analysis', label: 'Analysis',
    views: [{ key: 'gmr-long', label: 'GMR Long' }],
  },
]

function mountSelector(modelValue = 'profile') {
  return mount(DataViewSelector, {
    props: { modelValue, groups: GROUPS },
  })
}

describe('DataViewSelector — grouped navigation', () => {
  it('has the view-selector testid', () => {
    const wrapper = mountSelector()
    expect(wrapper.find('[data-testid="view-selector"]').exists()).toBe(true)
  })

  it('renders category buttons', () => {
    const wrapper = mountSelector()
    expect(wrapper.find('[data-testid="view-cat-overview"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="view-cat-financials"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="view-cat-analysis"]').exists()).toBe(true)
  })

  it('highlights the active category based on the current view', () => {
    const wrapper = mountSelector('fundamentals')
    expect(wrapper.find('[data-testid="view-cat-financials"]').classes()).toContain('dvs-cat--active')
    expect(wrapper.find('[data-testid="view-cat-overview"]').classes()).not.toContain('dvs-cat--active')
  })

  it('shows sub-views for the active category', () => {
    const wrapper = mountSelector('fundamentals')
    expect(wrapper.find('[data-testid="view-opt-fundamentals"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="view-opt-income"]').exists()).toBe(true)
  })

  it('applies active class to the selected sub-view', () => {
    const wrapper = mountSelector('fundamentals')
    expect(wrapper.find('[data-testid="view-opt-fundamentals"]').classes()).toContain('dvs-view--active')
    expect(wrapper.find('[data-testid="view-opt-income"]').classes()).not.toContain('dvs-view--active')
  })

  it('emits update:modelValue when clicking a sub-view', async () => {
    const wrapper = mountSelector('fundamentals')
    await wrapper.find('[data-testid="view-opt-income"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['income'])
  })

  it('clicking a category emits its first sub-view key', async () => {
    const wrapper = mountSelector('profile')
    await wrapper.find('[data-testid="view-cat-financials"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['fundamentals'])
  })

  it('sets aria-current on the active sub-view only', () => {
    const wrapper = mountSelector('fundamentals')
    expect(wrapper.find('[data-testid="view-opt-fundamentals"]').attributes('aria-current')).toBe('page')
    expect(wrapper.find('[data-testid="view-opt-income"]').attributes('aria-current')).toBeUndefined()
  })

  it('renders the GMR Long info icon', () => {
    const wrapper = mountSelector('gmr-long')
    expect(wrapper.find('[data-testid="gmr-long-info"]').exists()).toBe(true)
  })

  it('renders mobile dropdown button', () => {
    const wrapper = mountSelector()
    expect(wrapper.find('[data-testid="view-dropdown-btn"]').exists()).toBe(true)
  })

  it('mobile dropdown shows current view label with category', () => {
    const wrapper = mountSelector('fundamentals')
    const btn = wrapper.find('[data-testid="view-dropdown-btn"]')
    expect(btn.text()).toContain('Financials')
    expect(btn.text()).toContain('Fundamentals')
  })

  it('mobile dropdown opens on click', async () => {
    const wrapper = mountSelector()
    expect(wrapper.find('[data-testid="view-dropdown"]').exists()).toBe(false)
    await wrapper.find('[data-testid="view-dropdown-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="view-dropdown"]').exists()).toBe(true)
  })

  it('mobile dropdown emits and closes on selection', async () => {
    const wrapper = mountSelector()
    await wrapper.find('[data-testid="view-dropdown-btn"]').trigger('click')
    await wrapper.find('[data-testid="view-opt-income"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['income'])
    expect(wrapper.find('[data-testid="view-dropdown"]').exists()).toBe(false)
  })
})

// ── Disabled groups (item 4: financials tab off when no data) ────
describe('DataViewSelector — disabled groups', () => {
  const DISABLED_GROUPS = [
    { key: 'overview', label: 'Overview', views: [{ key: 'profile', label: 'Profile' }] },
    {
      key: 'financials', label: 'Financials',
      disabled: true,
      disabledReason: 'No financial data available for this entity.',
      views: [
        { key: 'fundamentals', label: 'Fundamentals' },
        { key: 'income',       label: 'Income' },
      ],
    },
  ]

  function mountDisabled(modelValue = 'profile') {
    return mount(DataViewSelector, {
      props: { modelValue, groups: DISABLED_GROUPS },
    })
  }

  it('greys out a category button when the group is disabled', () => {
    const wrapper = mountDisabled()
    const cat = wrapper.find('[data-testid="view-cat-financials"]')
    expect(cat.classes()).toContain('dvs-cat--disabled')
    expect(cat.attributes('disabled')).toBeDefined()
    expect(cat.attributes('aria-disabled')).toBe('true')
  })

  it('shows the disabledReason as the button tooltip', () => {
    const wrapper = mountDisabled()
    const cat = wrapper.find('[data-testid="view-cat-financials"]')
    expect(cat.attributes('title')).toBe('No financial data available for this entity.')
  })

  it('does NOT emit update:modelValue when a disabled category is clicked', async () => {
    const wrapper = mountDisabled()
    await wrapper.find('[data-testid="view-cat-financials"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('still renders the disabled category (it is not removed)', () => {
    // Regression: an earlier draft hid the category entirely; the
    // user specifically asked for it to be shown but greyed out.
    const wrapper = mountDisabled()
    expect(wrapper.find('[data-testid="view-cat-financials"]').exists()).toBe(true)
  })

  it('greys out the matching items in the mobile dropdown', async () => {
    const wrapper = mountDisabled()
    await wrapper.find('[data-testid="view-dropdown-btn"]').trigger('click')
    const item = wrapper.find('[data-testid="view-opt-fundamentals"]')
    expect(item.classes()).toContain('dvs-dropdown-item--disabled')
    expect(item.attributes('disabled')).toBeDefined()
  })

  it('does NOT emit when a disabled mobile dropdown item is clicked', async () => {
    const wrapper = mountDisabled()
    await wrapper.find('[data-testid="view-dropdown-btn"]').trigger('click')
    await wrapper.find('[data-testid="view-opt-fundamentals"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
