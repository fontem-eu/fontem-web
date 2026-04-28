<script setup>
/**
 * Atlas — interactive map for the curated Eurostat datasets.
 *
 * v1 surfaces a single variable on a NUTS choropleth. Pick a dataset,
 * pick a NUTS level (constrained by what each dataset supports), pick a
 * year on the slider — the map recolours. Bivariate (X × Y) is the
 * planned next step and reuses the same controls.
 *
 * Dim slices: most Eurostat datasets carry a multi-dim cube (e.g.
 * sex × age). We don't bake per-dataset defaults into the catalog;
 * instead we discover the dim combinations from the data and let the
 * user pick. The default is the combo with the most rows — usually the
 * "headline" slice (sex=T, age=TOTAL, etc.).
 */
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { fetchDatasets, fetchSeries } from '../api/atlas.js'
import { fetchBoundaries } from '../api/geo.js'

const route = useRoute()
const router = useRouter()

// ── State ────────────────────────────────────────────────────────────
const datasets = ref([])              // catalog rows from /stats/datasets
const datasetsLoading = ref(true)
const datasetsError = ref(null)

const selected = ref('')              // dataset code
const level = ref(2)                  // NUTS level
const year = ref(null)                // selected year
const sliceKey = ref('')              // JSON-stringified dim filter

const observations = ref([])          // raw rows from /stats/series
const seriesLoading = ref(false)
const seriesError = ref(null)

const hovered = ref(null)             // {nuts_code, name, value}

// ── Derived ──────────────────────────────────────────────────────────
const groupedDatasets = computed(() => {
  const by = new Map()
  for (const d of datasets.value) {
    if (!d.enabled) continue
    if (!by.has(d.theme)) by.set(d.theme, [])
    by.get(d.theme).push(d)
  }
  return [...by.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([theme, items]) => ({
      theme,
      items: items.sort((a, b) => a.label.localeCompare(b.label)),
    }))
})

const selectedDataset = computed(
  () => datasets.value.find((d) => d.code === selected.value) || null,
)

const allowedLevels = computed(() => {
  const d = selectedDataset.value
  if (!d || !Array.isArray(d.nuts_levels) || d.nuts_levels.length === 0) {
    return [0, 1, 2, 3]
  }
  return [...d.nuts_levels].sort()
})

// All dim combos seen in the data, ranked by row count.
const sliceOptions = computed(() => {
  const counts = new Map()
  for (const o of observations.value) {
    const k = JSON.stringify(o.dimensions || {})
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      key,
      label: _formatSlice(key),
      count,
    }))
})

const availableYears = computed(() => {
  const ys = new Set()
  for (const o of observations.value) ys.add(o.year)
  return [...ys].sort((a, b) => a - b)
})

// One value per geo for the chosen slice + year.
const choroplethRows = computed(() => {
  if (!sliceKey.value || year.value == null) return []
  const out = []
  for (const o of observations.value) {
    if (o.year !== year.value) continue
    if (JSON.stringify(o.dimensions || {}) !== sliceKey.value) continue
    if (o.value == null) continue
    out.push({ nuts_code: o.geo_code, value: o.value })
  }
  return out
})

// ── URL sync (deep-linkable) ─────────────────────────────────────────
function _writeUrl() {
  const q = { ...route.query }
  if (selected.value) q.dataset = selected.value
  else delete q.dataset
  if (level.value != null) q.level = String(level.value)
  if (year.value != null) q.year = String(year.value)
  else delete q.year
  if (sliceKey.value) q.slice = sliceKey.value
  else delete q.slice
  router.replace({ path: route.path, query: q })
}

function _readUrl() {
  const q = route.query
  if (typeof q.dataset === 'string') selected.value = q.dataset
  if (typeof q.level === 'string') level.value = Number(q.level)
  if (typeof q.year === 'string') year.value = Number(q.year)
  if (typeof q.slice === 'string') sliceKey.value = q.slice
}

// ── Helpers ──────────────────────────────────────────────────────────
function _formatSlice(jsonKey) {
  try {
    const obj = JSON.parse(jsonKey)
    const keys = Object.keys(obj)
    if (keys.length === 0) return 'All data'
    return keys.map((k) => `${k}=${obj[k]}`).join(', ')
  } catch {
    return jsonKey
  }
}

