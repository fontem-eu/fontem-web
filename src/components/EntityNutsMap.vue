<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { fetchEntityAggregate, fetchBoundaries } from '../api/geo.js'
import PocketButton from './PocketButton.vue'
import AtlasLegend from '../widgets/atlas/AtlasLegend.vue'
import MapLoadingOverlay from '../widgets/atlas/MapLoadingOverlay.vue'
import {
  buildColorExpression,
  NULL_COLOR,
} from '../widgets/atlas/colorScale.js'
import { useAtlasPalette } from '../composables/useAtlasPalette.js'

const { palette: atlasPalette } = useAtlasPalette()

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

// Per-aggregate (data-driven) bounds; this map doesn't have a
// pre-computed dataset_slice_stats source the way Atlas does. Falls
// back to viridis/PuOr from the shared colour-scale module so the
// palette + null colour are consistent across the platform.
const choroplethBounds = computed(() => {
  const positives = (lastRows.value || [])
    .map((r) => r.value)
    .filter((v) => v != null && v > 0)
    .sort((a, b) => a - b)
  if (positives.length === 0) return null
  return [positives[0], positives[positives.length - 1]]
})
const colorScaleProps = computed(() => ({
  bounds: choroplethBounds.value,
  kind: 'sequential',
  log: false,
  palette: atlasPalette.value,
}))
// Last applied rows — kept around so the bounds computed survives a
// re-render between fetches.
const lastRows = ref([])

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
  lastRows.value = rows
  const byCode = new Map(rows.map((r) => [r.nuts_code, r.value]))

  for (const f of geojson.features) {
    const v = byCode.get(f.properties.nuts_code)
    if (v == null || v === 0) {
      // 0 is "this entity has no presence here" which is logically
      // distinct from a value-zero observation — render as no-data
      // so the palette ramp doesn't waste its bottom bucket on it.
      delete f.properties.value
    } else {
      f.properties.value = v
    }
  }

  const colorExpr = buildColorExpression(colorScaleProps.value)

  const addOrUpdate = () => {
    if (map.getSource('enu')) {
      map.getSource('enu').setData(geojson)
      map.setPaintProperty('enu-fill', 'fill-color', colorExpr)
    } else {
      map.addSource('enu', { type: 'geojson', data: geojson })
      // No-data layer first so it sits beneath the data fill.
      map.addLayer({
        id: 'enu-null',
        type: 'fill',
        source: 'enu',
        filter: ['!', ['has', 'value']],
        paint: { 'fill-color': NULL_COLOR, 'fill-opacity': 0.55 },
      })
      map.addLayer({
        id: 'enu-fill',
        type: 'fill',
        source: 'enu',
        filter: ['has', 'value'],
        paint: { 'fill-color': colorExpr, 'fill-opacity': 0.78 },
      })
      map.addLayer({
        id: 'enu-line',
        type: 'line',
        source: 'enu',
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
      map.on('mousemove', 'enu-fill', onMove)
      map.on('mousemove', 'enu-null', onMove)
      map.on('mouseleave', 'enu-fill', onLeave)
      map.on('mouseleave', 'enu-null', onLeave)
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
// Re-paint when the user picks a different palette in preferences.
// `refresh()` re-fetches data + geojson and re-renders; the
// network round-trip is fine for a one-off palette change.
watch(atlasPalette, () => { if (map) refresh() })

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
        <span class="enu-label">{{ $t('app.nuts_level') }}</span>
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
        <span class="enu-label">{{ $t('app.metric') }}</span>
        <select v-model="metric" data-testid="enu-metric">
          <option value="contracts">{{ $t('entity_nuts_map.contracts_count') }}</option>
          <option value="contracts_eur">{{ $t('app.contracts_eur') }}</option>
        </select>
      </label>

      <PocketButton
        widget-type="entity_nuts_map"
        :config="pocketConfig"
        :default-name="pocketName"
      />
    </div>

    <!-- Error keeps its existing prominent position above the map.
         Loading state moves ON the map below as a blocking overlay,
         so the user gets immediate feedback during fetch (vs an
         ambiguous blank map). The legacy `enu-loading` testid is
         preserved on a hidden compatibility shim so the existing
         smoke-test selector keeps working. -->
    <div v-if="error" class="enu-error" data-testid="enu-error">{{ error }}</div>

    <div v-if="level > 0 && !scope" class="enu-hint" data-testid="enu-hint">
      Select a {{ SCOPE_LABELS[level] }} above to load the map.
    </div>

    <div class="enu-map-stack">
      <div ref="container" class="enu-map" data-testid="enu-map" />
      <MapLoadingOverlay :loading="loading" message="Loading map…" />
      <!-- Compat shim: the smoke + unit tests target `enu-loading`
           by selector; keep the testid present (visually hidden)
           while the loading state is active. Future cleanup: rename
           the test selector to `map-loading-overlay` and drop this. -->
      <span
        v-if="loading"
        class="enu-loading-compat"
        data-testid="enu-loading"
        aria-hidden="true"
      />

      <AtlasLegend
        v-if="colorScaleProps.bounds"
        class="enu-legend"
        :bounds="colorScaleProps.bounds"
        :kind="colorScaleProps.kind"
        :palette="colorScaleProps.palette"
        :unit="metric === 'contracts_eur' ? 'EUR' : 'contracts'"
      />
    </div>

    <div v-if="hovered" class="enu-hover" data-testid="enu-hover">
      <strong>{{ hovered.name }}</strong>
      <span class="enu-hover__code">{{ hovered.nuts_code }}</span>
      <span v-if="hovered.value != null" class="enu-hover__value">
        {{ metric === 'contracts_eur' ? `€${Number(hovered.value).toLocaleString()}` : Number(hovered.value).toLocaleString() }}
        {{ metric === 'contracts' ? 'contracts' : '' }}
      </span>
      <span v-else class="enu-hover__value muted" data-testid="enu-hover-empty">no known contracts</span>
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

.enu-map-stack {
  position: relative;
  display: flex;
  flex-direction: column;
}

.enu-map {
  flex: 1;
  min-height: 500px;
  border: 1px solid var(--border);
  border-radius: 4px;
}

/* Compat shim: keeps the smoke-test selector `enu-loading` reachable
   without showing a redundant inline status bar. The actual loading
   feedback comes from MapLoadingOverlay; this is just a hook for
   the test gate. */
.enu-loading-compat {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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
.enu-hover__value.muted {
  color: var(--muted);
  font-weight: 500;
  font-style: italic;
}

.enu-legend {
  position: absolute;
  bottom: 12px;
  right: 12px;
  z-index: 11;
  background: var(--bg);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
</style>
