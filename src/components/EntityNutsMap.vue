<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { fetchEntityAggregate, fetchBoundaries } from '../api/geo.js'
import PocketButton from './PocketButton.vue'

const props = defineProps({
  entityId: { type: String, required: true },
})

const container = ref(null)
let map = null

const level     = ref(0)
const metric    = ref('contracts')
const scope     = ref('')         // selected parent NUTS code
const loading   = ref(false)
const error     = ref(null)
const hovered   = ref(null)
const scopeOptions = ref([])      // [{code, name}] for the scope dropdown

// Blue → red sequential color scale (low = blue, high = red)
const COLOR_STOPS = ['#eff6ff', '#bfdbfe', '#60a5fa', '#fbbf24', '#f97316', '#dc2626']

function buildColorExpression(rows) {
  const positives = rows.map((r) => r.value).filter((v) => v > 0).sort((a, b) => a - b)
  // No data → everything stays the baseline tint
  if (positives.length === 0) return COLOR_STOPS[0]
  // Pick quantile thresholds, then dedupe so MapLibre's step expression has
  // strictly-increasing stops.  Duplicates silently break the fill layer.
  const buckets = COLOR_STOPS.length - 1
  const raw = Array.from({ length: buckets }, (_, i) => {
    const idx = Math.floor(((i + 1) / (buckets + 1)) * positives.length)
    return positives[Math.min(positives.length - 1, Math.max(0, idx))]
  })
  const thresholds = []
  for (const t of raw) {
    const last = thresholds[thresholds.length - 1]
    if (last === undefined || t > last) thresholds.push(t)
  }
  // First entry must be > 0 so value=0 regions still render as COLOR_STOPS[0].
  if (thresholds[0] === 0) thresholds[0] = Math.min(...positives)
  return [
    'step',
    ['get', 'value'],
    COLOR_STOPS[0],
    ...thresholds.flatMap((t, i) => [t, COLOR_STOPS[i + 1]]),
  ]
}

const SCOPE_LABELS = {
  1: 'Country (NUTS 0)',
  2: 'NUTS 1 macro-region',
  3: 'NUTS 2 region',
}

const pocketConfig = computed(() => ({
  entityId: props.entityId,
  level: level.value,
  metric: metric.value,
  scopeNuts: scope.value || undefined,
}))
const pocketName = computed(() => `Business Map — ${props.entityId}`)

async function loadScopeOptions() {
  if (level.value === 0) { scopeOptions.value = []; return }
  try {
    const geo = await fetchBoundaries(level.value - 1)
    scopeOptions.value = geo.features.map((f) => ({
      code: f.properties.nuts_code,
      name: f.properties.name,
    })).sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    scopeOptions.value = []
  }
}

