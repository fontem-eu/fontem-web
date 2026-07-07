<script setup>
/**
 * Data Studio choropleth — paints a result table's value column onto NUTS
 * regions keyed by a NUTS-code column. Reuses the atlas boundary API + the
 * CSP-safe inline OSM basemap (tile.openstreetmap.org is allowed by img-src).
 * A coverage readout ("matched N of M") makes a wrong column/level obvious.
 *
 * Bivariate modes (a 2nd value column):
 *   - 'alpha'      value-by-alpha (Roth 2010): colour = var1 on a blue↔red
 *                  diverging scale, opacity = var2 (magnitude).
 *   - 'choropleth' classic 3×3 bivariate choropleth (Stevens/Brewer): both
 *                  vars split into terciles → a 2D colour grid + a 3×3 legend.
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { fetchBoundaries } from '../api/geo.js'
import { SEQUENTIAL_BLUE, DIVERGING, BIVARIATE_3X3, tercileBreaks, tercileClass } from '../utils/vizPalette.js'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  geoCol: { type: String, default: '' },
  valueCol: { type: String, default: '' },
  value2Col: { type: String, default: '' },
  bivariate: { type: String, default: 'none' }, // 'none' | 'alpha' | 'choropleth'
  level: { type: Number, default: 0 },
})

const container = ref(null)
const loading = ref(false)
const error = ref(null)
const coverage = ref({ matched: 0, total: 0 })
const bounds = ref({ lo: 0, hi: 0 })
const bounds2 = ref({ lo: 0, hi: 0 })
let map = null
const _geoCache = {}
const COLOR_STOPS = SEQUENTIAL_BLUE
const BIV_FLAT = BIVARIATE_3X3.flat() // index i1*3 + i2
const NO_DATA = ['==', ['get', 'hasData'], 0] // maplibre predicate: unmatched region

// active bivariate mode (only when a 2nd column is chosen)
const mode = computed(() => (props.value2Col && props.bivariate !== 'none' ? props.bivariate : 'none'))

const colFor = (col) => {
  const gi = props.columns.indexOf(props.geoCol)
  const vi = props.columns.indexOf(col)
  const m = new Map()
  if (gi < 0 || vi < 0) return m
  for (const r of props.rows) {
    const code = r[gi]
    const v = Number(r[vi])
    if (code != null && code !== '' && Number.isFinite(v)) m.set(String(code), v)
  }
  return m
}
const byCode = computed(() => colFor(props.valueCol))
const byCode2 = computed(() => colFor(props.value2Col))

async function boundariesFor(level) {
  if (!_geoCache[level]) _geoCache[level] = await fetchBoundaries(level)
  return JSON.parse(JSON.stringify(_geoCache[level]))
}

// Single-var blue step expression (strictly-ascending inputs; ties dropped).
function stepPaint(values) {
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

// Diverging blue↔grey↔red interpolate on var1, centred at the median.
function divergingPaint(values) {
  const vs = values.filter(Number.isFinite).sort((a, b) => a - b)
  const lo = vs[0]; const hi = vs[vs.length - 1]
  bounds.value = { lo: lo || 0, hi: hi || 0 }
  if (vs.length < 2 || lo === hi) return DIVERGING.mid
  let mid = vs[Math.floor(vs.length / 2)]
  const eps = (hi - lo) * 1e-6
  if (mid <= lo) mid = lo + eps
  if (mid >= hi) mid = hi - eps
  return ['interpolate', ['linear'], ['get', 'value'], lo, DIVERGING.low, mid, DIVERGING.mid, hi, DIVERGING.high]
}

// Opacity from var2 (magnitude). No-data regions fade right out.
function alphaOpacity(values2) {
  const vs = values2.filter(Number.isFinite).sort((a, b) => a - b)
  const lo = vs[0]; const hi = vs[vs.length - 1]
  bounds2.value = { lo: lo || 0, hi: hi || 0 }
  if (vs.length < 2 || lo === hi) return ['case', NO_DATA, 0.08, 0.7]
  return ['case', NO_DATA, 0.08,
    ['interpolate', ['linear'], ['get', 'value2'], lo, 0.2, hi, 0.92]]
}

const legend = ref({ mode: 'none', breaksA: [0, 0], breaksB: [0, 0] })

// Region readout — populated on hover (desktop) or tap (touch devices).
const hovered = ref(null)

async function render() {
  if (!map || !props.geoCol || !props.valueCol) return
  loading.value = true; error.value = null
  try {
    const geojson = await boundariesFor(props.level)
    const lookup = byCode.value; const lookup2 = byCode2.value
    const codes = new Set(); const vals = []; const vals2 = []
    for (const f of geojson.features) {
      const code = f.properties.nuts_code
      const a3 = f.properties.country_a3
      const key = lookup.has(code) ? code : (a3 && lookup.has(a3) ? a3 : null)
      const v = key ? lookup.get(key) : 0
      const v2 = key && lookup2.has(key) ? lookup2.get(key) : 0
      f.properties.value = v
      f.properties.value2 = v2
      f.properties.hasData = key ? 1 : 0
      if (key) { codes.add(key); vals.push(v); if (lookup2.has(key)) vals2.push(v2) }
    }
    coverage.value = { matched: codes.size, total: lookup.size }

    let fillColor; let fillOpacity
    if (mode.value === 'choropleth') {
      const ba = tercileBreaks(vals); const bb = tercileBreaks(vals2)
      for (const f of geojson.features) {
        f.properties.biv = f.properties.hasData
          ? tercileClass(f.properties.value, ba) * 3 + tercileClass(f.properties.value2, bb) : -1
      }
      const match = ['match', ['get', 'biv']]
      BIV_FLAT.forEach((c, idx) => { match.push(idx, c) })
      match.push('#e0e0e0')
      fillColor = match
      fillOpacity = ['case', NO_DATA, 0.12, 0.82]
      legend.value = { mode: 'choropleth', breaksA: ba, breaksB: bb }
    } else if (mode.value === 'alpha') {
      fillColor = divergingPaint(vals)
      fillOpacity = alphaOpacity(vals2)
      legend.value = { mode: 'alpha', breaksA: [0, 0], breaksB: [0, 0] }
    } else {
      fillColor = stepPaint(vals)
      fillOpacity = 0.75
      legend.value = { mode: 'none', breaksA: [0, 0], breaksB: [0, 0] }
    }

    const apply = () => {
      if (map.getSource('nuts')) {
        map.getSource('nuts').setData(geojson)
      } else {
        map.addSource('nuts', { type: 'geojson', data: geojson })
        map.addLayer({ id: 'nuts-fill', type: 'fill', source: 'nuts', paint: { 'fill-color': fillColor, 'fill-opacity': fillOpacity } })
        map.addLayer({ id: 'nuts-line', type: 'line', source: 'nuts', paint: { 'line-color': '#334155', 'line-width': 0.4 } })
        const onMove = (e) => {
          if (!e.features?.length) return
          map.getCanvas().style.cursor = 'pointer'
          hovered.value = e.features[0].properties
        }
        map.on('mousemove', 'nuts-fill', onMove)
        // touch devices get no mousemove — tap selects the region instead
        map.on('click', 'nuts-fill', onMove)
        map.on('mouseleave', 'nuts-fill', () => {
          map.getCanvas().style.cursor = ''
          hovered.value = null
        })
      }
      map.setPaintProperty('nuts-fill', 'fill-color', fillColor)
      map.setPaintProperty('nuts-fill', 'fill-opacity', fillOpacity)
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
  render()
})
onBeforeUnmount(() => { if (map) { map.remove(); map = null } })
watch(() => [props.rows, props.geoCol, props.valueCol, props.value2Col, props.bivariate, props.level], render, { deep: true })

const fmt = (v) => (v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : `${Math.round(v)}`)
const DIVERGING_STOPS = [DIVERGING.low, DIVERGING.mid, DIVERGING.high]
</script>

<template>
  <div class="smap" data-testid="studio-map">
    <div ref="container" class="smap-canvas" />
    <div class="smap-bar">
      <span v-if="loading" class="muted">{{ $t('studio_map.loading_boundaries') }}</span>
      <span v-else-if="error" class="err">{{ error }}</span>
      <span v-else class="cov" data-testid="map-coverage">
        {{ $t('studio_map.matched') }} {{ coverage.matched }} {{ $t('studio_map.of') }} {{ coverage.total }} {{ $t('studio_map.regions') }}
        <span v-if="coverage.total && coverage.matched === 0" class="warn">{{ $t('studio_map.wrong_column_level') }}</span>
      </span>

      <!-- hover / tap readout: which region, what values -->
      <span v-if="hovered" class="hovbox" data-testid="map-hover-readout">
        <strong>{{ hovered.name || hovered.nuts_code }}</strong>
        <template v-if="hovered.hasData">
          <span>{{ valueCol }}: {{ Number(hovered.value).toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</span>
          <span v-if="value2Col && bivariate !== 'none'">· {{ value2Col }}: {{ Number(hovered.value2).toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</span>
        </template>
        <span v-else class="muted">—</span>
      </span>

      <!-- single-variable legend -->
      <span v-if="!loading && !error && legend.mode === 'none' && bounds.hi" class="legend" data-testid="map-legend-single">
        <span class="muted">{{ valueCol }}:</span>
        <i v-for="c in COLOR_STOPS" :key="c" class="sw" :style="{ background: c }" />
        <span class="muted">{{ fmt(bounds.lo) }}–{{ fmt(bounds.hi) }}</span>
      </span>

      <!-- value-by-alpha legend: diverging colour + opacity note -->
      <span v-else-if="!loading && !error && legend.mode === 'alpha'" class="legend" data-testid="map-legend-alpha">
        <span class="muted">{{ valueCol }}:</span>
        <i v-for="c in DIVERGING_STOPS" :key="c" class="sw" :style="{ background: c }" />
        <span class="muted">{{ fmt(bounds.lo) }}–{{ fmt(bounds.hi) }}</span>
        <span class="muted biv-sep">· {{ $t('studio_map.opacity') }} = {{ value2Col }}</span>
      </span>
    </div>

    <!-- 3×3 bivariate choropleth key -->
    <div v-if="!loading && !error && legend.mode === 'choropleth'" class="biv-key" data-testid="map-legend-biv">
      <div class="biv-grid-wrap">
        <div class="biv-yl">{{ valueCol }} →</div>
        <div class="biv-grid">
          <template v-for="i1 in [2, 1, 0]" :key="'r' + i1">
            <i v-for="i2 in [0, 1, 2]" :key="i1 + '-' + i2" class="biv-cell" :style="{ background: BIVARIATE_3X3[i1][i2] }" />
          </template>
        </div>
      </div>
      <div class="biv-xl">{{ value2Col }} →</div>
    </div>
  </div>
</template>

<style scoped>
.smap { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; position: relative; }
.smap-canvas { height: 26rem; width: 100%; }
.smap-bar { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; padding: 0.5rem 0.7rem; font-size: 0.78rem; border-top: 1px solid var(--border); background: var(--surface); }
.muted { color: var(--muted); }
.err { color: #dc2626; }
.warn { color: #d97706; }
.cov { font-weight: 600; }
.hovbox { display: flex; align-items: center; gap: 0.4rem; }
.legend { display: flex; align-items: center; gap: 0.25rem; margin-left: auto; }
.sw { width: 0.9rem; height: 0.7rem; border-radius: 2px; display: inline-block; }
.biv-sep { margin-left: 0.4rem; }
.biv-key { position: absolute; top: 0.6rem; left: 0.6rem; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.4rem 0.5rem; font-size: 0.66rem; color: var(--muted); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.biv-grid-wrap { display: flex; align-items: center; gap: 0.25rem; }
.biv-yl { writing-mode: vertical-rl; transform: rotate(180deg); font-weight: 600; }
.biv-grid { display: grid; grid-template-columns: repeat(3, 1rem); grid-template-rows: repeat(3, 1rem); gap: 1px; }
.biv-cell { width: 1rem; height: 1rem; display: block; }
.biv-xl { text-align: center; font-weight: 600; margin-top: 0.15rem; padding-left: 0.8rem; }
</style>
