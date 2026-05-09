/**
 * UserAvatar — initials, image fallback, head-icon final fallback.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserAvatar from '../../src/components/UserAvatar.vue'

function mountWith(user) {
  return mount(UserAvatar, { props: { user } })
}

describe('UserAvatar — render fallbacks', () => {
  it('renders the avatar_url when present', () => {
    const w = mountWith({
      name: 'Bernardo Marques',
      avatar_url: 'https://example.com/me.jpg',
    })
    expect(w.find('[data-testid="user-avatar-img"]').exists()).toBe(true)
    expect(w.find('[data-testid="user-avatar-img"]').attributes('src'))
      .toBe('https://example.com/me.jpg')
  })

  it('falls through to initials when no avatar_url', () => {
    const w = mountWith({ name: 'Bernardo Marques' })
    expect(w.find('[data-testid="user-avatar-img"]').exists()).toBe(false)
    expect(w.find('[data-testid="user-avatar-initials"]').text()).toBe('BM')
  })

  it('renders the head-icon SVG when nothing usable is available', () => {
    const w = mountWith({ name: '', email: '' })
    expect(w.find('[data-testid="user-avatar-icon"]').exists()).toBe(true)
    expect(w.find('[data-testid="user-avatar-initials"]').exists()).toBe(false)
  })

  it('falls back to head-icon if the avatar image errors', async () => {
    const w = mountWith({
      name: '', email: '',
      avatar_url: 'https://example.com/404.jpg',
    })
    await w.find('[data-testid="user-avatar-img"]').trigger('error')
    // Image gone; nothing usable left → head icon.
    expect(w.find('[data-testid="user-avatar-img"]').exists()).toBe(false)
    expect(w.find('[data-testid="user-avatar-icon"]').exists()).toBe(true)
  })

  it('renders nothing user-specific when user prop is null', () => {
    const w = mount(UserAvatar, { props: { user: null } })
    expect(w.find('[data-testid="user-avatar-icon"]').exists()).toBe(true)
  })
})

describe('UserAvatar — initials algorithm', () => {
  // Tests against `deriveInitials` exposed via defineExpose on the
  // component instance. Using the component lets us cover the same
  // unicode + whitespace handling that the runtime gets.
  const derive = (name, email) => {
    const w = mount(UserAvatar, { props: { user: { name, email } } })
    return w.vm.deriveInitials(name, email)
  }

  it('takes first + last character for two-token names', () => {
    expect(derive('Bernardo Marques', null)).toBe('BM')
  })

  it('uses first + last token for >2-token names', () => {
    expect(derive('Maria de Lurdes Silva', null)).toBe('MS')
  })

  it('takes the first two characters for single-token names', () => {
    expect(derive('Bernardo', null)).toBe('BE')
  })

  it('preserves Unicode capitalisation', () => {
    expect(derive('Émile Zola', null)).toBe('ÉZ')
  })

  it('strips leading/trailing whitespace', () => {
    expect(derive('  Bernardo  Marques  ', null)).toBe('BM')
  })

  it('falls back to email local-part when name is empty', () => {
    expect(derive('', 'alice@example.com')).toBe('AL')
  })

  it('falls back to email when name is whitespace only', () => {
    expect(derive('   ', 'alice@example.com')).toBe('AL')
  })

  it('returns null when neither name nor email is usable', () => {
    expect(derive('', '')).toBe(null)
    expect(derive(null, null)).toBe(null)
  })

  it('handles single-character names without crashing', () => {
    // "B" → just "B" (one char), uppercased.
    expect(derive('B', null)).toBe('B')
  })
})
