import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import ThemeToggle from '../../src/components/ThemeToggle.vue'

// ── Stable mock refs shared across all tests ─────────────────
const mockIsDark = ref(false)
const mockToggle = vi.fn()

vi.mock('../../src/composables/useTheme.js', () => ({
  useTheme: () => ({
    isDark: mockIsDark,
    toggle: mockToggle,
    init: vi.fn(),
  }),
}))

describe('ThemeToggle component', () => {
  beforeEach(() => {
    mockIsDark.value = false
    mockToggle.mockClear()
    // Toggle actually flips the ref so reactivity works in tests
    mockToggle.mockImplementation(() => {
      mockIsDark.value = !mockIsDark.value
    })
  })

  it('renders a button with type="button"', () => {
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('button[type="button"]').exists()).toBe(true)
  })

  it('shows the moon icon in light mode', () => {
    mockIsDark.value = false
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('[data-testid="moon-icon"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="sun-icon"]').exists()).toBe(false)
  })

  it('shows the sun icon in dark mode', () => {
    mockIsDark.value = true
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('[data-testid="sun-icon"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="moon-icon"]').exists()).toBe(false)
  })

  it('has aria-label "Switch to dark mode" when in light mode', () => {
    mockIsDark.value = false
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('button').attributes('aria-label')).toBe('Switch to dark mode')
  })

  it('has aria-label "Switch to light mode" when in dark mode', () => {
    mockIsDark.value = true
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('button').attributes('aria-label')).toBe('Switch to light mode')
  })

  it('calls toggle when the button is clicked', async () => {
    const wrapper = mount(ThemeToggle)
    await wrapper.find('button').trigger('click')
    expect(mockToggle).toHaveBeenCalledOnce()
  })

  it('switches from moon to sun icon after clicking in light mode', async () => {
    mockIsDark.value = false
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('[data-testid="moon-icon"]').exists()).toBe(true)

    await wrapper.find('button').trigger('click')

    expect(wrapper.find('[data-testid="sun-icon"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="moon-icon"]').exists()).toBe(false)
  })

  it('switches from sun to moon icon after clicking in dark mode', async () => {
    mockIsDark.value = true
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('[data-testid="sun-icon"]').exists()).toBe(true)

    await wrapper.find('button').trigger('click')

    expect(wrapper.find('[data-testid="moon-icon"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="sun-icon"]').exists()).toBe(false)
  })

  it('sets aria-pressed to reflect dark mode state', () => {
    mockIsDark.value = true
    const wrapper = mount(ThemeToggle)
    expect(wrapper.find('button').attributes('aria-pressed')).toBe('true')
  })
})