function _formatValue(v, dataset) {
  if (v == null) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  if (dataset?.code?.startsWith('nama_') && dataset?.label?.includes('GDP')) {
    return `€${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

// ── Map setup ────────────────────────────────────────────────────────
const container = ref(null)
let map = null

const COLOR_STOPS = [
  '#eff6ff', '#bfdbfe', '#60a5fa', '#fbbf24', '#f97316', '#dc2626',
]

function _buildColorExpression(rows) {
  const positives = rows.map((r) => r.value).filter((v) => v > 0).sort((a, b) => a - b)
  if (positives.length === 0) return COLOR_STOPS[0]
  const unique = [...new Set(positives)]
  if (unique.length === 1) {
    return [
      'step', ['get', 'value'],
      COLOR_STOPS[0], unique[0], COLOR_STOPS[COLOR_STOPS.length - 1],
    ]
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

async function _renderChoropleth() {
  if (!map) return
  const rows = choroplethRows.value
  let geo
  try {
    geo = await fetchBoundaries(level.value)
  } catch (err) {
    seriesError.value = `Boundaries: ${err.message}`
    return
  }

  const byCode = new Map(rows.map((r) => [r.nuts_code, r.value]))
  for (const f of geo.features) {
    f.properties.value = byCode.get(f.properties.nuts_code) ?? null
  }
  const colorExpr = _buildColorExpression(rows)

  const apply = () => {
    if (map.getSource('atlas')) {
      map.getSource('atlas').setData(geo)
      map.setPaintProperty('atlas-fill', 'fill-color', colorExpr)
    } else {
      map.addSource('atlas', { type: 'geojson', data: geo })
      map.addLayer({
        id: 'atlas-fill', type: 'fill', source: 'atlas',
        paint: { 'fill-color': colorExpr, 'fill-opacity': 0.7 },
      })
      map.addLayer({
        id: 'atlas-line', type: 'line', source: 'atlas',
        paint: { 'line-color': '#334155', 'line-width': 0.5 },
      })
      map.on('mousemove', 'atlas-fill', (e) => {
        if (!e.features?.length) return
        map.getCanvas().style.cursor = 'pointer'
        hovered.value = e.features[0].properties
      })
      map.on('mouseleave', 'atlas-fill', () => {
        map.getCanvas().style.cursor = ''
        hovered.value = null
      })
    }
  }
  if (map.isStyleLoaded()) apply()
  else map.once('load', apply)
}

// ── Data fetching ────────────────────────────────────────────────────
async function _refreshSeries() {
  if (!selected.value || level.value == null) return
  seriesLoading.value = true
  seriesError.value = null
  try {
    const resp = await fetchSeries({
      dataset: selected.value,
      nutsLevel: level.value,
    })
    observations.value = resp.data || []
    if (!sliceKey.value && sliceOptions.value.length > 0) {
      sliceKey.value = sliceOptions.value[0].key
    }
    if (year.value == null && availableYears.value.length > 0) {
      year.value = availableYears.value[availableYears.value.length - 1]
    }
    _renderChoropleth()
  } catch (err) {
    seriesError.value = err.message
    observations.value = []
  } finally {
    seriesLoading.value = false
  }
}

// ── Watchers ─────────────────────────────────────────────────────────
watch([selected, level], () => {
  // Reset slice + year so they're re-derived from the new dataset's data.
  sliceKey.value = ''
  year.value = null
  _refreshSeries()
  _writeUrl()
})

watch([year, sliceKey], () => {
  _renderChoropleth()
  _writeUrl()
})

// Keep level inside the dataset's allowed set when the dataset changes.
watch(selectedDataset, (d) => {
  if (!d) return
  if (!allowedLevels.value.includes(level.value)) {
    level.value = allowedLevels.value[0] ?? 2
  }
})

// ── Lifecycle ────────────────────────────────────────────────────────
//
// Order matters: fetch datasets first → set datasetsLoading=false →
// nextTick → only THEN create the MapLibre instance. The map's
// container `<div ref="container">` lives inside `v-else` (after the
// loading/error/empty branches), so it doesn't exist in the DOM during
// the initial loading state. Mounting the map before that resolves
// throws "Invalid type: 'container' must be a String or HTMLElement"
// synchronously, aborts onMounted, leaves datasetsLoading=true forever,
// and the view sits permanently on the loading spinner. Confirmed in
// prod browser-trace; the unit test missed it because vi.mock for
// maplibre returns a fake instance regardless of args (see the
// container-presence assertion in AtlasView.test.js).
function _createMap() {
  if (!container.value || map) return
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
}

onMounted(async () => {
  document.title = 'Atlas — Map European statistics on Fontem'
  _readUrl()

  try {
    datasets.value = await fetchDatasets()
  } catch (err) {
    datasetsError.value = err.message
  } finally {
    datasetsLoading.value = false
  }

  // Wait for Vue to render the body (which contains the map container)
  // before instantiating MapLibre. nextTick is enough — Vue flushes
  // pending DOM updates synchronously after a microtask.
  await nextTick()
  _createMap()

  if (selected.value) {
    _refreshSeries()
  }
})

// If the body wasn't rendered on initial mount (empty / error state)
// and then becomes available later — e.g. `register-seed` runs and
// the catalog populates between page-load and a manual refresh of the
// fetch — instantiate the map then. Cheap watcher; one-shot.
watch(datasets, async (next) => {
  if (next.length > 0 && !map) {
    await nextTick()
    _createMap()
    if (selected.value) _refreshSeries()
  }
})

onBeforeUnmount(() => {
  if (map) { map.remove(); map = null }
})
</script>

<template>
  <div class="atlas" data-testid="atlas">
    <header class="atlas-header">
      <h1>Atlas</h1>
      <p class="atlas-sub">
        Map view of the curated Eurostat datasets.
        Pick a metric, a NUTS level, and a year.
      </p>
    </header>

    <div v-if="datasetsLoading" class="atlas-status" data-testid="atlas-loading">
      Loading datasets…
    </div>
    <div v-else-if="datasetsError" class="atlas-error" data-testid="atlas-error">
      {{ datasetsError }}
    </div>
    <div
      v-else-if="datasets.length === 0"
      class="atlas-empty"
      data-testid="atlas-empty"
    >
      No datasets registered yet — the stats store is online but the seed
      hasn't been loaded. Run <code>python -m src.stats_etl register-seed</code>
      to populate the catalog.
    </div>

    <div v-else class="atlas-body">
      <aside class="atlas-controls">
        <label class="atlas-control">
          <span class="atlas-label">Dataset</span>
          <select v-model="selected" data-testid="atlas-dataset">
            <option value="">— pick a dataset —</option>
            <optgroup
              v-for="grp in groupedDatasets"
              :key="grp.theme"
              :label="grp.theme"
            >
              <option
                v-for="d in grp.items"
                :key="d.code"
                :value="d.code"
              >
                {{ d.label }}
              </option>
            </optgroup>
          </select>
        </label>

        <label v-if="selectedDataset" class="atlas-control">
          <span class="atlas-label">NUTS level</span>
          <select v-model.number="level" data-testid="atlas-level">
            <option v-for="l in allowedLevels" :key="l" :value="l">
              NUTS {{ l }}
            </option>
          </select>
        </label>

        <label
          v-if="selectedDataset && availableYears.length > 0"
          class="atlas-control"
        >
          <span class="atlas-label">
            Year — <strong>{{ year }}</strong>
          </span>
          <input
            v-model.number="year"
            type="range"
            data-testid="atlas-year"
            :min="availableYears[0]"
            :max="availableYears[availableYears.length - 1]"
            :step="1"
          />
          <div class="atlas-year-bounds">
            <span>{{ availableYears[0] }}</span>
            <span>{{ availableYears[availableYears.length - 1] }}</span>
          </div>
        </label>

        <label
          v-if="selectedDataset && sliceOptions.length > 1"
          class="atlas-control"
        >
          <span class="atlas-label">Data slice</span>
          <select v-model="sliceKey" data-testid="atlas-slice">
            <option
              v-for="s in sliceOptions"
              :key="s.key"
              :value="s.key"
            >
              {{ s.label }}
            </option>
          </select>
          <p class="atlas-hint">
            The dataset has {{ sliceOptions.length }} dimension combinations.
            Largest slice is shown by default.
          </p>
        </label>

        <div v-if="selectedDataset" class="atlas-meta">
          <p class="atlas-meta-label">Dataset metadata</p>
          <ul>
            <li><strong>Code</strong> {{ selectedDataset.code }}</li>
            <li><strong>Theme</strong> {{ selectedDataset.theme }}</li>
            <li><strong>Time unit</strong> {{ selectedDataset.time_unit }}</li>
            <li>
              <strong>Updated</strong>
              {{ selectedDataset.last_upstream_modified || '—' }}
            </li>
            <li v-if="selectedDataset.notes">
              <strong>Notes</strong> {{ selectedDataset.notes }}
            </li>
          </ul>
        </div>
      </aside>

      <section class="atlas-map-wrap">
        <div v-if="seriesLoading" class="atlas-status" data-testid="atlas-series-loading">
          Fetching observations…
        </div>
        <div v-if="seriesError" class="atlas-error" data-testid="atlas-series-error">
          {{ seriesError }}
        </div>

        <div ref="container" class="atlas-map" data-testid="atlas-map" />

        <div v-if="hovered && hovered.value != null" class="atlas-hover" data-testid="atlas-hover">
          <strong>{{ hovered.name }}</strong>
          <span class="atlas-hover-code">{{ hovered.nuts_code }}</span>
          <span class="atlas-hover-value">
            {{ _formatValue(hovered.value, selectedDataset) }}
          </span>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.atlas {
  max-width: 84rem;
  margin: 0 auto;
  padding: 1rem 1.5rem 2rem;
}

.atlas-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
  letter-spacing: -0.01em;
}

.atlas-sub {
  font-size: 0.85rem;
  color: var(--muted);
  margin: 0 0 1rem;
}

.atlas-body {
  display: grid;
  grid-template-columns: minmax(260px, 320px) 1fr;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 720px) {
  .atlas-body {
    grid-template-columns: 1fr;
  }
}

.atlas-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
}

.atlas-control {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
}

.atlas-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--muted);
  letter-spacing: 0.05em;
}

.atlas-control select,
.atlas-control input[type='range'] {
  width: 100%;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  border-radius: 4px;
  font-size: 0.85rem;
}

.atlas-control input[type='range'] {
  padding: 0;
  background: transparent;
  border: none;
}

.atlas-year-bounds {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: var(--muted);
}

.atlas-hint {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: var(--muted);
}

.atlas-meta {
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
  font-size: 0.78rem;
  color: var(--text);
}

.atlas-meta-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--muted);
  letter-spacing: 0.05em;
  margin: 0 0 0.4rem;
}

.atlas-meta ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.atlas-meta li strong {
  display: inline-block;
  min-width: 5.5rem;
  color: var(--muted);
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.65rem;
  letter-spacing: 0.05em;
}

.atlas-map-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.atlas-map {
  height: 600px;
  border: 1px solid var(--border);
  border-radius: 6px;
}

.atlas-status,
.atlas-empty {
  padding: 1rem;
  font-size: 0.85rem;
  color: var(--muted);
  border: 1px dashed var(--border);
  border-radius: 6px;
}

.atlas-empty code {
  background: var(--surface);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-size: 0.78rem;
}

.atlas-error {
  padding: 0.75rem;
  font-size: 0.85rem;
  color: #ef4444;
  border: 1px solid #ef4444;
  border-radius: 6px;
}

.atlas-hover {
  position: absolute;
  bottom: 14px;
  left: 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.4rem 0.65rem;
  font-size: 0.78rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  pointer-events: none;
  z-index: 10;
}

.atlas-hover-code {
  font-size: 0.65rem;
  color: var(--muted);
  text-transform: uppercase;
}

.atlas-hover-value {
  font-size: 0.78rem;
  font-weight: 600;
}
</style>
