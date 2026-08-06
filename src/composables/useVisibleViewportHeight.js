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
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)

    cleanup = () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      globalThis.document.documentElement.style.removeProperty(CSS_VAR)
    }
  })

  onUnmounted(() => {
    cleanup?.()
  })
}
