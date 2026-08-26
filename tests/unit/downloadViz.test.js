import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { downloadElementAsImage } from '../../src/utils/downloadViz.js'

// The module reaches straight for DOM download plumbing, so capture what it
// hands the browser rather than mocking the module's own internals: the
// filename a user ends up with, and the bytes inside the Blob, are the
// contract worth pinning.
let downloads
let blobs

function lastBlobText() {
  return blobs.length ? blobs[blobs.length - 1] : ''
}

beforeEach(() => {
  downloads = []
  blobs = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
    downloads.push({ href: this.href, filename: this.download })
  })
  global.URL.createObjectURL = vi.fn((blob) => {
    blobs.push(blob && blob.__text != null ? blob.__text : '')
    return 'blob:stub'
  })
  global.URL.revokeObjectURL = vi.fn()
  // jsdom ships no 2D context; the module composites onto a canvas it
  // creates itself, so the stub has to live on the prototype.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
    fillRect() {}, drawImage() {}, fillStyle: '',
  }))
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockImplementation(() => 'data:image/png;base64,AAA')
  // jsdom's Blob does not expose its contents synchronously; keep the text.
  const RealBlob = global.Blob
  global.Blob = class extends RealBlob {
    constructor(parts, opts) {
      super(parts, opts)
      this.__text = (parts || []).join('')
    }
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

function elWith(html) {
  const el = document.createElement('div')
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

describe('downloadElementAsImage — filename sanitisation', () => {
  // The name comes from a user-editable chart title and lands in the
  // Downloads folder, so anything path-like or exotic has to be neutralised.
  it('replaces characters that are unsafe in a filename', () => {
    downloadElementAsImage(elWith('<svg></svg>'), 'Q1/2026 spend: PT & ES')
    expect(downloads[0].filename).toBe('Q1_2026_spend_PT_ES.svg')
  })

  it('strips path traversal rather than preserving it', () => {
    downloadElementAsImage(elWith('<svg></svg>'), '../../etc/passwd')
    expect(downloads[0].filename).toBe('_etc_passwd.svg')
    expect(downloads[0].filename).not.toContain('..')
    expect(downloads[0].filename).not.toContain('/')
  })

  it('caps the length so the download does not break on long titles', () => {
    downloadElementAsImage(elWith('<svg></svg>'), 'a'.repeat(200))
    expect(downloads[0].filename).toBe(`${'a'.repeat(60)}.svg`)
  })

  it('falls back to "chart" when there is no usable name', () => {
    downloadElementAsImage(elWith('<svg></svg>'), '')
    downloadElementAsImage(elWith('<svg></svg>'), null)
    expect(downloads[0].filename).toBe('chart.svg')
    expect(downloads[1].filename).toBe('chart.svg')
  })

  it('collapses an all-unsafe name to a single underscore', () => {
    // Not the "chart" fallback: the substitution yields "_", which is
    // truthy, so it stands. Harmless, but pinned so the distinction is
    // deliberate rather than accidental.
    downloadElementAsImage(elWith('<svg></svg>'), '///')
    expect(downloads[0].filename).toBe('_.svg')
  })
})

describe('downloadElementAsImage — format dispatch', () => {
  // Documented contract at the top of the module: canvas wins over svg,
  // because a chart that has both renders its pixels in the canvas.
  it('prefers canvas (png) over an svg present in the same element', () => {
    const el = elWith('<svg></svg><canvas></canvas>')
    const canvas = el.querySelector('canvas')
    canvas.width = 10
    canvas.height = 10
    downloadElementAsImage(el, 'both')
    expect(downloads[0].filename).toBe('both.png')
  })

  it('exports an inline svg as .svg', () => {
    downloadElementAsImage(elWith('<svg><rect/></svg>'), 'vector')
    expect(downloads[0].filename).toBe('vector.svg')
  })

  it('declares the svg namespace so the file opens standalone', () => {
    downloadElementAsImage(elWith('<svg><rect/></svg>'), 'vector')
    expect(lastBlobText()).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(lastBlobText()).toContain('<?xml version="1.0" encoding="UTF-8"?>')
  })

  it('does nothing for a non-element', () => {
    downloadElementAsImage(null, 'x')
    downloadElementAsImage({}, 'x')
    expect(downloads).toHaveLength(0)
  })

  it('skips canvases with no dimensions instead of emitting a blank file', () => {
    const el = elWith('<canvas></canvas>')
    const canvas = el.querySelector('canvas')
    canvas.width = 0
    canvas.height = 0
    downloadElementAsImage(el, 'empty')
    expect(downloads).toHaveLength(0)
  })
})

describe('downloadElementAsImage — text snapshot escaping', () => {
  // The HTML path falls back to a hand-built SVG when rasterising fails,
  // and that SVG interpolates page text directly. Unescaped markup there
  // produces a corrupt file at best and injected nodes at worst.
  it('escapes markup from element text into the generated svg', () => {
    const el = elWith('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; "quotes"</p>')
    // Force the fallback: no canvas, no svg, and rasterising throws.
    el.getBoundingClientRect = () => { throw new Error('no layout') }
    downloadElementAsImage(el, 'snap')
    const svg = lastBlobText()
    expect(svg).toContain('&lt;script&gt;')
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&amp;')
    expect(svg).toContain('&quot;')
  })

  it('emits a well-formed svg for the fallback', () => {
    const el = elWith('<p>Total spend</p>')
    el.getBoundingClientRect = () => { throw new Error('no layout') }
    downloadElementAsImage(el, 'snap')
    const svg = lastBlobText()
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(downloads[0].filename).toBe('snap.svg')
  })
})
