<script setup>
/**
 * Data Studio choropleth — paints a result table's value column onto NUTS
 * regions keyed by a NUTS-code column. Reuses the atlas boundary API + the
 * CSP-safe inline OSM basemap (tile.openstreetmap.org is allowed by img-src).
 * A coverage readout ("matched N of M") makes a wrong column/level obvious.
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { fetchBoundaries } from '../api/geo.js'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  geoCol: { type: String, default: '' },
  valueCol: { type: String, default: '' },
  level: { type: Number, default: 0 },
})

const container = ref(null)
const loading = ref(false)
const error = ref(null)
const coverage = ref({ matched: 0, total: 0 })
const bounds = ref({ lo: 0, hi: 0 })
let map = null
const _geoCache = {}
const COLOR_STOPS = ['#f1f5f9', '#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a']

// code -> numeric value from the result rows
const byCode = computed(() => {
  const gi = props.columns.indexOf(props.geoCol)
  const vi = props.columns.indexOf(props.valueCol)
  const m = new Map()
  if (gi < 0 || vi < 0) return m
  for (const r of props.rows) {
    const code = r[gi]
    const v = Number(r[vi])
    if (code != null && code !== '' && Number.isFinite(v)) m.set(String(code), v)
  }
  return m
})

async function boundariesFor(level) {
  if (!_geoCache[level]) _geoCache[level] = await fetchBoundaries(level)
  // clone so we can mutate feature.properties.value without poisoning the cache
  return JSON.parse(JSON.stringify(_geoCache[level]))
}

// A maplibre `step` fill-color expression, or a single colour when the data is
// degenerate. step inputs MUST be strictly ascending, so ties are dropped.
function buildPaint(values) {
  const vs = values.filter((v) => v > 0).sort((a, b) => a - b)
  bounds.value = { lo: vs[0] || 0, hi: vs[vs.length - 1] || 0 }
  if (vs.length < 2 || vs[0] === vs[vs.length - 1]) return COLOR_STOPS[COLOR_STOPS.length - 1]
  const stops = []
  let prev = -Infinity
  COLOR_STOPS.slice(1).forEach((color, i) => {
    const idx = Math.floor(((i + 1) / COLOR_STOPS.length) * vs.length)
    const t = vs[Math.max(0, idx - 1)] || 0
    if (t > prev) { stops.push(t, color); prev = t }
  })
  if (!stops.length) return COLOR_STOPS[COLOR_STOPS.length - 1]
  return ['step', ['get', 'value'], COLOR_STOPS[0], ...stops]
}

async function render() {
  if (!map || !props.geoCol || !props.valueCol) return
  loading.value = true; error.value = null
  try {
    const geojson = await boundariesFor(props.level)
    const codes = new Set()
    const vals = []
    const lookup = byCode.value
    for (const f of geojson.features) {
      const code = f.properties.nuts_code
      const v = lookup.has(code) ? lookup.get(code) : 0
      f.properties.value = v
      if (lookup.has(code)) { codes.add(code); vals.push(v) }
    }
    coverage.value = { matched: codes.size, total: lookup.size }
    const paint = buildPaint(vals)
    const apply = () => {
      if (map.getSource('nuts')) {
        map.getSource('nuts').setData(geojson)
      } else {
        map.addSource('nuts', { type: 'geojson', data: geojson })
        map.addLayer({ id: 'nuts-fill', type: 'fill', source: 'nuts', paint: { 'fill-color': paint, 'fill-opacity': 0.75 } })
        map.addLayer({ id: 'nuts-line', type: 'line', source: 'nuts', paint: { 'line-color': '#334155', 'line-width': 0.4 } })
      }
      map.setPaintProperty('nuts-fill', 'fill-color', paint)
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  } catch (e) { error.value = e.message } finally { loading.value = false }
}

onMounted(() => {
  map = new maplibregl.Map({
    container: container.value,
    style: {
      version: 8,
      sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap' } },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    center: [10, 51], zoom: 3,
  })
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  map.on('load', render)
})
onBeforeUnmount(() => { if (map) { map.remove(); map = null } })
watch(() => [props.rows, props.geoCol, props.valueCol, props.level], render, { deep: true })

const fmt = (v) => (v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : `${Math.round(v)}`)
</script>

<template>
  <div class="smap" data-testid="studio-map">
    <div ref="container" class="smap-canvas" />
    <div class="smap-bar">
      <span v-if="loading" class="muted">Loading boundaries…</span>
      <span v-else-if="error" class="err">{{ error }}</span>
      <span v-else class="cov" data-testid="map-coverage">
        matched {{ coverage.matched }} of {{ coverage.total }} regions
        <span v-if="coverage.total && coverage.matched === 0" class="warn">— wrong column/level?</span>
      </span>
      <span v-if="!loading && !error && bounds.hi" class="legend">
        <span class="muted">{{ valueCol }}:</span>
        <i v-for="c in COLOR_STOPS" :key="c" class="sw" :style="{ background: c }" />
        <span class="muted">{{ fmt(bounds.lo) }}–{{ fmt(bounds.hi) }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.smap { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.smap-canvas { height: 26rem; width: 100%; }
.smap-bar { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; padding: 0.5rem 0.7rem; font-size: 0.78rem; border-top: 1px solid var(--border); background: var(--surface); }
.muted { color: var(--muted); }
.err { color: #dc2626; }
.warn { color: #d97706; }
.cov { font-weight: 600; }
.legend { display: flex; align-items: center; gap: 0.25rem; margin-left: auto; }
.sw { width: 0.9rem; height: 0.7rem; border-radius: 2px; display: inline-block; }
</style>
