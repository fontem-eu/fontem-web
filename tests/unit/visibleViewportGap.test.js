/**
 * The gap below the visible viewport.
 *
 * `position: fixed; bottom: 0` resolves against the LAYOUT viewport. On
 * Android Chrome that is the tallest the page can be — address bar
 * collapsed — so while the bar is showing, bottom-anchored controls
 * render below the fold and only appear once you scroll. That was the
 * reported symptom: the assistant button half-cut, the rail's account row
 * invisible until scrolled.
 */
import { describe, it, expect } from 'vitest'

// Mirrors the computation in useVisibleViewportHeight.
const MAX_GAP_PX = 200
const gap = (innerHeight, vvHeight, vvOffsetTop = 0) =>
  Math.min(MAX_GAP_PX, Math.max(0, Math.round(innerHeight - vvHeight - vvOffsetTop)))

describe('visible-viewport bottom gap', () => {
  it('compensates for the address bar at the top of the page', () => {
    expect(gap(915, 838)).toBe(77)
  })

  it('is zero once the bar collapses, and on desktop', () => {
    expect(gap(915, 915)).toBe(0)
    expect(gap(1080, 1080)).toBe(0)
  })

  it('never goes negative when the visual viewport reports taller', () => {
    // Happens transiently mid-animation; a negative gap would push
    // controls off the top instead.
    expect(gap(915, 940)).toBe(0)
  })

  it('accounts for the visual viewport being scrolled within the layout', () => {
    expect(gap(915, 800, 60)).toBe(55)
  })

  it('caps at the address-bar range so a keyboard does not launch controls upward', () => {
    // A keyboard shrinks the visual viewport by 250-450px. Uncapped, the
    // assistant button would jump a third of the way up the screen while
    // you typed in an unrelated field.
    expect(gap(915, 480)).toBe(MAX_GAP_PX)
    expect(gap(915, 465)).toBe(MAX_GAP_PX)
  })
})
