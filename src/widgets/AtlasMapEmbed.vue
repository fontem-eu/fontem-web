<script setup>
/**
 * Atlas Map Embed — a saved snapshot of an Atlas choropleth.
 *
 * Renders one (dataset, nuts_level, year, dimensions) slice as a static
 * map. Unlike `AtlasView` (the explorer), there are no controls — the
 * widget represents a deliberate save, not a live picker. A small
 * "Open in Atlas" link launches the explorer with the same params if
 * the reader wants to dig deeper.
 *
 * Map + choropleth styling mirrors AtlasView for visual continuity;
 * shared into a util once we have a third consumer.
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { fetchDatasets, fetchSeries, fetchSliceStats } from '../api/atlas.js'
import { fetchBoundaries } from '../api/geo.js'
import AtlasLegend from './atlas/AtlasLegend.vue'
import MapLoadingOverlay from './atlas/MapLoadingOverlay.vue'
import {
  buildColorExpression,
  deriveBounds,
  findSliceStats,
  NULL_COLOR,
} from './atlas/colorScale.js'
import { useAtlasPalette } from '../composables/useAtlasPalette.js'

const { palette: atlasPalette } = useAtlasPalette()

const props = defineProps({
  config: { type: Object, default: () => ({}) },
})

const dataset = computed(() => props.config.dataset || '')
const nutsLevel = computed(() => {
  const n = Number(props.config.nuts_level)
  return Number.isFinite(n) ? n : 2
})
const year = computed(() => {
  const y = Number(props.config.year)
  return Number.isFinite(y) ? y : null
})
const dimFilter = computed(() => props.config.dimensions || null)

function storeState() {
  return {
    dataset: dataset.value,
    nuts_level: nutsLevel.value,
    year: year.value,
    dimensions: dimFilter.value,
  }
}
defineExpose({ storeState, widgetType: 'atlas_map' })

const atlasUrl = computed(() => {
  if (!dataset.value) return '/map'
  const q = new URLSearchParams()
  q.set('dataset', dataset.value)
  q.set('level', String(nutsLevel.value))
  if (year.value != null) q.set('year', String(year.value))
  if (dimFilter.value) q.set('slice', JSON.stringify(dimFilter.value))
  return `/map?${q.toString()}`
})

// ── State ──────────────────────────────────────────────────────────
const meta = ref(null)              // dataset catalog row
const observations = ref([])
const sliceStats = ref([])          // slice stats for the embedded dataset
const loading = ref(false)
const error = ref(null)
const hovered = ref(null)
const container = ref(null)
let map = null

// ── Derived ────────────────────────────────────────────────────────
const sliceLabel = computed(() => {
  if (!dimFilter.value) return ''
  const labels = meta.value?.dim_labels || {}
  return Object.entries(dimFilter.value)
    .map(([k, v]) => labels?.[k]?.[v] || v)
    .join(' × ')
})

const choroplethRows = computed(() => {
  if (year.value == null) return []
  const targetKey = dimFilter.value ? JSON.stringify(dimFilter.value) : null
  const out = []
  for (const o of observations.value) {
    if (o.year !== year.value) continue
    if (o.value == null) continue
    if (targetKey && JSON.stringify(o.dimensions || {}) !== targetKey) continue
    out.push({ nuts_code: o.geo_code, value: o.value })
  }
  return out
})

// Slice stats for the embedded slice — drives the legend + locked
// colour scale. Embeds always lock to the dataset-wide range
// (a saved snapshot that re-renders with a different scale on every
// load would defeat the point of saving it). When the backend has
// no stats yet, fall back to per-data bounds.
const sliceStatsKey = computed(() => (
  dimFilter.value ? JSON.stringify(dimFilter.value) : '{}'
))
const activeSliceStats = computed(
  () => findSliceStats(sliceStats.value, sliceStatsKey.value),
)
const colorScaleProps = computed(() => {
  if (activeSliceStats.value) {
    return {
      bounds: deriveBounds(activeSliceStats.value),
      kind: activeSliceStats.value.value_kind || 'sequential',
      log: false,
      palette: atlasPalette.value,
    }
  }
  // Fallback: per-data bounds.
  const positives = choroplethRows.value
    .map((r) => r.value)
    .filter((v) => v != null)
    .sort((a, b) => a - b)
  if (positives.length === 0) {
    return { bounds: null, kind: 'sequential', log: false, palette: atlasPalette.value }
  }
  return {
    bounds: [positives[0], positives[positives.length - 1]],
    kind: 'sequential',
    log: false,
    palette: atlasPalette.value,
  }
})

async function renderMap() {
  if (!map) return
  let geo
  try {
    geo = await fetchBoundaries(nutsLevel.value)
  } catch (err) {
    error.value = `Boundaries: ${err.message}`
    return
  }
  const byCode = new Map(choroplethRows.value.map((r) => [r.nuts_code, r.value]))
  for (const f of geo.features) {
    const v = byCode.get(f.properties.nuts_code)
    if (v == null) {
      delete f.properties.value
    } else {
      f.properties.value = v
    }
  }
  const colorExpr = buildColorExpression(colorScaleProps.value)
  const apply = () => {
    if (map.getSource('atlas-embed')) {
      map.getSource('atlas-embed').setData(geo)
      map.setPaintProperty('atlas-embed-fill', 'fill-color', colorExpr)
    } else {
      map.addSource('atlas-embed', { type: 'geojson', data: geo })
      // null layer first so it sits beneath the data layer's borders.
      map.addLayer({
        id: 'atlas-embed-null', type: 'fill', source: 'atlas-embed',
        filter: ['!', ['has', 'value']],
        paint: { 'fill-color': NULL_COLOR, 'fill-opacity': 0.55 },
      })
      map.addLayer({
        id: 'atlas-embed-fill', type: 'fill', source: 'atlas-embed',
        filter: ['has', 'value'],
        paint: { 'fill-color': colorExpr, 'fill-opacity': 0.78 },
      })
      map.addLayer({
        id: 'atlas-embed-line', type: 'line', source: 'atlas-embed',
        paint: { 'line-color': '#334155', 'line-width': 0.5 },
      })
      const onMove = (e) => {
        if (!e.features?.length) return
        map.getCanvas().style.cursor = 'pointer'
        hovered.value = e.features[0].properties
      }
      const onLeave = () => {
        map.getCanvas().style.cursor = ''
        hovered.value = null
      }
      map.on('mousemove', 'atlas-embed-fill', onMove)
      map.on('mousemove', 'atlas-embed-null', onMove)
      map.on('mouseleave', 'atlas-embed-fill', onLeave)
      map.on('mouseleave', 'atlas-embed-null', onLeave)
      // touch devices get no mousemove — tap selects the region instead
      map.on('click', 'atlas-embed-fill', onMove)
      map.on('click', 'atlas-embed-null', onMove)
    }
  }
  if (map.isStyleLoaded()) apply()
  else map.once('load', apply)
}

// ── Data fetching ──────────────────────────────────────────────────
async function loadAll() {
  if (!dataset.value) {
    error.value = 'Atlas widget: dataset is required'
    return
  }
  loading.value = true
  error.value = null
  try {
    // Catalog metadata + series + slice stats fetched in parallel.
    // Slice stats are pulled per-dataset (lazy) because the catalog
    // would otherwise carry tens of thousands of slice rows for
    // migration cubes — see /atlas/datasets/{code}/slice-stats.
    const [cat, resp, slices] = await Promise.all([
      fetchDatasets(),
      fetchSeries({
        dataset: dataset.value,
        nutsLevel: nutsLevel.value,
      }),
      fetchSliceStats(dataset.value).catch(() => []),
    ])
    meta.value = cat.find((d) => d.code === dataset.value) || null
    observations.value = resp.data || []
    sliceStats.value = Array.isArray(slices) ? slices : []
    await renderMap()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

watch(() => [dataset.value, nutsLevel.value, year.value], () => loadAll())
watch(choroplethRows, () => renderMap())
// Re-paint when the user picks a different palette in preferences.
watch(atlasPalette, () => renderMap())

onMounted(() => {
  if (!container.value) return
  map = new maplibregl.Map({
    container: container.value,
    preserveDrawingBuffer: true,
    // Inline OSM raster style — CSP allows tile.openstreetmap.org but NOT the
    // external openfreemap.org style URL, so fetching that style silently never
    // fires maplibre's 'load' event and the choropleth layer is never added
    // (the widget renders blank). Mirror AtlasView, which uses this same style.
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    center: [10, 52],
    zoom: 3,
  })
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  loadAll()
})

onBeforeUnmount(() => {
  if (map) { map.remove(); map = null }
})
</script>

<template>
  <div class="atlas-embed" data-testid="widget-atlas-map">
    <header class="atlas-embed-header">
      <div class="atlas-embed-title">
        <strong>{{ meta?.label || dataset || 'Atlas Map' }}</strong>
        <span v-if="sliceLabel" class="atlas-embed-slice">{{ sliceLabel }}</span>
        <span v-if="year != null" class="atlas-embed-year">— {{ year }}</span>
      </div>
      <a class="atlas-embed-link" :href="atlasUrl" target="_blank" rel="noopener">{{ $t('atlas_map_embed.open_in_atlas') }}</a>
    </header>

    <div v-if="error" class="atlas-embed-error" data-testid="widget-atlas-error">
      {{ error }}
    </div>

    <div class="atlas-embed-map-stack">
      <div ref="container" class="atlas-embed-map" />
      <!-- Loading overlay over the map (blocks pointer events
           during fetch) — replaces the easy-to-miss inline
           "Loading…" line above the map. -->
      <MapLoadingOverlay
        :loading="loading"
        message="Loading map data…"
        data-testid="widget-atlas-loading"
      />
    </div>

    <AtlasLegend
      v-if="colorScaleProps.bounds"
      class="atlas-embed-legend"
      :bounds="colorScaleProps.bounds"
      :kind="colorScaleProps.kind"
      :log="colorScaleProps.log"
      :palette="colorScaleProps.palette"
    />

    <div v-if="hovered && hovered.value != null" class="atlas-embed-hover">
      <strong>{{ hovered.name }}</strong>
      <span>{{ hovered.nuts_code }}</span>
      <span>{{ hovered.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</span>
    </div>
    <div v-else-if="hovered" class="atlas-embed-hover muted">
      <strong>{{ hovered.name }}</strong>
      <span>{{ hovered.nuts_code }}</span>
      <span>no data</span>
    </div>
  </div>
</template>

<style scoped>
.atlas-embed {
  border: 1px solid var(--border, #ddd);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  background: var(--bg, #fff);
}
.atlas-embed-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border, #eee);
  font-size: 0.85rem;
}
.atlas-embed-title { display: flex; gap: 0.4rem; align-items: baseline; flex-wrap: wrap; }
.atlas-embed-slice { color: var(--muted, #666); font-size: 0.8rem; }
.atlas-embed-year { color: var(--muted, #666); font-size: 0.8rem; }
.atlas-embed-link { font-size: 0.78rem; white-space: nowrap; }
.atlas-embed-error {
  padding: 1rem; font-size: 0.85rem; color: #b91c1c;
}
.atlas-embed-map-stack { position: relative; }
.atlas-embed-map { height: 360px; width: 100%; }
.atlas-embed-hover {
  position: absolute; left: 0.5rem; bottom: 0.5rem;
  background: rgba(255,255,255,0.92);
  border: 1px solid var(--border, #ddd);
  border-radius: 4px; padding: 0.4rem 0.6rem;
  display: flex; gap: 0.5rem; font-size: 0.8rem;
  pointer-events: none;
}
.atlas-embed-hover.muted {
  color: var(--muted, #666);
  font-style: italic;
}
.atlas-embed-legend {
  position: absolute; right: 0.5rem; bottom: 0.5rem;
  z-index: 5;
}
</style>
