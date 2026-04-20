import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import ThemeToggle from '../../src/components/ThemeToggle.vue'

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
    mockToggle.mockImplementation(() => { mockIsDark.value = !mockIsDark.value })
  })

  it('renders a button', () => {
    expect(mount(ThemeToggle).find('button[type="button"]').exists()).toBe(true)
  })

  it('shows the moon icon in light mode', () => {
    mockIsDark.value = false
    const w = mount(ThemeToggle)
    expect(w.find('[data-testid="moon-icon"]').exists()).toBe(true)
    expect(w.find('[data-testid="sun-icon"]').exists()).toBe(false)
  })

  it('shows the sun icon in dark mode', () => {
    mockIsDark.value = true
    const w = mount(ThemeToggle)
    expect(w.find('[data-testid="sun-icon"]').exists()).toBe(true)
    expect(w.find('[data-testid="moon-icon"]').exists()).toBe(false)
  })

  it('announces the next theme in aria-label', () => {
    mockIsDark.value = false
    expect(mount(ThemeToggle).find('button').attributes('aria-label'))
      .toBe('Switch to dark mode')
    mockIsDark.value = true
    expect(mount(ThemeToggle).find('button').attributes('aria-label'))
      .toBe('Switch to light mode')
  })

  it('calls toggle on click', async () => {
    const w = mount(ThemeToggle)
    await w.find('button').trigger('click')
    expect(mockToggle).toHaveBeenCalledOnce()
  })

  it('flips the icon on click in light mode', async () => {
    mockIsDark.value = false
    const w = mount(ThemeToggle)
    await w.find('button').trigger('click')
    expect(w.find('[data-testid="sun-icon"]').exists()).toBe(true)
  })

  it('sets aria-pressed to reflect dark state', () => {
    mockIsDark.value = true
    expect(mount(ThemeToggle).find('button').attributes('aria-pressed')).toBe('true')
  })
})
