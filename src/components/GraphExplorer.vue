<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import cytoscape from 'cytoscape'

const props = defineProps({
  entityId: { type: String, required: true },
})

const emit = defineEmits(['navigate'])

// ── State ────────────────────────────────────────────────────
const depth = ref(1)
const typeFilters = ref({
  Company: true, Contract: true, Authority: true, Person: true,
})
const keyword = ref('')
const loading = ref(false)
const graphData = ref(null)
const error = ref(null)
const tooltip = ref(null)
const cyContainer = ref(null)

// ── Path finding state ───────────────────────────────────────
const pathMode = ref(false)
const pathQuery = ref('')
const pathSearchResults = ref([])
const pathSearching = ref(false)
const pathTarget = ref(null) // { id, label, type }
const pathData = ref(null)   // API response
const pathLoading = ref(false)
const selectedPathIndex = ref(null) // null = all, number = specific path

// ── Saved views state ────────────────────────────────────────
const SAVED_VIEWS_KEY = 'gmr-graph-saved-views'
const savedViews = ref(loadSavedViews())
const showSavedViews = ref(false)

// ── Temporal state ───────────────────────────────────────────
const timelineEnabled = ref(false)
const timelineDate = ref(null)    // YYYY-MM string
const timelineMin = ref(null)
const timelineMax = ref(null)
const timelineStats = ref({ contracts: 0, directors: 0, subsidiaries: 0 })
const timelinePlaying = ref(false)

let cy = null
let searchDebounce = null
let playInterval = null

// ── Node styles ──────────────────────────────────────────────
const NODE_STYLES = {
  Company:   { shape: 'ellipse',   color: '#3b82f6' },
  Contract:  { shape: 'diamond',   color: '#f59e0b' },
  Authority: { shape: 'hexagon',   color: '#10b981' },
  Person:    { shape: 'triangle',  color: '#8b5cf6' },
  Unknown:   { shape: 'ellipse',   color: '#6b7280' },
}

// ── Graph API ────────────────────────────────────────────────
async function fetchGraph() {
  loading.value = true
  error.value = null
  tooltip.value = null
  try {
    const types = Object.entries(typeFilters.value)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(',')
    const url = `/api/graph/${encodeURIComponent(props.entityId)}`
      + `?depth=${depth.value}`
      + (types ? `&types=${types}` : '')
    const res = await fetch(url)
    if (!res.ok) throw new Error(`API ${res.status}`)
    graphData.value = await res.json()
  } catch (e) {
    error.value = e.message || 'Failed to load graph'
    graphData.value = null
  } finally {
    loading.value = false
  }
}

