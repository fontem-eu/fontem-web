<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { fetchAggregate, fetchBoundaries } from '../api/geo.js'

const container = ref(null)
let map = null

const level = ref(0)           // 0..3 — only 0 is bundled right now
const metric = ref('companies') // 'companies' | 'contracts' | 'contracts_eur'
const connectedTo = ref('')     // alpha-3, e.g. 'RUS'
const scopeNuts = ref('')
const loading = ref(false)
const error = ref(null)
const regions = ref([])
const hovered = ref(null)

const METRIC_LABELS = {
  companies: 'Companies',
  contracts: 'Contracts',
  contracts_eur: 'Contracts (€)',
}

// Sequential blue palette — indexed 0..5 (lightest → darkest).
const COLOR_STOPS = ['#f1f5f9', '#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a']

function valueLabel(v) {
  if (metric.value === 'contracts_eur') {
    if (v >= 1e9) return `€${(v / 1e9).toFixed(1)}B`
    if (v >= 1e6) return `€${(v / 1e6).toFixed(1)}M`
    if (v >= 1e3) return `€${(v / 1e3).toFixed(1)}K`
    return `€${Math.round(v)}`
  }
  return v.toLocaleString()
}

async function refresh() {
  loading.value = true
  error.value = null
  try {
    // Level 3 requires a scope — enforce client-side for a friendlier UX.
    if (level.value === 3 && !scopeNuts.value) {
      throw new Error('Pick a NUTS 1 parent region to query at NUTS 3.')
    }
    const [agg, geo] = await Promise.all([
      fetchAggregate({
        level: level.value,
        metric: metric.value,
        scopeNuts: scopeNuts.value || undefined,
        connectedToCountry: connectedTo.value || undefined,
      }),
      fetchBoundaries(level.value),
    ])
    regions.value = agg.regions
    applyChoropleth(geo, agg.regions)
  } catch (err) {
    error.value = err.message
    regions.value = []
  } finally {
    loading.value = false
  }
}

function applyChoropleth(geojson, rows) {
  if (!map) return
  // Build code → value lookup; compute quantile thresholds for color stops.
  const byCode = new Map(rows.map((r) => [r.nuts_code, r.value]))
  const values = rows.map((r) => r.value).filter((v) => v > 0).sort((a, b) => a - b)
  const thresholds = COLOR_STOPS.slice(1).map((_, i) => {
    const idx = Math.floor(((i + 1) / COLOR_STOPS.length) * values.length)
    return values[Math.max(0, idx - 1)] || 0
  })
  // Inject value into each feature property for data-driven styling.
  for (const f of geojson.features) {
    f.properties.value = byCode.get(f.properties.nuts_code) ?? 0
  }

  const addOrUpdate = () => {
    if (map.getSource('nuts')) {
      map.getSource('nuts').setData(geojson)
    } else {
      map.addSource('nuts', { type: 'geojson', data: geojson })
      map.addLayer({
        id: 'nuts-fill',
        type: 'fill',
        source: 'nuts',
        paint: {
          'fill-color': [
            'step',
            ['get', 'value'],
            COLOR_STOPS[0],
            ...thresholds.flatMap((t, i) => [t, COLOR_STOPS[i + 1]]),
          ],
          'fill-opacity': 0.7,
        },
      })
      map.addLayer({
        id: 'nuts-line',
        type: 'line',
        source: 'nuts',
        paint: { 'line-color': '#334155', 'line-width': 0.5 },
      })
      map.on('mousemove', 'nuts-fill', (e) => {
        if (!e.features?.length) return
        map.getCanvas().style.cursor = 'pointer'
        hovered.value = e.features[0].properties
      })
      map.on('mouseleave', 'nuts-fill', () => {
        map.getCanvas().style.cursor = ''
        hovered.value = null
      })
    }
    // Recompute the stops each refresh (values change with filters).
    map.setPaintProperty('nuts-fill', 'fill-color', [
      'step',
      ['get', 'value'],
      COLOR_STOPS[0],
      ...thresholds.flatMap((t, i) => [t, COLOR_STOPS[i + 1]]),
    ])
  }

  if (map.isStyleLoaded()) addOrUpdate()
  else map.once('load', addOrUpdate)
}

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
    center: [10, 51],   // roughly central Europe
    zoom: 3,
  })
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  refresh()
})

