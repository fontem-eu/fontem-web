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
import {
  fetchAvailability,
  fetchDatasets,
  fetchSeries,
  fetchSliceStats,
} from '../api/atlas.js'
import { fetchBoundaries } from '../api/geo.js'
import PocketButton from '../components/PocketButton.vue'
import AtlasLegend from '../widgets/atlas/AtlasLegend.vue'
import MapLoadingOverlay from '../widgets/atlas/MapLoadingOverlay.vue'
import {
  buildColorExpression,
  deriveBounds,
  findSliceStats,
  NULL_COLOR,
} from '../widgets/atlas/colorScale.js'
import { useAtlasPalette } from '../composables/useAtlasPalette.js'

const { palette: atlasPalette } = useAtlasPalette()

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

// Slice-stats cache per dataset code. Fetched lazily on dataset
// selection — see _refreshSliceStats. Map<code, SliceStats[]>.
const sliceStatsByDataset = ref(new Map())

// Year-availability cache per dataset code. Fetched lazily on
// dataset selection — see _refreshAvailability. Map<code,
// YearAvailability[]>.
const availabilityByDataset = ref(new Map())

// Hide-low-coverage toggles. Default ON — opt-out as requested.
// 0.20 threshold matches the user spec ("less than 20% data
// availability"). Year filter applies to the active (level, slice);
// dataset filter applies dataset-wide via `max_availability_pct`
// from the catalog.
const hideLowCoverageYears = ref(true)
const hideLowCoverageDatasets = ref(true)
const MIN_AVAILABILITY = 0.20

const hovered = ref(null)             // {nuts_code, name, value}

// ── Colour-scale UX ─────────────────────────────────────────────────
//
// Default: lock the scale to dataset-wide robust bounds (p02..p98 from
// the backend's slice_stats). This is what makes years comparable —
// the same colour means the same value across 2008 and 2024.
//
// "Lock scale" off → fall back to per-year auto-scale (the previous
// behaviour). Useful for analysts who want to zoom into a single
// year's distribution without outliers from other years compressing
// the ramp.
//
// "Log scale" → log-space the breakpoints. Helpful for highly skewed
// datasets (population, GDP) where p98/p02 spans 3+ orders of
// magnitude. The legend renders a `log` pill so users know.
const lockScale = ref(true)
const logScale = ref(false)

// ── Year scrubber ───────────────────────────────────────────────────
//
// "Play" advances the year on a timer; "Loop" wraps around when we
// hit the end. State + timer scoped to this view (cleared on
// dataset change so we don't run a stale animation).
const playing = ref(false)
const looping = ref(true)
let _playTimer = null
const PLAY_INTERVAL_MS = 750     // one frame per ~0.75s — feels like
                                 // a slow pan, not a Powerpoint click

function _stepYearForward() {
  if (availableYears.value.length === 0) {
    playing.value = false
    return
  }
  const idx = availableYears.value.indexOf(year.value)
  const next = idx + 1
  if (next < availableYears.value.length) {
    year.value = availableYears.value[next]
  } else if (looping.value) {
    year.value = availableYears.value[0]
  } else {
    playing.value = false
  }
}

function _startPlay() {
  if (_playTimer) clearInterval(_playTimer)
  _playTimer = setInterval(_stepYearForward, PLAY_INTERVAL_MS)
}
function _stopPlay() {
  if (_playTimer) { clearInterval(_playTimer); _playTimer = null }
}
function togglePlay() {
  playing.value = !playing.value
}

// ── Derived ──────────────────────────────────────────────────────────
//
// `_isLowCoverageDataset(d)` keys off the catalog's
// `max_availability_pct` — backend-computed best (level, slice, year)
// coverage. NULL means the availability sidecar isn't populated yet,
// so we treat the dataset as "show everything" (the toggle no-ops
// rather than hiding everything mid-rollout).
function _isLowCoverageDataset(d) {
  const m = d?.max_availability_pct
  return m != null && m < MIN_AVAILABILITY
}

