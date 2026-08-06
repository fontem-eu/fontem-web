/**
 * Bottom-anchored controls must not move when the address bar does.
 *
 * The earlier approach measured the gap between the layout and visual
 * viewports in JS and fed it into a CSS variable. It worked, and it was
 * wrong: the value changes on every scroll, so the assistant button and
 * the nav rail visibly shifted each time the bar slid in or out, and on
 * first paint the variable was not set yet so the button started half
 * hidden.
 *
 * The replacement is static: `100svh` is the viewport with the bar
 * showing, `100lvh` with it hidden, and their difference is the bar's
 * height — a constant the browser resolves once. These assert the CSS
 * says so, because the failure mode is somebody reintroducing a live
 * measurement to "fix" the small gap that svh leaves behind.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const read = (f) => fs.readFileSync(path.resolve(__dirname, '../../src', f), 'utf8')

describe('bottom anchoring is static', () => {
  it('the nav rail is sized to the small viewport', () => {
    const css = read('components/AppSidebar.vue')
    expect(css).toContain('100svh')
    // A live height is what made a gap open under the rail mid-scroll.
    expect(css).not.toContain('--vv-bottom-gap')
    expect(css).not.toMatch(/height:\s*calc\(var\(--visible-vh/)
  })

  it('the assistant toggle is offset by the address bar height, not by a measurement', () => {
    const css = read('components/AssistPanel.vue')
    expect(css).toContain('100lvh - 100svh')
    expect(css).not.toContain('--vv-bottom-gap')
  })

  it('nothing publishes a live bottom gap any more', () => {
    const js = read('composables/useVisibleViewportHeight.js')
    expect(js).not.toContain('vv-bottom-gap')
    // --visible-vh survives: the assistant's own full-height panel should
    // track the bar, because it fills the screen and a fixed height would
    // put its input row under the keyboard.
    expect(js).toContain('--visible-vh')
  })
})
