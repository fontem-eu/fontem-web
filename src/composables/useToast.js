/**
 * Toast queue — module-singleton reactive list of active toasts plus
 * the ergonomic helpers callers actually use.
 *
 * Why a singleton at module scope (and not a provide/inject): the
 * queue should live for the lifetime of the app and stay reachable
 * from anywhere — composables, route handlers, panel components,
 * non-Vue callbacks. Importing the helper is enough. The matching
 * ToastStack.vue component reads the same singleton and renders
 * whatever's in it; mounting more than one ToastStack at a time
 * would just render the toasts twice — guarded against in the
 * component, but ideally callers mount exactly one near the app
 * shell.
 *
 *   import { useToast } from '../composables/useToast.js'
 *   const toast = useToast()
 *   toast.success('Story saved')
 *   toast.error('Save failed', { durationMs: 0 })  // sticky
 */
import { ref } from 'vue'

const toasts = ref([])
let _nextId = 1

const DEFAULT_DURATION_MS = 3000

function _show({ kind = 'info', text = '', durationMs = DEFAULT_DURATION_MS } = {}) {
  const id = _nextId++
  const entry = { id, kind, text }
  toasts.value = [...toasts.value, entry]
  // durationMs === 0 → sticky; the user has to click to dismiss.
  if (durationMs > 0) {
    setTimeout(() => dismiss(id), durationMs)
  }
  return id
}

function dismiss(id) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

function clear() {
  toasts.value = []
}

const api = {
  // Internal: ToastStack reads this to render.
  _toasts: toasts,

  show: _show,
  success: (text, opts = {}) => _show({ ...opts, kind: 'success', text }),
  error: (text, opts = {}) => _show({ ...opts, kind: 'error', text }),
  info: (text, opts = {}) => _show({ ...opts, kind: 'info', text }),
  dismiss,
  clear,
}

export function useToast() {
  return api
}