const groupedDatasets = computed(() => {
  const by = new Map()
  for (const d of datasets.value) {
    if (!d.enabled) continue
    // Never hide the currently-selected dataset, even if the toggle
    // would normally exclude it — the user explicitly picked it (or
    // deep-linked to it), so removing it from the picker mid-render
    // would feel like a bug.
    if (hideLowCoverageDatasets.value
        && _isLowCoverageDataset(d)
        && d.code !== selected.value) {
      continue
    }
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

// Number of datasets the toggle is currently hiding — surfaced in
// the toggle's hint text so the user knows whether flipping it
// would reveal anything (and how much).
const hiddenLowCoverageDatasetCount = computed(() => {
  if (!datasets.value.length) return 0
  return datasets.value.filter(
    (d) => d.enabled && _isLowCoverageDataset(d),
  ).length
})

const selectedDataset = computed(
  () => datasets.value.find((d) => d.code === selected.value) || null,
)

// Snapshot of the current view, ready to drop into a report or save
// to the pocket. Mirrors the AtlasMapEmbed widget config shape.
const pocketConfig = computed(() => {
  let dimensions
  if (sliceKey.value) {
    try { dimensions = JSON.parse(sliceKey.value) } catch { dimensions = undefined }
  }
  return {
    dataset: selected.value,
    nuts_level: level.value,
    year: year.value ?? undefined,
    ...(dimensions && Object.keys(dimensions).length > 0 ? { dimensions } : {}),
  }
})
const pocketName = computed(() => {
  const d = selectedDataset.value
  if (!d) return 'Atlas Map'
  const yr = year.value != null ? ` (${year.value})` : ''
  return `Atlas — ${d.label}${yr}`
})

const allowedLevels = computed(() => {
  const d = selectedDataset.value
  if (!d || !Array.isArray(d.nuts_levels) || d.nuts_levels.length === 0) {
    return [0, 1, 2, 3]
  }
  return [...d.nuts_levels].sort()
})

// All dim combos seen in the data, ranked by row count. Each option's
// label resolves codes against the dataset's `dim_labels` so the picker
// shows "Intentional homicide × Number" instead of "iccs=ICCS0101,
// unit=NR".
const sliceOptions = computed(() => {
  const counts = new Map()
  for (const o of observations.value) {
    const k = JSON.stringify(o.dimensions || {})
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  const labels = selectedDataset.value?.dim_labels || {}
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      key,
      label: _formatSlice(key, labels),
      count,
    }))
})

// Years whose (level, slice) coverage is below the threshold —
// derived from the availability sidecar for the active dataset
// + level + slice. Empty when the sidecar isn't populated yet
// or the toggle is off.
const lowCoverageYears = computed(() => {
  if (!hideLowCoverageYears.value || !selected.value) return new Set()
  const rows = availabilityByDataset.value.get(selected.value)
  if (!rows || rows.length === 0) return new Set()
  const lvl = level.value
  const slice = sliceKey.value
  const out = new Set()
  for (const r of rows) {
    if (r.nuts_level !== lvl) continue
    if (slice && JSON.stringify(r.dimensions || {}) !== slice) continue
    if (r.availability_pct == null) continue
    if (r.availability_pct < MIN_AVAILABILITY) out.add(r.year)
  }
  return out
})

const availableYears = computed(() => {
  const ys = new Set()
  for (const o of observations.value) ys.add(o.year)
  const hide = lowCoverageYears.value
  return [...ys]
    .filter((y) => !hide.has(y))
    .sort((a, b) => a - b)
})

// Surface "n hidden" hint next to the year toggle so the user
// knows the slider is shorter than it could be.
const hiddenLowCoverageYearCount = computed(() => lowCoverageYears.value.size)

// Slice stats for the active dimension selection — feeds the legend
// + the locked colour scale. `null` when the backend hasn't computed
// stats yet (fresh dataset, or pre-migration cluster). Caller falls
// back to per-year bounds in that case.
//
// Reads from the lazy per-dataset cache populated by
// _refreshSliceStats — keeps /atlas/datasets small (slice stats for
// migration cubes can run to ~45k entries; we fetch one dataset
// at a time on demand).
const activeSliceStats = computed(() => findSliceStats(
  sliceStatsByDataset.value.get(selected.value) || [],
  sliceKey.value,
))

// Bounds + kind in one place — both legend and map read from this so
// they can never disagree. Falls through three sources in order:
//   1. Locked dataset-wide bounds (preferred — comparable across years)
//   2. Per-year auto-scale on positives only (legacy fallback)
//   3. null → caller paints palette[0] uniformly (degenerate distribution)
const colorScaleProps = computed(() => {
  const stats = activeSliceStats.value
  if (lockScale.value && stats) {
    const bounds = deriveBounds(stats)
    return {
      bounds,
      kind: stats.value_kind || 'sequential',
      log: logScale.value,
      palette: atlasPalette.value,
      // Skew hint surfaced in the lock toggle's hover label.
      skewHint: (stats.skew_ratio || 0) > 5,
    }
  }
  // Fallback: derive from this year's positives. Same shape, just
  // computed live instead of from precomputed stats.
  const positives = []
  for (const o of observations.value) {
    if (o.year !== year.value) continue
    if (JSON.stringify(o.dimensions || {}) !== sliceKey.value) continue
    if (o.value == null || o.value <= 0) continue
    positives.push(o.value)
  }
  positives.sort((a, b) => a - b)
  if (positives.length === 0) return { bounds: null, kind: 'sequential', log: false, palette: atlasPalette.value, skewHint: false }
  return {
    bounds: [positives[0], positives[positives.length - 1]],
    kind: 'sequential',
    log: logScale.value,
    palette: atlasPalette.value,
    skewHint: false,
  }
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
function _formatSlice(jsonKey, dimLabels = {}) {
  try {
    const obj = JSON.parse(jsonKey)
    const keys = Object.keys(obj)
    if (keys.length === 0) return 'All data'
    return keys
      .map((k) => {
        const code = obj[k]
        // Eurostat ships category labels as code → label maps per dim.
        // Fall back to the raw code when a label isn't available
        // (catalog hasn't been re-synced since the migration, or the
        // dim is something Eurostat doesn't label).
        const label = dimLabels?.[k]?.[code] || code
        return label
      })
      .join(' × ')
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
const captureTarget = () => container.value
let map = null

// Painting is split into two MapLibre layers:
//   atlas-fill-data   — features with a non-null value, painted via
//                       the step expression from buildColorExpression
//   atlas-fill-null   — features with value=null, painted with
//                       NULL_COLOR. Two layers so "no data" never
//                       reads as "low value" (the original bug —
//                       the dark basemap showed through transparent
//                       missing-data fills, looking like the worst
//                       possible value).

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
    const v = byCode.get(f.properties.nuts_code)
    if (v == null) {
      // Leave `value` absent so MapLibre's ['has', 'value'] filter
      // correctly routes the feature to the no-data layer. Setting
      // it to null would still match ['has'], blurring the layers.
      delete f.properties.value
    } else {
      f.properties.value = v
    }
  }
  const colorExpr = buildColorExpression(colorScaleProps.value)

  const apply = () => {
    if (map.getSource('atlas')) {
      map.getSource('atlas').setData(geo)
      map.setPaintProperty('atlas-fill-data', 'fill-color', colorExpr)
      // No-data layer is a constant fill; nothing to update unless
      // the palette itself changes (which it doesn't at runtime).
    } else {
      map.addSource('atlas', { type: 'geojson', data: geo })
      // Order matters: paint null first, then real data on top so
      // overlapping borders don't get tinted by the wrong layer.
      map.addLayer({
        id: 'atlas-fill-null',
        type: 'fill',
        source: 'atlas',
        // ['==', ['get', 'value'], null] doesn't work in MapLibre's
        // expression dialect — use ['typeof'] + check against
        // 'string'/'number' or just the negated has-value check.
        filter: ['!', ['has', 'value']],
        paint: { 'fill-color': NULL_COLOR, 'fill-opacity': 0.55 },
      })
      map.addLayer({
        id: 'atlas-fill-data',
        type: 'fill',
        source: 'atlas',
        filter: ['has', 'value'],
        paint: { 'fill-color': colorExpr, 'fill-opacity': 0.78 },
      })
      map.addLayer({
        id: 'atlas-line', type: 'line', source: 'atlas',
        paint: { 'line-color': '#334155', 'line-width': 0.5 },
      })
      // Hover both layers so users can read the "—" tooltip on
      // missing-data regions too. Same handler.
      const onMove = (e) => {
        if (!e.features?.length) return
        map.getCanvas().style.cursor = 'pointer'
        hovered.value = e.features[0].properties
      }
      const onLeave = () => {
        map.getCanvas().style.cursor = ''
        hovered.value = null
      }
      map.on('mousemove', 'atlas-fill-data', onMove)
      map.on('mousemove', 'atlas-fill-null', onMove)
      map.on('mouseleave', 'atlas-fill-data', onLeave)
      map.on('mouseleave', 'atlas-fill-null', onLeave)
    }
  }
  if (map.isStyleLoaded()) apply()
  else map.once('load', apply)
}

// ── Data fetching ────────────────────────────────────────────────────
async function _refreshSliceStats(code) {
  if (!code) return
  // Cache hit — slice stats are immutable per (sync, dataset),
  // refetching wastes a round-trip and the legend would flicker.
  if (sliceStatsByDataset.value.has(code)) return
  try {
    const slices = await fetchSliceStats(code)
    // Mutate via a fresh Map ref so Vue reactivity picks it up;
    // direct .set() on a non-shallow ref is ignored.
    const next = new Map(sliceStatsByDataset.value)
    next.set(code, Array.isArray(slices) ? slices : [])
    sliceStatsByDataset.value = next
  } catch {
    // Don't fail the whole view — colorScale falls back to per-data
    // bounds when slice stats are missing. Just log to the console.
    console.warn(`[atlas] slice stats unavailable for ${code}; falling back to per-year scale`)
  }
}

async function _refreshAvailability(code) {
  if (!code) return
  // Same caching pattern as slice stats — availability is
  // recomputed only at sync time so within a session the result
  // is stable. Re-fetching would cause the year-filter set to
  // briefly flip empty and the slider to jump.
  if (availabilityByDataset.value.has(code)) return
  try {
    const rows = await fetchAvailability(code)
    const next = new Map(availabilityByDataset.value)
    next.set(code, Array.isArray(rows) ? rows : [])
    availabilityByDataset.value = next
  } catch {
    // Sidecar may be missing on a pre-backfill cluster — toggles
    // silently no-op. Same fall-through pattern as slice stats.
    console.warn(`[atlas] availability unavailable for ${code}; "hide low-coverage years" will no-op`)
  }
}

async function _refreshSeries() {
  if (!selected.value || level.value == null) return
  seriesLoading.value = true
  seriesError.value = null
  try {
    // Series + slice stats + availability fetched in parallel.
    // Series feeds observations, slice stats feeds the locked
    // colour scale, availability feeds the low-coverage filter.
    const [resp] = await Promise.all([
      fetchSeries({
        dataset: selected.value,
        nutsLevel: level.value,
      }),
      _refreshSliceStats(selected.value),
      _refreshAvailability(selected.value),
    ])
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

// Re-paint when the colour-scale toggles flip — same data, new
// palette/bounds. URL doesn't carry these (deliberately: they're
// view preferences, not deep-link state).
watch([lockScale, logScale, atlasPalette], () => {
  _renderChoropleth()
})

// Play/loop animation lifecycle.
watch(playing, (now) => {
  if (now) _startPlay()
  else _stopPlay()
})
// Stop the animation when the dataset changes (otherwise we'd be
// scrubbing through years that no longer exist on the new dataset).
watch([selected, level], () => {
  playing.value = false
})

// Snap `year` back into the filtered set when the toggle (or the
// active level/slice — which changes the per-year availability)
// flips and the current year falls outside availableYears.
watch(
  [hideLowCoverageYears, lowCoverageYears],
  () => {
    if (year.value == null) return
    if (availableYears.value.length === 0) return
    if (!availableYears.value.includes(year.value)) {
      year.value = availableYears.value[availableYears.value.length - 1]
    }
  },
)

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
    preserveDrawingBuffer: true,
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
  _stopPlay()
  if (map) { map.remove(); map = null }
})
</script>

<template>
  <div class="atlas" data-testid="atlas">
    <header class="atlas-header">
      <h1>{{ $t('atlas.atlas') }}</h1>
      <p class="atlas-sub">
        Map view of the curated Eurostat datasets.
        Pick a metric, a NUTS level, and a year.
      </p>
    </header>

    <div v-if="datasetsLoading" class="atlas-status" data-testid="atlas-loading">{{ $t('atlas.loading_datasets') }}</div>
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
          <span class="atlas-label">{{ $t('atlas.dataset') }}</span>
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
          <span class="atlas-label">{{ $t('app.nuts_level') }}</span>
          <select v-model.number="level" data-testid="atlas-level">
            <option v-for="l in allowedLevels" :key="l" :value="l">
              NUTS {{ l }}
            </option>
          </select>
        </label>

        <label
          v-if="selectedDataset && sliceOptions.length > 1"
          class="atlas-control"
        >
          <span class="atlas-label">{{ $t('atlas.data_slice') }}</span>
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

        <fieldset
          v-if="selectedDataset && colorScaleProps.bounds"
          class="atlas-control atlas-scale-controls"
          data-testid="atlas-scale-controls"
        >
          <legend class="atlas-label">{{ $t('atlas.colour_scale') }}</legend>
          <label class="atlas-toggle">
            <input
              v-model="lockScale"
              type="checkbox"
              data-testid="atlas-lock-scale"
            />
            <span>{{ $t('atlas.lock_to_dataset_range') }}<span
                v-if="!activeSliceStats"
                class="atlas-hint-inline"
                title="Backend hasn't computed slice stats for this dataset yet — falls back to per-year auto-scale."
              >(unavailable)</span>
            </span>
          </label>
          <label class="atlas-toggle">
            <input
              v-model="logScale"
              type="checkbox"
              data-testid="atlas-log-scale"
              :disabled="colorScaleProps.kind === 'diverging' || (colorScaleProps.bounds && colorScaleProps.bounds[0] <= 0)"
            />
            <span>{{ $t('atlas.log_scale') }}<span
                v-if="colorScaleProps.skewHint"
                class="atlas-hint-inline"
                :title="$t('atlas.distribution_is_right_skewed_log_scale_r')"
              >(suggested)</span>
            </span>
          </label>
        </fieldset>

        <fieldset
          class="atlas-control atlas-coverage-controls"
          data-testid="atlas-coverage-controls"
        >
          <legend class="atlas-label">{{ $t('atlas.coverage') }}</legend>
          <label class="atlas-toggle">
            <input
              v-model="hideLowCoverageDatasets"
              type="checkbox"
              data-testid="atlas-hide-low-datasets"
            />
            <span>{{ $t('atlas.hide_low_coverage_datasets') }}<span
                v-if="hiddenLowCoverageDatasetCount > 0"
                class="atlas-hint-inline"
                :title="`Datasets whose best (level, slice, year) covers fewer than ${Math.round(MIN_AVAILABILITY * 100)}% of regions are hidden from the picker.`"
              >({{ hiddenLowCoverageDatasetCount }} hidden)</span>
            </span>
          </label>
          <label class="atlas-toggle">
            <input
              v-model="hideLowCoverageYears"
              type="checkbox"
              data-testid="atlas-hide-low-years"
              :disabled="!selectedDataset"
            />
            <span>{{ $t('atlas.hide_low_coverage_years') }}<span
                v-if="hiddenLowCoverageYearCount > 0"
                class="atlas-hint-inline"
                :title="`Years where fewer than ${Math.round(MIN_AVAILABILITY * 100)}% of regions have data for this slice are hidden from the slider.`"
              >({{ hiddenLowCoverageYearCount }} hidden)</span>
            </span>
          </label>
        </fieldset>

        <div v-if="selectedDataset" class="atlas-meta">
          <p class="atlas-meta-label">{{ $t('atlas.dataset_metadata') }}</p>
          <ul>
            <li><strong>{{ $t('atlas.code') }}</strong> {{ selectedDataset.code }}</li>
            <li><strong>{{ $t('app.theme') }}</strong> {{ selectedDataset.theme }}</li>
            <li><strong>{{ $t('atlas.time_unit') }}</strong> {{ selectedDataset.time_unit }}</li>
            <li>
              <strong>{{ $t('atlas.updated') }}</strong>
              {{ selectedDataset.last_upstream_modified || '—' }}
            </li>
            <li v-if="selectedDataset.notes">
              <strong>{{ $t('atlas.notes') }}</strong> {{ selectedDataset.notes }}
            </li>
          </ul>
          <PocketButton
            widget-type="atlas_map"
            :config="pocketConfig"
            :default-name="pocketName"
            :capture-target="captureTarget"
          />
        </div>
      </aside>

      <section class="atlas-map-wrap">
        <!-- Error banner above the map. Loading goes ON the map
             (overlay below) so the user gets immediate feedback
             that data is being fetched, but errors keep their
             existing prominent position so they're impossible to
             miss. -->
        <div v-if="seriesError" class="atlas-error" data-testid="atlas-series-error">
          {{ seriesError }}
        </div>

        <div class="atlas-map-stack">
          <div ref="container" class="atlas-map" data-testid="atlas-map" />

          <!-- Loading overlay — sits over the map with a translucent
               backdrop, blocks pointer events while fetching, and
               replaces the previous easy-to-miss "Fetching observations"
               text-above-the-map. -->
          <MapLoadingOverlay
            :loading="seriesLoading"
            message="Fetching observations…"
          />

          <!-- Year overlay — lives on the map itself so the user
               can read the active year without taking their eyes
               off the choropleth (especially during play). Big,
               high-contrast, top-left. -->
          <div
            v-if="year != null"
            class="atlas-year-overlay"
            data-testid="atlas-year-overlay"
            aria-live="polite"
          >
            {{ year }}
          </div>

          <AtlasLegend
            v-if="colorScaleProps.bounds"
            class="atlas-legend-overlay"
            :bounds="colorScaleProps.bounds"
            :kind="colorScaleProps.kind"
            :log="colorScaleProps.log"
            :palette="colorScaleProps.palette"
            :title="$t('atlas.value_scale')"
          />

          <div v-if="hovered && hovered.value != null" class="atlas-hover" data-testid="atlas-hover">
            <strong>{{ hovered.name }}</strong>
            <span class="atlas-hover-code">{{ hovered.nuts_code }}</span>
            <span class="atlas-hover-value">
              {{ _formatValue(hovered.value, selectedDataset) }}
            </span>
          </div>
          <div v-else-if="hovered" class="atlas-hover" data-testid="atlas-hover-null">
            <strong>{{ hovered.name }}</strong>
            <span class="atlas-hover-code">{{ hovered.nuts_code }}</span>
            <span class="atlas-hover-value muted">no data</span>
          </div>
        </div>

        <!-- Year scrubber — pulled out of the sidebar and parked
             below the map where it belongs. Drag the slider to
             scrub manually; ▶ animates through the years; loop
             toggles wrap-around. -->
        <div
          v-if="selectedDataset && availableYears.length > 0"
          class="atlas-scrubber"
          data-testid="atlas-scrubber"
        >
          <button
            type="button"
            class="atlas-play-btn"
            :class="{ playing }"
            :aria-label="playing ? 'Pause year animation' : 'Play year animation'"
            data-testid="atlas-play"
            @click="togglePlay"
          >
            <svg v-if="!playing" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <polygon points="6,4 20,12 6,20" fill="currentColor" />
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" fill="currentColor" />
              <rect x="14" y="4" width="4" height="16" fill="currentColor" />
            </svg>
          </button>

          <span class="atlas-year-low">{{ availableYears[0] }}</span>

          <input
            v-model.number="year"
            type="range"
            class="atlas-year-range"
            data-testid="atlas-year"
            :min="availableYears[0]"
            :max="availableYears[availableYears.length - 1]"
            :step="1"
            :aria-label="`Year ${year}`"
          />

          <span class="atlas-year-high">{{ availableYears[availableYears.length - 1] }}</span>

          <label class="atlas-loop-toggle" :title="looping ? 'Looping enabled' : 'Looping disabled — stops at the last year'">
            <input
              v-model="looping"
              type="checkbox"
              data-testid="atlas-loop"
            />
            <span>loop</span>
          </label>
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
.atlas-hover-value.muted {
  color: var(--muted);
  font-weight: 500;
  font-style: italic;
}

/* Colour-scale toggles (sidebar) — sit between the slice picker and
   the dataset metadata block. Visually a fieldset for the screen-
   reader contract; styled flat to match the surrounding controls. */
.atlas-scale-controls,
.atlas-coverage-controls {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.5rem 0.7rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0;
}
.atlas-scale-controls .atlas-label,
.atlas-coverage-controls .atlas-label {
  margin-bottom: 0.2rem;
}
.atlas-toggle {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.78rem;
  color: var(--text);
  cursor: pointer;
}
.atlas-toggle input[type='checkbox']:disabled + span {
  color: var(--muted);
  cursor: not-allowed;
}
.atlas-hint-inline {
  font-size: 0.7rem;
  color: var(--muted);
  margin-left: 0.25rem;
}

/* Legend overlay — bottom-right, above the hover tooltip. */
.atlas-legend-overlay {
  position: absolute;
  bottom: 14px;
  right: 14px;
  z-index: 11;
  background: var(--bg);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

/* Map + overlays wrapper — needed because the year overlay,
   legend, and hover are all `position:absolute` against this. */
.atlas-map-stack {
  position: relative;
}

/* Big year readout pinned to the top-left of the map. Stays legible
   over both light- and dark-themed basemap tiles via a translucent
   surface fill (NOT pure transparency — the contrast against
   light cream and dark forest is too uneven without a backdrop). */
.atlas-year-overlay {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 11;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 0.25rem 0.6rem;
  font-size: 1.4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Scrubber sits directly below the map. Single line on desktop,
   wraps to two on narrow screens. The play button + loop toggle
   bookend the slider so they're always findable. */
.atlas-scrubber {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
}
.atlas-play-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  flex-shrink: 0;
}
.atlas-play-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.atlas-play-btn.playing {
  border-color: var(--accent);
  color: var(--accent);
}
.atlas-year-low,
.atlas-year-high {
  font-size: 0.75rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.atlas-year-range {
  flex: 1;
  min-width: 6rem;
}
.atlas-loop-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--muted);
  cursor: pointer;
  flex-shrink: 0;
}
.atlas-loop-toggle input { cursor: pointer; }
@media (max-width: 720px) {
  .atlas-scrubber { flex-wrap: wrap; row-gap: 0.4rem; }
  .atlas-year-range { flex-basis: 100%; order: 4; }
  .atlas-year-low { order: 2; }
  .atlas-year-high { order: 3; }
  .atlas-loop-toggle { order: 5; }
}
@media (max-width: 720px) {
  .atlas-legend-overlay {
    /* Mobile: pin to the bottom and let it span the map width so the
       gradient bar stays readable. The map already has its own
       1-column layout below this breakpoint. */
    left: 14px;
    right: 14px;
    bottom: 8px;
    max-width: none;
  }
}
</style>
