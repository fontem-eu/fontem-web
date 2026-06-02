import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ToastStack from '../../src/components/ToastStack.vue'
import { useToast } from '../../src/composables/useToast.js'

describe('ToastStack', () => {
  let toast
  let _wrapper
  beforeEach(() => {
    toast = useToast()
    toast.clear()
    document.body.innerHTML = ''
    vi.useFakeTimers()
  })
  afterEach(() => {
    if (_wrapper) {
      _wrapper.unmount()
      _wrapper = null
    }
    vi.useRealTimers()
    toast.clear()
    document.body.innerHTML = ''
  })

  function mountStack() {
    _wrapper = mount(ToastStack, { attachTo: document.body })
    return _wrapper
  }

  it('renders nothing when the queue is empty', () => {
    mountStack()
    expect(document.querySelector('[data-testid="toast-stack"]')).toBeNull()
  })

  it('renders a card per enqueued toast, in insertion order', async () => {
    mountStack()
    toast.success('First')
    toast.error('Second')
    toast.info('Third')
    await flushPromises()

    const cards = document.querySelectorAll('[data-testid^="toast-"]')
    // toast-stack root + 3 children = 4 with `data-testid^="toast"`. Filter.
    const items = Array.from(cards).filter(
      (el) => el.getAttribute('data-testid') !== 'toast-stack',
    )
    expect(items.map((el) => el.textContent.trim().replace(/^[✓✕i]\s*/, ''))).toEqual([
      'First', 'Second', 'Third',
    ])
  })

  it('applies the kind-specific data-testid + class', async () => {
    mountStack()
    toast.success('Saved')
    toast.error('Broke')
    toast.info('FYI')
    await flushPromises()

    expect(document.querySelector('[data-testid="toast-success"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="toast-error"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="toast-info"]')).not.toBeNull()
    expect(
      document.querySelector('[data-testid="toast-success"]').classList.contains('toast--success'),
    ).toBe(true)
  })

  it('removes the card when its auto-dismiss timer fires', async () => {
    mountStack()
    toast.success('Saved')
    await flushPromises()
    expect(document.querySelector('[data-testid="toast-success"]')).not.toBeNull()

    vi.advanceTimersByTime(3000)
    await flushPromises()
    expect(document.querySelector('[data-testid="toast-success"]')).toBeNull()
  })

  it('click dismisses the card immediately', async () => {
    mountStack()
    toast.error('Broke', { durationMs: 0 })
    await flushPromises()
    const card = document.querySelector('[data-testid="toast-error"]')
    expect(card).not.toBeNull()
    card.click()
    await flushPromises()
    expect(document.querySelector('[data-testid="toast-error"]')).toBeNull()
  })

  it('keeps a sticky (durationMs=0) error visible until the user clicks it', async () => {
    mountStack()
    toast.error('Save failed', { durationMs: 0 })
    await flushPromises()
    vi.advanceTimersByTime(60_000)
    await flushPromises()
    expect(document.querySelector('[data-testid="toast-error"]')).not.toBeNull()
  })

  it('removing one toast leaves the others in place', async () => {
    mountStack()
    const aId = toast.success('keep-a')
    toast.success('keep-b')
    toast.success('drop-c')
    await flushPromises()

    // Dismiss the first by its id; the rest must remain.
    toast.dismiss(aId)
    await flushPromises()
    const texts = Array.from(
      document.querySelectorAll('[data-testid="toast-success"]'),
    ).map((el) => el.textContent.replace(/^[✓✕i]\s*/, '').trim())
    expect(texts).toEqual(['keep-b', 'drop-c'])
  })
})