// ── Path search (entity search for target) ───────────────────
async function searchEntities(q) {
  if (!q || q.length < 2) {
    pathSearchResults.value = []
    return
  }
  pathSearching.value = true
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`)
    if (!res.ok) throw new Error('Search failed')
    const data = await res.json()
    const results = []
    for (const c of (data.companies || [])) {
      results.push({ id: c.gmr_id, label: c.name, type: 'Company' })
    }
    for (const a of (data.authorities || [])) {
      results.push({ id: a.authority_id, label: a.name, type: 'Authority' })
    }
    for (const p of (data.persons || [])) {
      const name = [p.first_name, p.name].filter(Boolean).join(' ')
      results.push({ id: p.person_id, label: name, type: 'Person' })
    }
    pathSearchResults.value = results
  } catch {
    pathSearchResults.value = []
  } finally {
    pathSearching.value = false
  }
}

function onPathQueryInput() {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => searchEntities(pathQuery.value), 300)
}

async function selectPathTarget(target) {
  pathTarget.value = target
  pathQuery.value = target.label
  pathSearchResults.value = []
  selectedPathIndex.value = null
  await findPaths()
}

// ── Path finding API ─────────────────────────────────────────
async function findPaths() {
  if (!pathTarget.value) return
  pathLoading.value = true
  pathData.value = null
  try {
    const url = `/api/graph/paths/find`
      + `?from=${encodeURIComponent(props.entityId)}`
      + `&to=${encodeURIComponent(pathTarget.value.id)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Path API ${res.status}`)
    pathData.value = await res.json()
  } catch (e) {
    error.value = e.message || 'Path finding failed'
  } finally {
    pathLoading.value = false
  }
  highlightPaths()
}

function togglePathMode() {
  pathMode.value = !pathMode.value
  if (!pathMode.value) {
    clearPathState()
    renderGraph()
  }
}

function clearPathState() {
  pathTarget.value = null
  pathQuery.value = ''
  pathSearchResults.value = []
  pathData.value = null
  selectedPathIndex.value = null
}

// ── Cytoscape rendering ──────────────────────────────────────
function renderGraph() {
  if (!graphData.value || !cyContainer.value) return

  const elements = []

  for (const node of graphData.value.nodes) {
    const style = NODE_STYLES[node.type] || NODE_STYLES.Unknown
    elements.push({
      group: 'nodes',
      data: {
        id: node.id,
        label: node.label,
        type: node.type,
        properties: node.properties,
        color: style.color,
        shape: style.shape,
        isCenter: node.id === graphData.value.center.id,
      },
    })
  }

  for (const edge of graphData.value.edges) {
    elements.push({
      group: 'edges',
      data: {
        id: `${edge.source}-${edge.target}-${edge.type}`,
        source: edge.source,
        target: edge.target,
        label: edge.type,
        properties: edge.properties,
      },
    })
  }

  if (cy) cy.destroy()

  cy = cytoscape({
    container: cyContainer.value,
    elements,
    style: [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          'shape': 'data(shape)',
          'label': 'data(label)',
          'font-size': '10px',
          'text-wrap': 'ellipsis',
          'text-max-width': '80px',
          'text-valign': 'bottom',
          'text-margin-y': 4,
          'width': 24,
          'height': 24,
          'color': 'var(--text, #333)',
        },
      },
      {
        selector: 'node[?isCenter]',
        style: {
          'width': 36,
          'height': 36,
          'border-width': 3,
          'border-color': '#ef4444',
          'font-weight': 'bold',
          'font-size': '12px',
        },
      },
      {
        selector: 'edge',
        style: {
          'width': 1.5,
          'line-color': '#94a3b8',
          'target-arrow-color': '#94a3b8',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'label': 'data(label)',
          'font-size': '8px',
          'color': '#94a3b8',
          'text-rotation': 'autorotate',
        },
      },
    ],
    layout: {
      name: 'cose',
      animate: false,
      nodeRepulsion: 8000,
      idealEdgeLength: 80,
      gravity: 0.3,
    },
    wheelSensitivity: 0.3,
  })

  cy.on('tap', 'node', (evt) => {
    const node = evt.target
    const pos = node.renderedPosition()
    tooltip.value = {
      x: pos.x,
      y: pos.y,
      id: node.data('id'),
      label: node.data('label'),
      type: node.data('type'),
      properties: node.data('properties') || {},
    }
  })

  cy.on('tap', (evt) => {
    if (evt.target === cy) tooltip.value = null
  })

  applyKeywordFilter()
}

// ── Path highlighting ────────────────────────────────────────
function highlightPaths() {
  if (!cy || !pathData.value || !pathData.value.paths.length) return

  // Collect node IDs and edge keys on active paths
  const pathNodeIds = new Set()
  const pathEdgeKeys = new Set()

  const activePaths = selectedPathIndex.value !== null
    ? [pathData.value.paths[selectedPathIndex.value]]
    : pathData.value.paths

  for (const p of activePaths) {
    for (const nid of p.node_ids) pathNodeIds.add(nid)
    for (const e of p.edges) {
      pathEdgeKeys.add(`${e.source}-${e.target}-${e.type}`)
    }
  }

  // Dim non-path elements
  cy.nodes().forEach((node) => {
    if (pathNodeIds.has(node.data('id'))) {
      node.style('opacity', 1)
    } else {
      node.style('opacity', 0.15)
    }
  })

  cy.edges().forEach((edge) => {
    const key = edge.data('id')
    if (pathEdgeKeys.has(key)) {
      const isOnShortest = isEdgeOnShortestPath(edge.data())
      edge.style({
        'opacity': 1,
        'width': isOnShortest ? 3 : 2,
        'line-color': isOnShortest ? '#3b82f6' : '#93c5fd',
        'target-arrow-color': isOnShortest ? '#3b82f6' : '#93c5fd',
        'line-style': isOnShortest ? 'solid' : 'dashed',
      })
    } else {
      edge.style('opacity', 0.1)
    }
  })
}

function isEdgeOnShortestPath(edgeData) {
  if (!pathData.value || !pathData.value.paths.length) return false
  const shortest = pathData.value.paths[0]
  return shortest.edges.some(
    (e) => `${e.source}-${e.target}-${e.type}` === edgeData.id,
  )
}

function selectPath(index) {
  selectedPathIndex.value = selectedPathIndex.value === index ? null : index
  highlightPaths()
}

// ── Keyword filter ───────────────────────────────────────────
function applyKeywordFilter() {
  if (!cy) return
  const q = keyword.value.toLowerCase().trim()
  cy.nodes().forEach((node) => {
    const label = (node.data('label') || '').toLowerCase()
    if (q && !label.includes(q)) {
      node.style('opacity', 0.15)
    } else {
      node.style('opacity', 1)
    }
  })
}

// ── Temporal ──────────────────────────────────────────────────
function computeTimelineRange() {
  if (!graphData.value) return
  const dates = []
  for (const node of graphData.value.nodes) {
    const d = node.properties.publication_date || node.properties.start_date
    if (d) dates.push(d.slice(0, 7)) // YYYY-MM
  }
  if (dates.length === 0) {
    timelineMin.value = null
    timelineMax.value = null
    return
  }
  dates.sort()
  timelineMin.value = dates[0]
  timelineMax.value = dates[dates.length - 1]
  if (!timelineDate.value || timelineDate.value > timelineMax.value) {
    timelineDate.value = timelineMax.value
  }
}

function applyTimelineFilter() {
  if (!cy || !timelineEnabled.value || !timelineDate.value) return

  let contracts = 0
  let directors = 0
  let subsidiaries = 0

  cy.nodes().forEach((node) => {
    const type = node.data('type')
    const props = node.data('properties') || {}

    if (type === 'Contract') {
      const pubDate = (props.publication_date || '').slice(0, 7)
      if (pubDate && pubDate > timelineDate.value) {
        node.style('display', 'none')
      } else {
        node.style('display', 'element')
        if (pubDate) contracts++
      }
    } else if (type === 'Person') {
      // Person nodes are always shown; DIRECTS filtering would need edge dates
      node.style('display', 'element')
      directors++
    } else {
      node.style('display', 'element')
      if (type === 'Company' && node.data('id') !== graphData.value?.center?.id) {
        subsidiaries++
      }
    }
  })

  // Hide edges whose endpoints are hidden
  cy.edges().forEach((edge) => {
    const src = cy.getElementById(edge.data('source'))
    const tgt = cy.getElementById(edge.data('target'))
    if (src.style('display') === 'none' || tgt.style('display') === 'none') {
      edge.style('display', 'none')
    } else {
      edge.style('display', 'element')
    }
  })

  timelineStats.value = { contracts, directors, subsidiaries }
}

function clearTimelineFilter() {
  if (!cy) return
  cy.nodes().forEach((n) => n.style('display', 'element'))
  cy.edges().forEach((e) => e.style('display', 'element'))
}

function toggleTimeline() {
  timelineEnabled.value = !timelineEnabled.value
  if (timelineEnabled.value) {
    computeTimelineRange()
    applyTimelineFilter()
  } else {
    stopPlay()
    clearTimelineFilter()
  }
}

function onTimelineChange() {
  applyTimelineFilter()
}

function startPlay() {
  if (!timelineMin.value || !timelineMax.value) return
  timelinePlaying.value = true
  timelineDate.value = timelineMin.value
  applyTimelineFilter()
  playInterval = setInterval(() => {
    const next = advanceMonth(timelineDate.value)
    if (next > timelineMax.value) {
      stopPlay()
      return
    }
    timelineDate.value = next
    applyTimelineFilter()
  }, 1000)
}

function stopPlay() {
  timelinePlaying.value = false
  clearInterval(playInterval)
  playInterval = null
}

function advanceMonth(ym) {
  const [y, m] = ym.split('-').map(Number)
  const nm = m === 12 ? 1 : m + 1
  const ny = m === 12 ? y + 1 : y
  return `${ny}-${String(nm).padStart(2, '0')}`
}

function monthToIndex(ym) {
  if (!ym) return 0
  const [y, m] = ym.split('-').map(Number)
  return y * 12 + m
}

function indexToMonth(idx) {
  const y = Math.floor((idx - 1) / 12)
  const m = ((idx - 1) % 12) + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

// ── Export ────────────────────────────────────────────────────
function exportSvg() {
  if (!cy) return
  const svg = cy.svg({ full: true })
  downloadFile(svg, 'graph.svg', 'image/svg+xml')
}

function exportPng() {
  if (!cy) return
  const png = cy.png({ full: true, scale: 2 })
  const link = document.createElement('a')
  link.href = png
  link.download = 'graph.png'
  link.click()
}

function exportJson() {
  if (!cy) return
  const data = {
    graph: graphData.value,
    paths: pathData.value,
    center: props.entityId,
    depth: depth.value,
    typeFilters: { ...typeFilters.value },
  }
  downloadFile(JSON.stringify(data, null, 2), 'graph.json', 'application/json')
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// ── Saved views ──────────────────────────────────────────────
function loadSavedViews() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY) || '[]')
  } catch { return [] }
}

function saveView() {
  const name = prompt('Name this view:')
  if (!name) return
  const view = {
    name,
    centerId: props.entityId,
    depth: depth.value,
    typeFilters: { ...typeFilters.value },
    keyword: keyword.value,
    pathTarget: pathTarget.value,
    savedAt: new Date().toISOString(),
  }
  savedViews.value = [view, ...savedViews.value].slice(0, 20)
  persistSavedViews()
}

function restoreView(view) {
  depth.value = view.depth ?? 1
  typeFilters.value = view.typeFilters ?? { Company: true, Contract: true, Authority: true, Person: true }
  keyword.value = view.keyword ?? ''
  if (view.centerId && view.centerId !== props.entityId) {
    emit('navigate', view.centerId)
  }
  showSavedViews.value = false
}

function deleteView(index) {
  savedViews.value.splice(index, 1)
  persistSavedViews()
}

function persistSavedViews() {
  try {
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(savedViews.value))
  } catch { /* ignore */ }
}

// ── Actions ──────────────────────────────────────────────────
function setAsCenter(nodeId) {
  tooltip.value = null
  emit('navigate', nodeId)
}

function goToProfile(nodeId, nodeType) {
  tooltip.value = null
  if (nodeType === 'Company') {
    window.location.hash = ''
    window.location.pathname = `/c/${nodeId}/profile`
  }
}

// ── Lifecycle ────────────────────────────────────────────────
onMounted(async () => {
  await fetchGraph()
  await nextTick()
  renderGraph()
})

onBeforeUnmount(() => {
  if (cy) cy.destroy()
  clearTimeout(searchDebounce)
  stopPlay()
})

watch(depth, async () => {
  await fetchGraph()
  await nextTick()
  renderGraph()
})

watch(typeFilters, async () => {
  await fetchGraph()
  await nextTick()
  renderGraph()
}, { deep: true })

watch(keyword, () => {
  applyKeywordFilter()
})

watch(() => props.entityId, async () => {
  clearPathState()
  pathMode.value = false
  await fetchGraph()
  await nextTick()
  renderGraph()
})
</script>

<template>
  <div class="graph-explorer" data-testid="graph-explorer">
    <!-- Controls bar -->
    <div class="ge-controls" data-testid="ge-controls">
      <!-- Depth slider -->
      <label class="ge-control">
        <span class="ge-control__label">Depth</span>
        <input
          v-model.number="depth"
          type="range"
          min="0"
          max="3"
          step="1"
          data-testid="ge-depth-slider"
        />
        <span class="ge-control__value" data-testid="ge-depth-value">{{ depth }}</span>
      </label>

      <!-- Type filters -->
      <div class="ge-control ge-control--types">
        <span class="ge-control__label">Types</span>
        <label
          v-for="(checked, type) in typeFilters"
          :key="type"
          class="ge-type-filter"
          :data-testid="`ge-filter-${type.toLowerCase()}`"
        >
          <input
            v-model="typeFilters[type]"
            type="checkbox"
          />
          <span
            class="ge-type-dot"
            :style="{ background: NODE_STYLES[type]?.color || '#6b7280' }"
          ></span>
          {{ type }}
        </label>
      </div>

      <!-- Keyword filter -->
      <label class="ge-control">
        <span class="ge-control__label">Filter</span>
        <input
          v-model="keyword"
          type="text"
          placeholder="keyword..."
          class="ge-keyword"
          data-testid="ge-keyword"
        />
      </label>

      <!-- Path mode toggle -->
      <button
        class="ge-path-btn"
        :class="{ 'ge-path-btn--active': pathMode }"
        data-testid="ge-path-toggle"
        @click="togglePathMode"
      >
        {{ pathMode ? '✕ Exit path mode' : 'Find path to…' }}
      </button>

      <!-- Timeline toggle -->
      <button
        class="ge-path-btn"
        :class="{ 'ge-path-btn--active': timelineEnabled }"
        data-testid="ge-timeline-toggle"
        @click="toggleTimeline"
      >
        {{ timelineEnabled ? '✕ Timeline' : 'Timeline' }}
      </button>

      <!-- Export -->
      <div class="ge-control ge-control--export">
        <button class="ge-export-btn" data-testid="ge-export-svg" @click="exportSvg">SVG</button>
        <button class="ge-export-btn" data-testid="ge-export-png" @click="exportPng">PNG</button>
        <button class="ge-export-btn" data-testid="ge-export-json" @click="exportJson">JSON</button>
      </div>

      <!-- Saved views -->
      <button
        class="ge-path-btn"
        data-testid="ge-save-view"
        @click="saveView"
      >
        Save view
      </button>
      <button
        v-if="savedViews.length > 0"
        class="ge-path-btn"
        data-testid="ge-show-saved"
        @click="showSavedViews = !showSavedViews"
      >
        Saved ({{ savedViews.length }})
      </button>
    </div>

    <!-- Saved views panel -->
    <div
      v-if="showSavedViews && savedViews.length > 0"
      class="ge-saved-panel"
      data-testid="ge-saved-panel"
    >
      <div
        v-for="(v, i) in savedViews"
        :key="i"
        class="ge-saved-item"
      >
        <button
          class="ge-saved-item__name"
          :data-testid="`ge-saved-${i}`"
          @click="restoreView(v)"
        >
          {{ v.name }}
        </button>
        <span class="ge-saved-item__meta">depth {{ v.depth }}</span>
        <button
          class="ge-saved-item__delete"
          :data-testid="`ge-saved-delete-${i}`"
          @click="deleteView(i)"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Path search bar (visible when path mode is active) -->
    <div v-if="pathMode" class="ge-path-bar" data-testid="ge-path-bar">
      <div class="ge-path-search">
        <span class="ge-control__label">Path to</span>
        <input
          v-model="pathQuery"
          type="text"
          placeholder="Search entity name..."
          class="ge-path-input"
          data-testid="ge-path-input"
          @input="onPathQueryInput"
        />
        <!-- Search results dropdown -->
        <div
          v-if="pathSearchResults.length > 0"
          class="ge-path-results"
          data-testid="ge-path-results"
        >
          <button
            v-for="r in pathSearchResults"
            :key="r.id"
            class="ge-path-result"
            :data-testid="`ge-path-result-${r.id}`"
            @click="selectPathTarget(r)"
          >
            <span
              class="ge-type-dot"
              :style="{ background: NODE_STYLES[r.type]?.color || '#6b7280' }"
            ></span>
            {{ r.label }}
            <span class="ge-path-result__type">{{ r.type }}</span>
          </button>
        </div>
      </div>

      <!-- Path loading -->
      <span v-if="pathLoading" class="ge-path-loading" data-testid="ge-path-loading">
        Finding paths...
      </span>
    </div>

    <!-- Path legend (visible when paths found) -->
    <div
      v-if="pathData && pathData.paths.length > 0"
      class="ge-path-legend"
      data-testid="ge-path-legend"
    >
      <span class="ge-path-legend__summary">
        {{ pathData.paths.length }} path{{ pathData.paths.length > 1 ? 's' : '' }} found.
        Shortest: {{ pathData.shortest_length }} hop{{ pathData.shortest_length > 1 ? 's' : '' }}.
      </span>
      <div class="ge-path-legend__list">
        <button
          v-for="(p, i) in pathData.paths"
          :key="i"
          class="ge-path-legend__item"
          :class="{
            'ge-path-legend__item--selected': selectedPathIndex === i,
            'ge-path-legend__item--shortest': i === 0,
          }"
          :data-testid="`ge-path-${i}`"
          @click="selectPath(i)"
        >
          Path {{ i + 1 }}: {{ p.length }} hop{{ p.length > 1 ? 's' : '' }}
        </button>
      </div>
    </div>

    <!-- No paths found -->
    <div
      v-if="pathData && pathData.paths.length === 0"
      class="ge-path-none"
      data-testid="ge-path-none"
    >
      No paths found between these entities.
    </div>

    <!-- Timeline -->
    <div v-if="timelineEnabled && timelineMin" class="ge-timeline" data-testid="ge-timeline">
      <div class="ge-timeline__controls">
        <button
          class="ge-timeline__play"
          data-testid="ge-timeline-play"
          @click="timelinePlaying ? stopPlay() : startPlay()"
        >
          {{ timelinePlaying ? '⏸' : '▶' }}
        </button>
        <input
          :value="monthToIndex(timelineDate)"
          type="range"
          :min="monthToIndex(timelineMin)"
          :max="monthToIndex(timelineMax)"
          step="1"
          class="ge-timeline__slider"
          data-testid="ge-timeline-slider"
          @input="timelineDate = indexToMonth(Number($event.target.value)); onTimelineChange()"
        />
        <span class="ge-timeline__date" data-testid="ge-timeline-date">
          {{ timelineDate }}
        </span>
      </div>
      <div class="ge-timeline__stats" data-testid="ge-timeline-stats">
        {{ timelineStats.contracts }} contracts
        &middot; {{ timelineStats.directors }} directors
        &middot; {{ timelineStats.subsidiaries }} companies
      </div>
    </div>

    <!-- Status bar -->
    <div v-if="graphData" class="ge-status" data-testid="ge-status">
      <span>{{ graphData.nodes.length }} nodes</span>
      <span>{{ graphData.edges.length }} edges</span>
      <span
        v-if="graphData.truncated"
        class="ge-status--warn"
        data-testid="ge-truncated"
      >
        Showing {{ graphData.nodes.length }} of {{ graphData.total_available }} (truncated)
      </span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="ge-loading" data-testid="ge-loading">
      Loading graph...
    </div>

    <!-- Error -->
    <div v-if="error" class="ge-error" data-testid="ge-error">
      {{ error }}
    </div>

    <!-- Empty state -->
    <div
      v-if="!loading && !error && graphData && graphData.nodes.length === 0"
      class="ge-empty"
      data-testid="ge-empty"
    >
      No connections found for this entity.
    </div>

    <!-- Canvas -->
    <div
      ref="cyContainer"
      class="ge-canvas"
      data-testid="ge-canvas"
    ></div>

    <!-- Tooltip -->
    <div
      v-if="tooltip"
      class="ge-tooltip"
      data-testid="ge-tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      <div class="ge-tooltip__header">
        <span
          class="ge-type-dot"
          :style="{ background: NODE_STYLES[tooltip.type]?.color || '#6b7280' }"
        ></span>
        <strong>{{ tooltip.label }}</strong>
        <span class="ge-tooltip__type">{{ tooltip.type }}</span>
      </div>
      <div v-if="tooltip.properties.country" class="ge-tooltip__prop">
        Country: {{ tooltip.properties.country }}
      </div>
      <div v-if="tooltip.properties.value_eur" class="ge-tooltip__prop">
        Value: &euro;{{ Number(tooltip.properties.value_eur).toLocaleString() }}
      </div>
      <div class="ge-tooltip__actions">
        <button
          v-if="tooltip.type === 'Company'"
          class="ge-tooltip__btn"
          data-testid="ge-go-profile"
          @click="goToProfile(tooltip.id, tooltip.type)"
        >
          Go to profile
        </button>
        <button
          class="ge-tooltip__btn"
          data-testid="ge-set-center"
          @click="setAsCenter(tooltip.id)"
        >
          Set as center
        </button>
        <button
          v-if="pathMode && tooltip.id !== entityId"
          class="ge-tooltip__btn"
          data-testid="ge-find-path-to"
          @click="selectPathTarget({ id: tooltip.id, label: tooltip.label, type: tooltip.type })"
        >
          Find path to
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.graph-explorer {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 500px;
}

.ge-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 0;
  align-items: center;
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}

.ge-control {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text);
}

.ge-control__label {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  font-size: 10px;
}

.ge-control__value {
  font-weight: 700;
  min-width: 16px;
  text-align: center;
}

.ge-control--types {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ge-type-filter {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  cursor: pointer;
}

.ge-type-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.ge-keyword {
  padding: 2px 6px;
  font-size: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 3px;
  width: 120px;
}

.ge-status {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--muted);
  padding: 4px 0;
}

.ge-status--warn {
  color: #f59e0b;
  font-weight: 600;
}

.ge-loading, .ge-error, .ge-empty {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
}

.ge-error {
  color: #ef4444;
}

.ge-canvas {
  flex: 1;
  min-height: 400px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
}

/* ── Path mode ──────────────────────────── */
.ge-path-btn {
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  border-radius: 3px;
  white-space: nowrap;
}

.ge-path-btn:hover {
  background: var(--accent);
  color: white;
}

.ge-path-btn--active {
  background: var(--accent);
  color: white;
}

.ge-path-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}

.ge-path-search {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.ge-path-input {
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 3px;
  flex: 1;
  max-width: 300px;
}

.ge-path-results {
  position: absolute;
  top: 100%;
  left: 40px;
  z-index: 20;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  max-height: 200px;
  overflow-y: auto;
  min-width: 250px;
}

.ge-path-result {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 10px;
  font-size: 12px;
  border: none;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  text-align: left;
}

.ge-path-result:hover {
  background: var(--surface);
}

.ge-path-result__type {
  margin-left: auto;
  font-size: 10px;
  color: var(--muted);
  text-transform: uppercase;
}

.ge-path-loading {
  font-size: 11px;
  color: var(--muted);
}

/* ── Path legend ────────────────────────── */
.ge-path-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 11px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}

.ge-path-legend__summary {
  color: var(--text);
  font-weight: 600;
}

.ge-path-legend__list {
  display: flex;
  gap: 4px;
}

.ge-path-legend__item {
  padding: 2px 8px;
  font-size: 10px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 3px;
}

.ge-path-legend__item--shortest {
  border-color: #3b82f6;
  color: #3b82f6;
}

.ge-path-legend__item--selected {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.ge-path-none {
  padding: 8px 0;
  font-size: 12px;
  color: var(--muted);
}

/* ── Export ──────────────────────────────── */
.ge-control--export {
  display: flex;
  gap: 3px;
}

.ge-export-btn {
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 600;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 2px;
}

.ge-export-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ── Saved views ────────────────────────── */
.ge-saved-panel {
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  padding: 6px;
  margin-bottom: 8px;
  max-height: 160px;
  overflow-y: auto;
}

.ge-saved-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 4px;
}

.ge-saved-item__name {
  flex: 1;
  font-size: 12px;
  color: var(--accent);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  padding: 0;
}

.ge-saved-item__name:hover {
  text-decoration: underline;
}

.ge-saved-item__meta {
  font-size: 10px;
  color: var(--muted);
}

.ge-saved-item__delete {
  font-size: 10px;
  color: var(--muted);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0 2px;
}

.ge-saved-item__delete:hover {
  color: #ef4444;
}

/* ── Timeline ───────────────────────────── */
.ge-timeline {
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}

.ge-timeline__controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ge-timeline__play {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  border-radius: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ge-timeline__play:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.ge-timeline__slider {
  flex: 1;
  height: 4px;
  cursor: pointer;
}

.ge-timeline__date {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  min-width: 60px;
  text-align: right;
}

.ge-timeline__stats {
  font-size: 11px;
  color: var(--muted);
  margin-top: 4px;
}

/* ── Tooltip ────────────────────────────── */
.ge-tooltip {
  position: absolute;
  z-index: 10;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transform: translate(-50%, -100%);
  margin-top: -12px;
  min-width: 180px;
  max-width: 280px;
}

.ge-tooltip__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.ge-tooltip__type {
  font-size: 10px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.ge-tooltip__prop {
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 2px;
}

.ge-tooltip__actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.ge-tooltip__btn {
  padding: 2px 8px;
  font-size: 11px;
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  border-radius: 3px;
}

.ge-tooltip__btn:hover {
  background: var(--accent);
  color: white;
}
</style>
