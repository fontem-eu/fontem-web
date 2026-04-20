import { onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// Horizontal swipe between the three top-level views.
// Only active on mobile (touch) and on these exact routes — nothing else.
const ORDER = ['/', '/feed', '/my-reports']

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
    if (!ORDER.includes(route.path)) { active = false; return }
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
    const idx = ORDER.indexOf(route.path)
    if (idx < 0) return
    const next = dx < 0 ? idx + 1 : idx - 1
    if (next < 0 || next >= ORDER.length) return
    router.push(ORDER[next])
  }

  onMounted(() => {
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
  })
  onBeforeUnmount(() => {
    window.removeEventListener('touchstart', onTouchStart)
    window.removeEventListener('touchend', onTouchEnd)
  })
}
