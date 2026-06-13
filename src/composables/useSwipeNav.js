import { onMounted, onBeforeUnmount } from 'vue'
import { isAuthed } from '../api/session.js'
import { useRoute, useRouter } from 'vue-router'

// Horizontal swipe between the top-level views. Order mirrors the nav
// tabs; My Stories is only included when the user has a token so that
// anonymous users don't get punted into the auth wall mid-swipe.
// Mirrors the nav-tab order in AppHeader. `/` is the public Stories
// landing; Spending + Map are the sibling features; My Stories is
// auth-only so it gets dropped from the swipe ring for anon users.
const PUBLIC_ORDER = ['/', '/spending', '/map']
const AUTHED_ORDER = ['/', '/spending', '/map', '/my-stories']
function currentOrder() {
  // Safe on the server (SSR) — no localStorage there, default to the
  // anonymous order; the client re-evaluates on hydration.
  if (typeof localStorage === 'undefined') return PUBLIC_ORDER
  return isAuthed.value ? AUTHED_ORDER : PUBLIC_ORDER
}

const SWIPE_MIN_DX = 60        // px — must move at least this far horizontally
const SWIPE_MAX_DY_RATIO = 0.6 // |dy|/|dx| must stay below this (filters vertical scroll)
const EDGE_ZONE_PX = 32        // ignore starts near the left edge so iOS back-swipe wins

export function useSwipeNav() {
  const route = useRoute()
  const router = useRouter()

  let startX = 0
  let startY = 0
  let active = false

  function onTouchStart(e) {
    if (!currentOrder().includes(route.path)) { active = false; return }
    if (e.touches.length !== 1) { active = false; return }
    const t = e.touches[0]
    if (t.clientX < EDGE_ZONE_PX) { active = false; return }
    startX = t.clientX
    startY = t.clientY
    active = true
  }

  function onTouchEnd(e) {
    if (!active) return
    active = false
    const t = e.changedTouches[0]
    const dx = t.clientX - startX
    const dy = t.clientY - startY
    if (Math.abs(dx) < SWIPE_MIN_DX) return
    if (Math.abs(dy) / Math.abs(dx) > SWIPE_MAX_DY_RATIO) return
    const order = currentOrder()
    const idx = order.indexOf(route.path)
    if (idx < 0) return
    const next = dx < 0 ? idx + 1 : idx - 1
    if (next < 0 || next >= order.length) return
    router.push(order[next])
  }

  onMounted(() => {
    globalThis.addEventListener('touchstart', onTouchStart, { passive: true })
    globalThis.addEventListener('touchend', onTouchEnd, { passive: true })
  })
  onBeforeUnmount(() => {
    globalThis.removeEventListener('touchstart', onTouchStart)
    globalThis.removeEventListener('touchend', onTouchEnd)
  })
}
