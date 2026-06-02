import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useToast } from '../../src/composables/useToast.js'

describe('useToast', () => {
  let toast
  beforeEach(() => {
    toast = useToast()
    toast.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    toast.clear()
  })

  it('returns the same singleton on every call', () => {
    expect(useToast()).toBe(useToast())
  })

  it('enqueues toasts and exposes them via _toasts', () => {
    expect(toast._toasts.value).toEqual([])
    toast.success('Saved')
    expect(toast._toasts.value).toHaveLength(1)
    expect(toast._toasts.value[0]).toMatchObject({ kind: 'success', text: 'Saved' })
  })

  it('assigns a monotonic id to every entry', () => {
    const a = toast.success('one')
    const b = toast.error('two')
    expect(b).toBeGreaterThan(a)
    const ids = toast._toasts.value.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('auto-dismisses after the default duration (3 s)', () => {
    toast.success('Saved')
    expect(toast._toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(2999)
    expect(toast._toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(2)
    expect(toast._toasts.value).toHaveLength(0)
  })

  it('honours a custom durationMs', () => {
    toast.success('Saved', { durationMs: 500 })
    vi.advanceTimersByTime(500)
    expect(toast._toasts.value).toHaveLength(0)
  })

  it('keeps a toast sticky when durationMs is 0', () => {
    toast.error('Save failed', { durationMs: 0 })
    vi.advanceTimersByTime(60_000)
    expect(toast._toasts.value).toHaveLength(1)
  })

  it('dismiss(id) removes just that entry', () => {
    const aId = toast.success('a')
    toast.success('b')
    toast.dismiss(aId)
    expect(toast._toasts.value.map((t) => t.text)).toEqual(['b'])
  })

  it('clear() empties the queue', () => {
    toast.success('a')
    toast.error('b')
    toast.info('c')
    toast.clear()
    expect(toast._toasts.value).toEqual([])
  })

  // ── Surface helpers tag each kind correctly. ──
  it.each(['success', 'error', 'info'])('%s helper enqueues with the right kind', (kind) => {
    toast[kind]('msg')
    expect(toast._toasts.value[0].kind).toBe(kind)
  })

  // Helpers should pass through the opts bag (e.g. durationMs).
  it('forwards opts through the per-kind helpers', () => {
    toast.error('boom', { durationMs: 0 })
    vi.advanceTimersByTime(10_000)
    expect(toast._toasts.value).toHaveLength(1)
  })
})
