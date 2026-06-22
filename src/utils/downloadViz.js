/**
 * Download a visualization element as an image.
 *
 * One generic helper used by the shared actions menu (PocketButton) so every
 * viz exports the same way:
 *   - inline <svg> (d3 bar charts, gauges)      -> .svg  (vector)
 *   - one or more <canvas> (time-series charts, -> .png  (raster, layers
 *     maplibre maps, sigma graph layers)               composited in order)
 *   - anything else (HTML cards/tables/tiles)   -> .png  via an SVG
 *     <foreignObject> raster, falling back to a text snapshot if the
 *     browser blocks/taints the image.
 */

function sanitize(name) {
  return String(name || 'chart').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 60) || 'chart'
}

function triggerDownload(href, filename, revoke) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  if (revoke && typeof URL.revokeObjectURL === 'function') {
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  }
}

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]
  ))
}

function downloadSvg(svg, name) {
  const clone = svg.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const data = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(
    new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${data}`], { type: 'image/svg+xml' }),
  )
  triggerDownload(url, `${name}.svg`, true)
}

function downloadCanvases(canvases, name) {
  // Composite every canvas layer (a single chart/map canvas, or sigma's
  // stacked WebGL + label layers) onto one 2D canvas, then export PNG.
  let w = 0
  let h = 0
  for (const c of canvases) { w = Math.max(w, c.width); h = Math.max(h, c.height) }
  if (!w || !h) return
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  for (const c of canvases) {
    try { ctx.drawImage(c, 0, 0) } catch { /* a tainted/empty layer — skip */ }
  }
  try {
    triggerDownload(out.toDataURL('image/png'), `${name}.png`)
  } catch { /* cross-origin tainted — nothing we can do client-side */ }
}

function downloadTextSnapshot(el, name) {
  const lines = (el.innerText || el.textContent || '')
    .trim().split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 30)
  const w = 360
  const lh = 24
  const pad = 18
  const h = pad * 2 + lh * (lines.length || 1)
  const texts = lines.map((t, i) =>
    `<text x="${w / 2}" y="${pad + lh * (i + 1) - 6}" text-anchor="middle" `
    + `font-family="sans-serif" font-size="${i === 0 ? 20 : 13}" fill="#111">${escapeXml(t)}</text>`,
  ).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`
    + `<rect width="100%" height="100%" fill="#ffffff"/>${texts}</svg>`
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  triggerDownload(url, `${name}.svg`, true)
}

function inlineStyles(src, dst) {
  // Copy computed styles down the cloned tree so the foreignObject raster
  // keeps the on-screen look (scoped CSS / CSS vars don't survive otherwise).
  const cs = getComputedStyle(src)
  let css = ''
  for (const prop of cs) {
    css += `${prop}:${cs.getPropertyValue(prop)};`
  }
  dst.setAttribute('style', css)
  const sc = src.children
  const dc = dst.children
  for (let i = 0; i < sc.length && i < dc.length; i++) inlineStyles(sc[i], dc[i])
}

function rasterizeHtml(el, name) {
  try {
    const rect = el.getBoundingClientRect()
    const w = Math.max(1, Math.ceil(rect.width)) || 360
    const h = Math.max(1, Math.ceil(rect.height)) || 160
    const clone = el.cloneNode(true)
    inlineStyles(el, clone)
    const xhtml = new XMLSerializer().serializeToString(clone)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`
      + `<foreignObject width="100%" height="100%">`
      + `<div xmlns="http://www.w3.org/1999/xhtml" style="background:#fff">${xhtml}</div>`
      + `</foreignObject></svg>`
    const img = new Image()
    img.onload = () => {
      const out = document.createElement('canvas')
      out.width = w
      out.height = h
      const ctx = out.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0)
      try { triggerDownload(out.toDataURL('image/png'), `${name}.png`) } catch { downloadTextSnapshot(el, name) }
    }
    img.onerror = () => downloadTextSnapshot(el, name)
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  } catch {
    downloadTextSnapshot(el, name)
  }
}

export function downloadElementAsImage(el, name) {
  if (!el || typeof el.querySelectorAll !== 'function') return
  const base = sanitize(name)
  const canvases = Array.from(el.querySelectorAll('canvas'))
  if (canvases.length) return downloadCanvases(canvases, base)
  const svg = el.querySelector('svg')
  if (svg) return downloadSvg(svg, base)
  return rasterizeHtml(el, base)
}
