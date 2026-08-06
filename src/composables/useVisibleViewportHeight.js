/**
 * Publishes the *visible* viewport height to a CSS custom property on
 * `<html>`. Components that need to fill the visible viewport (the
 * AssistPanel input row is the motivating case) can then read
 * `var(--visible-vh, 100dvh)` and stay reachable on Android Chrome /
 * Ecosia / etc., where the address bar collapses and `100vh` resolves
 * to the *layout* viewport (the largest possible), not the area the
 * user can actually see.
 *
 * The `dvh` unit covers modern Chromium 108+ / Safari 15.4+ / Firefox
 * 101+, but the bug report came from a Xiaomi Redmi Note 13 running
 * Ecosia + Chrome — older Chromium builds ship on Android in the wild
 * and the visualViewport API has been around for years. So we set the
 * px value explicitly as the highest-priority cascade layer.
 *
 * SSR-safe: bails out when `window`/`document` are undefined.
 */
import { onMounted, onUnmounted } from 'vue'

const CSS_VAR = '--visible-vh'
/*
 * How much of the LAYOUT viewport sits below the visible area.
 *
 * `position: fixed; bottom: 0` on Android Chrome resolves against the
 * layout viewport — the tallest the page can be, with the address bar
 * collapsed. While the bar is showing (which it is until you scroll) the
 * visible area is shorter, so a bottom-anchored control renders below
 * the fold: the assistant button half-cut, the rail's account row not
 * visible at all. Scrolling collapses the bar, the two heights converge,
 * and the control "appears" — which is exactly the reported symptom.
 *
 * env(safe-area-inset-bottom) does not cover this. That inset is about
 * system UI (the gesture bar, the home indicator); this is the browser's
 * own chrome, and on Android the inset is frequently 0 while this gap is
 * 50-100px.
 */
const GAP_VAR = '--vv-bottom-gap'
/*
 * Ceiling on that gap.
 *
 * The gap is meant to compensate for browser chrome, which runs 50-120px.
 * An open soft keyboard shrinks the visual viewport by 250-450px and
 * would, uncapped, shove bottom-anchored controls a third of the way up
 * the screen while you type in an unrelated field. 200px sits cleanly
 * between the two: above any address bar, below any keyboard.
 */
const MAX_GAP_PX = 200

export function useVisibleViewportHeight() {
  // Access via `globalThis` so SSR (no `window`) doesn't throw a
  // ReferenceError, and so Sonar's javascript:S7764 rule stays happy
  // (it nudges us toward `globalThis.window` over a bare `window`).
  // Direct `=== undefined` comparison rather than `typeof === 'undefined'`
  // for the same reason (javascript:S7741).
  if (globalThis.window === undefined || globalThis.document === undefined) return

  let cleanup = null

  onMounted(() => {
    const vv = globalThis.window.visualViewport
    if (!vv) return

    const update = () => {
      // `visualViewport.height` is in CSS pixels and tracks the
      // user-visible area in real time (resizes as the mobile chrome
      // bar slides in/out, as the soft keyboard appears, etc.).
      const root = globalThis.document.documentElement
      root.style.setProperty(CSS_VAR, `${vv.height}px`)
      // innerHeight is the layout viewport; offsetTop accounts for the
      // visual viewport being scrolled within it (pinch-zoom, keyboard).
      // Clamped at 0 so a browser reporting the two as equal — or the
      // visual viewport being transiently taller mid-animation — never
      // pushes controls upward instead.
      const gap = Math.min(
        MAX_GAP_PX,
        Math.max(0, globalThis.window.innerHeight - vv.height - vv.offsetTop),
      )
      root.style.setProperty(GAP_VAR, `${Math.round(gap)}px`)
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)

    cleanup = () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      globalThis.document.documentElement.style.removeProperty(CSS_VAR)
      globalThis.document.documentElement.style.removeProperty(GAP_VAR)
    }
  })

  onUnmounted(() => {
    cleanup?.()
  })
}
