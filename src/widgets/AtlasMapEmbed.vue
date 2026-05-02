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
import { fetchDatasets, fetchSeries } from '../api/atlas.js'
import { fetchBoundaries } from '../api/geo.js'

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
  if (!dataset.value) return '/atlas'
  const q = new URLSearchParams()
  q.set('dataset', dataset.value)
  q.set('level', String(nutsLevel.value))
  if (year.value != null) q.set('year', String(year.value))
  if (dimFilter.value) q.set('slice', JSON.stringify(dimFilter.value))
  return `/atlas?${q.toString()}`
})

// ── State ──────────────────────────────────────────────────────────
const meta = ref(null)              // dataset catalog row
const observations = ref([])
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

// ── Map render ─────────────────────────────────────────────────────
const COLOR_STOPS = [
  '#eff6ff', '#bfdbfe', '#60a5fa', '#fbbf24', '#f97316', '#dc2626',
]

function buildColorExpression(rows) {
  const positives = rows.map((r) => r.value).filter((v) => v > 0).sort((a, b) => a - b)
  if (positives.length === 0) return COLOR_STOPS[0]
  const unique = [...new Set(positives)]
  if (unique.length === 1) {
    return ['step', ['get', 'value'], COLOR_STOPS[0],
      unique[0], COLOR_STOPS[COLOR_STOPS.length - 1]]
  }
  const n = Math.min(unique.length, COLOR_STOPS.length - 1)
  const stops = []
  for (let i = 0; i < n; i++) {
    const valueIdx = Math.floor((i * unique.length) / n)
    const colorIdx = 1 + Math.round((i * (COLOR_STOPS.length - 2)) / (n - 1))
    stops.push([unique[valueIdx], COLOR_STOPS[colorIdx]])
  }
  return [
    'step', ['get', 'value'],
    COLOR_STOPS[0],
    ...stops.flatMap(([v, c]) => [v, c]),
  ]
}

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
    f.properties.value = byCode.get(f.properties.nuts_code) ?? null
  }
  const colorExpr = buildColorExpression(choroplethRows.value)
  const apply = () => {
    if (map.getSource('atlas-embed')) {
      map.getSource('atlas-embed').setData(geo)
      map.setPaintProperty('atlas-embed-fill', 'fill-color', colorExpr)
    } else {
      map.addSource('atlas-embed', { type: 'geojson', data: geo })
      map.addLayer({
        id: 'atlas-embed-fill', type: 'fill', source: 'atlas-embed',
        paint: { 'fill-color': colorExpr, 'fill-opacity': 0.7 },
      })
      map.addLayer({
        id: 'atlas-embed-line', type: 'line', source: 'atlas-embed',
        paint: { 'line-color': '#334155', 'line-width': 0.5 },
      })
      map.on('mousemove', 'atlas-embed-fill', (e) => {
        if (!e.features?.length) return
        map.getCanvas().style.cursor = 'pointer'
        hovered.value = e.features[0].properties
      })
      map.on('mouseleave', 'atlas-embed-fill', () => {
        map.getCanvas().style.cursor = ''
        hovered.value = null
      })
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
    // Catalog metadata for the label + dim_labels.
    const cat = await fetchDatasets()
    meta.value = cat.find((d) => d.code === dataset.value) || null

    // Series for the (dataset, nuts_level) — same shape AtlasView uses.
    const resp = await fetchSeries({
      dataset: dataset.value,
      nutsLevel: nutsLevel.value,
    })
    observations.value = resp.data || []
    await renderMap()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

watch(() => [dataset.value, nutsLevel.value, year.value], () => loadAll())
watch(choroplethRows, () => renderMap())

onMounted(() => {
  if (!container.value) return
  map = new maplibregl.Map({
    container: container.value,
    style: 'https://tiles.openfreemap.org/styles/positron',
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
      <a class="atlas-embed-link" :href="atlasUrl" target="_blank" rel="noopener">
        Open in Atlas →
      </a>
    </header>

    <div v-if="loading" class="atlas-embed-status" data-testid="widget-atlas-loading">
      Loading…
    </div>
    <div v-if="error" class="atlas-embed-error" data-testid="widget-atlas-error">
      {{ error }}
    </div>

    <div ref="container" class="atlas-embed-map" />

    <div v-if="hovered && hovered.value != null" class="atlas-embed-hover">
      <strong>{{ hovered.name }}</strong>
      <span>{{ hovered.nuts_code }}</span>
      <span>{{ hovered.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</span>
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
.atlas-embed-status, .atlas-embed-error {
  padding: 1rem; font-size: 0.85rem; color: var(--muted, #666);
}
.atlas-embed-error { color: #b91c1c; }
.atlas-embed-map { height: 360px; width: 100%; }
.atlas-embed-hover {
  position: absolute; right: 0.5rem; bottom: 0.5rem;
  background: rgba(255,255,255,0.92);
  border: 1px solid var(--border, #ddd);
  border-radius: 4px; padding: 0.4rem 0.6rem;
  display: flex; gap: 0.5rem; font-size: 0.8rem;
  pointer-events: none;
}
</style>
