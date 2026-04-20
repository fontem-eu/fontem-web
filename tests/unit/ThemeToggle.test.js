import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import ThemeToggle from '../../src/components/ThemeToggle.vue'

// Stable mock refs shared across all tests
const mockTheme = ref('light')
const mockCycle = vi.fn()

vi.mock('../../src/composables/useTheme.js', () => ({
  useTheme: () => ({
    theme: mockTheme,
    cycle: mockCycle,
    init: vi.fn(),
  }),
}))

describe('ThemeToggle component', () => {
  beforeEach(() => {
    mockTheme.value = 'light'
    mockCycle.mockClear()
    // cycle() walks light → dark → autumn → light
    mockCycle.mockImplementation(() => {
      const order = ['light', 'dark', 'autumn']
      mockTheme.value = order[(order.indexOf(mockTheme.value) + 1) % order.length]
    })
  })

  it('renders a button with type="button"', () => {
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('button[type="button"]').exists()).toBe(true)
  })

  it('shows the moon icon in light mode', () => {
    mockTheme.value = 'light'
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('[data-testid="moon-icon"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="leaf-icon"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sun-icon"]').exists()).toBe(false)
  })

  it('shows the leaf icon in dark mode', () => {
    mockTheme.value = 'dark'
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('[data-testid="leaf-icon"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="moon-icon"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sun-icon"]').exists()).toBe(false)
  })

  it('shows the sun icon in autumn mode', () => {
    mockTheme.value = 'autumn'
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('[data-testid="sun-icon"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="moon-icon"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="leaf-icon"]').exists()).toBe(false)
  })

  it('aria-label announces the next theme in light mode', () => {
    mockTheme.value = 'light'
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('button').attributes('aria-label')).toBe('Switch to dark mode')
  })

  it('aria-label announces the next theme in dark mode', () => {
    mockTheme.value = 'dark'
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('button').attributes('aria-label')).toBe('Switch to autumn theme')
  })

  it('aria-label announces the next theme in autumn mode', () => {
    mockTheme.value = 'autumn'
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('button').attributes('aria-label')).toBe('Switch to light mode')
  })

  it('calls cycle when the button is clicked', async () => {
    const wrapper = mount(ThemeToggle)
    await wrapper.find('button').trigger('click')
    expect(mockCycle).toHaveBeenCalledOnce()
  })

  it('cycles light → dark on first click', async () => {
    mockTheme.value = 'light'
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('[data-testid="moon-icon"]').exists()).toBe(true)
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('[data-testid="leaf-icon"]').exists()).toBe(true)
  })

  it('cycles dark → autumn on next click', async () => {
    mockTheme.value = 'dark'
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('[data-testid="leaf-icon"]').exists()).toBe(true)
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('[data-testid="sun-icon"]').exists()).toBe(true)
  })

  it('cycles autumn → light on next click', async () => {
    mockTheme.value = 'autumn'
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('[data-testid="sun-icon"]').exists()).toBe(true)
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('[data-testid="moon-icon"]').exists()).toBe(true)
  })

  it('data-theme attribute reflects the current theme', () => {
    mockTheme.value = 'autumn'
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('button').attributes('data-theme')).toBe('autumn')
  })
})