onBeforeUnmount(() => {
  if (map) { map.remove(); map = null }
})

// Re-query when any filter changes.
watch([level, metric, connectedTo, scopeNuts], () => refresh())
</script>

<template>
  <div class="geo-choropleth" data-testid="geo-choropleth">
    <div class="geo-controls" data-testid="geo-controls">
      <label class="geo-control">
        <span class="geo-label">{{ $t('app.nuts_level') }}</span>
        <select v-model.number="level" data-testid="geo-level">
          <option :value="0">{{ $t('geo_choropleth.level_0_country') }}</option>
          <option :value="1" disabled>{{ $t('geo_choropleth.level_1_macro_region_coming_soon') }}</option>
          <option :value="2" disabled>{{ $t('geo_choropleth.level_2_region_coming_soon') }}</option>
          <option :value="3" disabled>{{ $t('geo_choropleth.level_3_small_region_coming_soon') }}</option>
        </select>
      </label>

      <label class="geo-control">
        <span class="geo-label">{{ $t('app.metric') }}</span>
        <select v-model="metric" data-testid="geo-metric">
          <option value="companies">{{ $t('geo_choropleth.companies') }}</option>
          <option value="contracts">{{ $t('app.contracts') }}</option>
          <option value="contracts_eur">{{ $t('app.contracts_eur') }}</option>
        </select>
      </label>

      <label class="geo-control">
        <span class="geo-label">{{ $t('geo_choropleth.connected_to_3') }}</span>
        <input
          v-model="connectedTo"
          type="text"
          :placeholder="$t('geo_choropleth.eg_rus')"
          class="geo-input"
          data-testid="geo-connected-to"
          maxlength="3"
        />
      </label>

      <label v-if="level === 3" class="geo-control">
        <span class="geo-label">{{ $t('geo_choropleth.parent_nuts_1') }}</span>
        <input
          v-model="scopeNuts"
          type="text"
          :placeholder="$t('geo_choropleth.eg_de1')"
          class="geo-input"
          data-testid="geo-scope-nuts"
          maxlength="3"
        />
      </label>
    </div>

    <div v-if="loading" class="geo-status" data-testid="geo-loading">{{ $t('app.loading') }}</div>
    <div v-if="error" class="geo-error" data-testid="geo-error">{{ error }}</div>

    <div ref="container" class="geo-map" data-testid="geo-map"></div>

    <!-- Hover readout -->
    <div
      v-if="hovered"
      class="geo-hover"
      data-testid="geo-hover"
    >
      <strong>{{ hovered.name }}</strong>
      <span class="geo-hover__code">{{ hovered.nuts_code }}</span>
      <span class="geo-hover__value">
        {{ METRIC_LABELS[metric] }}: {{ valueLabel(hovered.value || 0) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.geo-choropleth {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
}

.geo-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.geo-control {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}

.geo-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--muted);
  letter-spacing: 0.05em;
}

.geo-input,
.geo-control select {
  padding: 3px 6px;
  font-size: 12px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  border-radius: 3px;
}

.geo-input {
  width: 100px;
  text-transform: uppercase;
}

.geo-map {
  flex: 1;
  min-height: 500px;
  border: 1px solid var(--border);
  border-radius: 4px;
}

.geo-status,
.geo-error {
  padding: 8px;
  font-size: 12px;
  color: var(--muted);
}

.geo-error {
  color: #ef4444;
}

.geo-hover {
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

.geo-hover__code {
  font-size: 10px;
  color: var(--muted);
  text-transform: uppercase;
}

.geo-hover__value {
  font-size: 11px;
  font-weight: 600;
}
</style>
