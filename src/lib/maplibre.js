/**
 * The one place the app imports maplibre-gl.
 *
 * maplibre-gl 6 ships its web worker as a separate file and, left alone,
 * fetches it from `./maplibre-gl-worker.mjs` next to its own bundle. Vite
 * does not emit that file, so in a built app the request 404s. Nothing
 * throws: the raster basemap needs no worker and keeps drawing, while every
 * GeoJSON source — all of our region fills — waits forever on a worker that
 * never started. The user gets a map with no colours and no error.
 *
 * `?worker&url` makes Vite bundle the worker (it imports a shared chunk, so a
 * plain `?url` file copy would break its relative import) and hands back the
 * hashed URL, which is served from 'self' and so satisfies the worker-src CSP.
 *
 * tests/browser/map-render.spec.js renders a real map from the built app to
 * keep this honest; unit tests mock maplibre and cannot see it.
 */
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'

// Guarded for SSR, where the module is evaluated but no map is ever created.
if (typeof window !== 'undefined') maplibregl.setWorkerUrl(workerUrl)

// Maps whose style has finished loading. Recorded from construction because
// `style.load` fires once and a late listener would wait forever.
const styleReady = new WeakSet()

/** `new maplibregl.Map(options)`, tracked so whenStyleReady can answer later. */
export function createMap(options) {
  const map = new maplibregl.Map(options)
  map.once('style.load', () => styleReady.add(map))
  return map
}

/**
 * Run `fn` as soon as sources and layers can be added to `map`.
 *
 * Deliberately NOT `if (map.isStyleLoaded()) fn() else map.once('load', fn)`,
 * which every map here used to do. Both halves depend on the basemap tiles:
 * isStyleLoaded() is false while any tile is in flight, and `load` waits for
 * every tile — and never fires at all when they fail. So an OpenStreetMap
 * outage, a rate limit or a content blocker left our own region data unpainted
 * although it had arrived. Adding a layer needs the style, which is inline and
 * ours, not the tiles.
 */
export function whenStyleReady(map, fn) {
  if (styleReady.has(map) || map.isStyleLoaded()) fn()
  else map.once('style.load', fn)
}

export { maplibregl }