async function refresh() {
  // For level > 0 a parent scope is required before fetching
  if (level.value > 0 && !scope.value) return

  loading.value = true
  error.value = null
  try {
    const [agg, geo] = await Promise.all([
      fetchEntityAggregate(props.entityId, {
        level: level.value,
        metric: metric.value,
        scopeNuts: scope.value || undefined,
      }),
      fetchBoundaries(level.value),
    ])
    applyChoropleth(geo, agg.regions)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function applyChoropleth(geojson, rows) {
  if (!map) return
  const byCode = new Map(rows.map((r) => [r.nuts_code, r.value]))

  for (const f of geojson.features) {
    f.properties.value = byCode.get(f.properties.nuts_code) ?? 0
  }

  const colorExpr = buildColorExpression(rows)

  const addOrUpdate = () => {
    if (map.getSource('enu')) {
      map.getSource('enu').setData(geojson)
      map.setPaintProperty('enu-fill', 'fill-color', colorExpr)
    } else {
      map.addSource('enu', { type: 'geojson', data: geojson })
      map.addLayer({
        id: 'enu-fill',
        type: 'fill',
        source: 'enu',
        paint: { 'fill-color': colorExpr, 'fill-opacity': 0.7 },
      })
      map.addLayer({
        id: 'enu-line',
        type: 'line',
        source: 'enu',
        paint: { 'line-color': '#334155', 'line-width': 0.5 },
      })
      map.on('mousemove', 'enu-fill', (e) => {
        if (!e.features?.length) return
        map.getCanvas().style.cursor = 'pointer'
        hovered.value = e.features[0].properties
      })
      map.on('mouseleave', 'enu-fill', () => {
        map.getCanvas().style.cursor = ''
        hovered.value = null
      })
    }
  }

  if (map.isStyleLoaded()) addOrUpdate()
  else map.once('load', addOrUpdate)
}

watch(level, () => {
  scope.value = ''
  loadScopeOptions()
  refresh()
})

watch([metric, scope], () => refresh())

onMounted(() => {
  map = new maplibregl.Map({
    container: container.value,
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
    center: [10, 51],
    zoom: 3,
  })
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  loadScopeOptions()
  refresh()
})

onBeforeUnmount(() => {
  if (map) { map.remove(); map = null }
})
</script>

<template>
  <div class="enu" data-testid="entity-nuts-map">
    <!-- Controls bar -->
    <div class="enu-controls" data-testid="enu-controls">
      <label class="enu-control">
        <span class="enu-label">NUTS level</span>
        <select v-model.number="level" data-testid="enu-level">
          <option :value="0">0 — Country</option>
          <option :value="1">1 — Macro-region</option>
          <option :value="2">2 — Region</option>
          <option :value="3">3 — Small region</option>
        </select>
      </label>

      <label v-if="level > 0" class="enu-control">
        <span class="enu-label" data-testid="enu-scope-label">{{ SCOPE_LABELS[level] }}</span>
        <select v-model="scope" data-testid="enu-scope">
          <option value="">— select —</option>
          <option v-for="opt in scopeOptions" :key="opt.code" :value="opt.code">
            {{ opt.code }} — {{ opt.name }}
          </option>
        </select>
      </label>

      <label class="enu-control">
        <span class="enu-label">Metric</span>
        <select v-model="metric" data-testid="enu-metric">
          <option value="contracts">Contracts (count)</option>
          <option value="contracts_eur">Contracts (EUR)</option>
        </select>
      </label>

      <PocketButton
        widget-type="entity_nuts_map"
        :config="pocketConfig"
        :default-name="pocketName"
      />
    </div>

    <div v-if="loading" class="enu-status" data-testid="enu-loading">Loading…</div>
    <div v-if="error" class="enu-error" data-testid="enu-error">{{ error }}</div>

    <div v-if="level > 0 && !scope" class="enu-hint" data-testid="enu-hint">
      Select a {{ SCOPE_LABELS[level] }} above to load the map.
    </div>

    <div ref="container" class="enu-map" data-testid="enu-map" />

    <div v-if="hovered" class="enu-hover" data-testid="enu-hover">
      <strong>{{ hovered.name }}</strong>
      <span class="enu-hover__code">{{ hovered.nuts_code }}</span>
      <span class="enu-hover__value">
        {{ metric === 'contracts_eur' ? `€${Number(hovered.value || 0).toLocaleString()}` : (hovered.value || 0).toLocaleString() }}
        {{ metric === 'contracts' ? 'contracts' : '' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.enu {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
}

.enu-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
  padding: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.enu-control {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}

.enu-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--muted);
  letter-spacing: 0.05em;
}

.enu-control select {
  padding: 3px 6px;
  font-size: 12px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  border-radius: 3px;
  min-width: 180px;
}

.enu-map {
  flex: 1;
  min-height: 500px;
  border: 1px solid var(--border);
  border-radius: 4px;
}

.enu-status,
.enu-hint {
  padding: 8px;
  font-size: 12px;
  color: var(--muted);
}

.enu-error {
  padding: 8px;
  font-size: 12px;
  color: #ef4444;
}

.enu-hover {
  position: absolute;
  bottom: 12px;
  left: 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  gap: 2px;
  pointer-events: none;
  z-index: 10;
}

.enu-hover__code {
  font-size: 10px;
  color: var(--muted);
  text-transform: uppercase;
}

.enu-hover__value {
  font-size: 11px;
  font-weight: 600;
}
</style>
