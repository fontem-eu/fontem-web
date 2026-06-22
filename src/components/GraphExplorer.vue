<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PocketButton from './PocketButton.vue'
import MultiSelect from './MultiSelect.vue'

// Lazy imports — Sigma requires WebGL which isn't available in test environments
let Graph, Sigma, forceAtlas2, noverlap
async function ensureImports() {
  if (!Graph) {
    const [g, s, fa2, nol] = await Promise.all([
      import('graphology'),
      import('sigma'),
      import('graphology-layout-forceatlas2'),
      import('graphology-layout-noverlap'),
    ])
    Graph = g.default || g
    Sigma = s.default || s.Sigma || s
    forceAtlas2 = fa2.default || fa2
    noverlap = nol.default || nol
  }
}

const props = defineProps({
  entityId: { type: String, required: true },
})

const emit = defineEmits(['navigate'])

// ── Pocket snapshot config ──────────────────────────────────
const pocketConfig = computed(() => ({
  entityId: props.entityId,
  depth: depth.value,
  typeFilters: { ...typeFilters.value },
  timeRange: timeRange.value,
}))

const pocketName = computed(() => {
  const id = props.entityId || 'unknown'
  return `${id} — Graph (depth ${depth.value})`
})

// ── State ────────────────────────────────────────────────────
const depth = ref(1)
const typeFilters = ref({
  Company: true, Contract: true, Authority: true, Person: true, Lobbyist: true,
})
const keyword = ref('')
const timeRange = ref('12m') // '12m' | '3y' | '5y' | 'all'
const edgeTypeFilters = ref({}) // populated dynamically from graph data
const loading = ref(false)
const graphData = ref(null)
const error = ref(null)
const tooltip = ref(null)
const cyContainer = ref(null)
const captureTarget = () => cyContainer.value
const optionsOpen = ref(false)
const fullscreen = ref(false)

function enterFullscreen() {
  fullscreen.value = true
  document.body.style.overflow = 'hidden'
  // Sigma needs to resize to the new container dimensions
  nextTick(() => renderer?.refresh?.())
}
function exitFullscreen() {
  fullscreen.value = false
  document.body.style.overflow = ''
  nextTick(() => renderer?.refresh?.())
}
function onKeydown(e) {
  if (e.key === 'Escape' && fullscreen.value) exitFullscreen()
}

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

let graph = null      // graphology instance
let renderer = null   // sigma renderer
let searchDebounce = null
let playInterval = null

// ── Expand/collapse state ───────────────────────────────────
// expandedNodes: Set of node IDs whose neighbors have been fetched and are visible
// collapsedNodes: Set of node IDs whose neighbors have been fetched but are hidden
// childrenOf: Map of node ID → Set of child node IDs added by expansion
const expandedNodes = ref(new Set())
const collapsedNodes = ref(new Set())
const childrenOf = new Map()  // not reactive — internal bookkeeping
const expandLoading = ref(null)  // node ID currently being loaded

// ── Node styles ──────────────────────────────────────────────
const NODE_STYLES = {
  Company:       { shape: 'ellipse',          color: '#3b82f6' },
  Contract:      { shape: 'diamond',          color: '#f59e0b' },
  Authority:     { shape: 'hexagon',          color: '#10b981' },
  Person:        { shape: 'triangle',         color: '#8b5cf6' },
  Lobbyist:      { shape: 'round-rectangle',  color: '#ec4899' },
  LobbyInterest: { shape: 'tag',             color: '#f472b6' },
  Unknown:       { shape: 'ellipse',          color: '#6b7280' },
}

/** Color map for MultiSelect dots — derived from NODE_STYLES */
const nodeTypeColors = Object.fromEntries(
  Object.entries(NODE_STYLES).map(([k, v]) => [k, v.color]),
)

// ── Depth stepper ───────────────────────────────────────────
function incrementDepth() { if (depth.value < 3) depth.value++ }
function decrementDepth() { if (depth.value > 0) depth.value-- }

// ── Time range ───────────────────────────────────────────────
function computeSinceDate() {
  if (timeRange.value === 'all') return null
  const now = new Date()
  const months = { '12m': 12, '3y': 36, '5y': 60 }
  const offset = months[timeRange.value] || 12
  now.setMonth(now.getMonth() - offset)
  return now.toISOString().slice(0, 10)
}

// ── Resolve entity ID ────────────────────────────────────────
const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function resolveEntityId(id) {
  if (_UUID_RE.test(id)) return id
  // Ticker — resolve to gmr_id via search API
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(id)}&limit=1`)
    if (res.ok) {
      const data = await res.json()
      const match = (data.companies || []).find(
        (c) => c.ticker === id || c.symbol === id,
      )
      if (match?.gmr_id) return match.gmr_id
    }
  } catch { /* fall through */ }
  return id // best-effort fallback
}

// ── Graph API ────────────────────────────────────────────────
async function fetchGraph() {
  loading.value = true
  error.value = null
  tooltip.value = null
  try {
    const entityId = await resolveEntityId(props.entityId)
    const types = Object.entries(typeFilters.value)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(',')
    const sinceDate = computeSinceDate()
    const url = `/api/graph/${encodeURIComponent(entityId)}`
      + `?depth=${depth.value}`
      + (types ? `&types=${types}` : '')
      + (sinceDate ? `&since=${sinceDate}` : '')
    const res = await fetch(url)
    if (!res.ok) throw new Error(`API ${res.status}`)
    graphData.value = await res.json()
    // Populate edge type filters from response
    const relTypes = new Set()
    for (const e of (graphData.value.edges || [])) relTypes.add(e.type)
    const existing = edgeTypeFilters.value
    const updated = {}
    for (const rt of relTypes) {
      updated[rt] = rt in existing ? existing[rt] : true
    }
    edgeTypeFilters.value = updated
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

// ── Sigma / graphology rendering (WebGL) ─────────────────────
async function renderGraph() {
  if (!graphData.value || !cyContainer.value) return
  await ensureImports()

  const isDark = document.documentElement.classList.contains('dark')

  // Clean up previous renderer
  if (renderer) { renderer.kill(); renderer = null }
  if (graph) { graph.clear(); graph = null }

  graph = new Graph()

  // Add nodes
  for (const node of graphData.value.nodes) {
    const style = NODE_STYLES[node.type] || NODE_STYLES.Unknown
    const isCenter = node.id === graphData.value.center.id
    graph.addNode(node.id, {
      label: node.label,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: isCenter ? 12 : 6,
      color: style.color,
      nodeType: node.type,
      properties: node.properties,
      borderColor: isCenter ? '#ef4444' : null,
      _origColor: style.color,
      _origSize: isCenter ? 12 : 6,
      _hidden: false,
    })
  }

  // Add edges
  for (const edge of graphData.value.edges) {
    const edgeId = `${edge.source}-${edge.target}-${edge.type}`
    const props = edge.properties || {}
    const edgeColor = isDark ? '#475569' : '#94a3b8'
    try {
      graph.addEdge(edge.source, edge.target, {
        id: edgeId,
        label: edge.type,
        color: edgeColor,
        size: 1,
        relType: edge.type,
        properties: props,
        _origColor: edgeColor,
        _hidden: false,
      })
    } catch { /* skip duplicate edges */ }
  }

  // Layout: ForceAtlas2 (runs synchronously for small graphs, fast)
  if (graph.order > 1) {
    const iterations = Math.min(graph.order * 3, 500)
    forceAtlas2.assign(graph, {
      iterations,
      settings: {
        gravity: 0.5,
        scalingRatio: 10,
        strongGravityMode: false,
        barnesHutOptimize: graph.order > 200,
      },
    })

    // Prevent label overlap
    noverlap.assign(graph, { maxIterations: 50, ratio: 2 })
  }

  // Create Sigma renderer (WebGL)
  renderer = new Sigma(graph, cyContainer.value, {
    labelColor: { color: isDark ? '#e0e0e0' : '#333333' },
    labelFont: 'Inter, system-ui, sans-serif',
    labelSize: 12,
    labelRenderedSizeThreshold: 6,
    edgeLabelColor: { color: isDark ? '#94a3b8' : '#64748b' },
    edgeLabelFont: 'Inter, system-ui, sans-serif',
    edgeLabelSize: 10,
    renderEdgeLabels: true,
    defaultEdgeType: 'arrow',
    minCameraRatio: 0.1,
    maxCameraRatio: 10,
    nodeReducer: (node, data) => {
      if (data._hidden) return { ...data, hidden: true }
      // Collapsed node visual cue: amber border
      if (collapsedNodes.value.has(node)) {
        return { ...data, borderSize: 3, borderColor: '#f59e0b' }
      }
      // Expanded node visual cue: green border
      if (expandedNodes.value.has(node)) {
        return { ...data, borderSize: 2, borderColor: '#10b981' }
      }
      // Loading node: pulsing effect via larger size
      if (expandLoading.value === node) {
        return { ...data, borderSize: 3, borderColor: '#3b82f6' }
      }
      if (data.borderColor) {
        return { ...data, borderSize: 2, borderColor: data.borderColor }
      }
      return data
    },
    edgeReducer: (_edge, data) => {
      if (data._hidden) return { ...data, hidden: true }
      return data
    },
  })

  // Click handler — single click shows tooltip, double click expands/collapses
  let clickTimer = null
  renderer.on('clickNode', ({ node }) => {
    if (clickTimer) {
      // Double click — expand/collapse
      clearTimeout(clickTimer)
      clickTimer = null
      tooltip.value = null
      toggleNodeExpansion(node)
    } else {
      // Single click — show tooltip after delay
      clickTimer = setTimeout(() => {
        clickTimer = null
        const attrs = graph.getNodeAttributes(node)
        const pos = renderer.graphToViewport(graph.getNodeAttributes(node))
        const isExpanded = expandedNodes.value.has(node)
        const isCollapsed = collapsedNodes.value.has(node)
        tooltip.value = {
          x: pos.x + (cyContainer.value?.offsetLeft ?? 0),
          y: pos.y + (cyContainer.value?.offsetTop ?? 0),
          id: node,
          label: attrs.label,
          type: attrs.nodeType,
          properties: attrs.properties || {},
          isExpanded,
          isCollapsed,
          hasChildren: childrenOf.has(node),
        }
      }, 250)
    }
  })

  renderer.on('clickStage', () => {
    tooltip.value = null
  })

  // Reset expand/collapse state on full re-render
  expandedNodes.value.clear()
  collapsedNodes.value.clear()
  childrenOf.clear()

  applyKeywordFilter()
  applyEdgeTypeFilter()
}

// ── Expand / Collapse ───────────────────────────────────────

async function toggleNodeExpansion(nodeId) {
  if (!graph || !graph.hasNode(nodeId)) return

  if (expandedNodes.value.has(nodeId)) {
    // Collapse: hide children
    collapseNode(nodeId)
  } else if (collapsedNodes.value.has(nodeId)) {
    // Re-expand: show previously hidden children
    reExpandNode(nodeId)
  } else {
    // First expansion: fetch neighbors from API
    await expandNode(nodeId)
  }
  renderer?.refresh()
}

async function expandNode(nodeId) {
  expandLoading.value = nodeId
  try {
    const res = await fetch(`/api/graph/${encodeURIComponent(nodeId)}?depth=1`)
    if (!res.ok) return
    const data = await res.json()

    const isDark = document.documentElement.classList.contains('dark')
    const parentAttrs = graph.getNodeAttributes(nodeId)
    const newChildren = new Set()

    // Add new nodes (skip if already in graph)
    for (const node of data.nodes) {
      if (graph.hasNode(node.id)) continue
      const style = NODE_STYLES[node.type] || NODE_STYLES.Unknown
      graph.addNode(node.id, {
        label: node.label,
        x: parentAttrs.x + (Math.random() - 0.5) * 30,
        y: parentAttrs.y + (Math.random() - 0.5) * 30,
        size: 5,
        color: style.color,
        nodeType: node.type,
        properties: node.properties,
        _origColor: style.color,
        _origSize: 5,
        _hidden: false,
        _addedBy: nodeId,
      })
      newChildren.add(node.id)
    }

    // Add new edges (skip duplicates)
    for (const edge of data.edges) {
      const edgeId = `${edge.source}-${edge.target}-${edge.type}`
      if (graph.hasEdge(edgeId)) continue
      if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue
      const props = edge.properties || {}
      const edgeColor = isDark ? '#475569' : '#94a3b8'
      try {
        graph.addEdge(edge.source, edge.target, {
          id: edgeId,
          label: edge.type,
          color: edgeColor,
          size: 1,
          relType: edge.type,
          properties: props,
          _origColor: edgeColor,
          _hidden: false,
        })
      } catch { /* skip */ }
    }

    // Run layout on the new nodes to position them nicely
    if (newChildren.size > 0 && graph.order > 1) {
      await ensureImports()
      forceAtlas2.assign(graph, {
        iterations: Math.min(newChildren.size * 5, 100),
        settings: { gravity: 0.5, scalingRatio: 10, strongGravityMode: false },
      })
    }

    childrenOf.set(nodeId, newChildren)
    expandedNodes.value.add(nodeId)
    collapsedNodes.value.delete(nodeId)

    // Visual cue: increase parent node size to indicate it has been expanded
    graph.setNodeAttribute(nodeId, 'size', (parentAttrs._origSize || 6) * 1.3)
  } finally {
    expandLoading.value = null
  }
}

function collapseNode(nodeId) {
  const children = childrenOf.get(nodeId)
  if (!children) return

  // Hide all children and their edges
  for (const childId of children) {
    if (!graph.hasNode(childId)) continue
    graph.setNodeAttribute(childId, '_hidden', true)
    // Hide edges connected to this child
    graph.forEachEdge(childId, (edge) => {
      graph.setEdgeAttribute(edge, '_hidden', true)
    })
  }

  expandedNodes.value.delete(nodeId)
  collapsedNodes.value.add(nodeId)

  // Visual cue: dashed border for collapsed nodes
  graph.setNodeAttribute(nodeId, 'borderColor', '#f59e0b')
  graph.setNodeAttribute(nodeId, 'borderSize', 3)
}

function reExpandNode(nodeId) {
  const children = childrenOf.get(nodeId)
  if (!children) return

  // Show all children and their edges
  for (const childId of children) {
    if (!graph.hasNode(childId)) continue
    graph.setNodeAttribute(childId, '_hidden', false)
    graph.forEachEdge(childId, (edge) => {
      graph.setEdgeAttribute(edge, '_hidden', false)
    })
  }

  collapsedNodes.value.delete(nodeId)
  expandedNodes.value.add(nodeId)

  // Remove collapsed visual cue
  graph.setNodeAttribute(nodeId, 'borderColor', null)
}

// ── Path highlighting ────────────────────────────────────────
function highlightPaths() {
  if (!graph || !pathData.value || !pathData.value.paths.length) return

  const pathNodeIds = new Set()
  const pathEdgeKeys = new Set()

  const activePaths = selectedPathIndex.value !== null
    ? [pathData.value.paths[selectedPathIndex.value]]
    : pathData.value.paths

  for (const p of activePaths) {
    for (const nid of p.node_ids) pathNodeIds.add(nid)
    for (const e of p.edges) pathEdgeKeys.add(`${e.source}-${e.target}-${e.type}`)
  }

  graph.forEachNode((node, attrs) => {
    graph.setNodeAttribute(node, 'color', pathNodeIds.has(node) ? attrs._origColor : '#2a2a2a')
    graph.setNodeAttribute(node, 'size', pathNodeIds.has(node) ? attrs._origSize : 3)
  })

  graph.forEachEdge((edge, attrs) => {
    const key = attrs.id || edge
    if (pathEdgeKeys.has(key)) {
      const isOnShortest = isEdgeOnShortestPath(key)
      graph.setEdgeAttribute(edge, 'color', isOnShortest ? '#3b82f6' : '#93c5fd')
      graph.setEdgeAttribute(edge, 'size', isOnShortest ? 3 : 1.5)
    } else {
      graph.setEdgeAttribute(edge, 'color', '#1a1a1a')
      graph.setEdgeAttribute(edge, 'size', 0.5)
    }
  })

  if (renderer) renderer.refresh()
}

function isEdgeOnShortestPath(edgeKey) {
  if (!pathData.value || !pathData.value.paths.length) return false
  const shortest = pathData.value.paths[0]
  return shortest.edges.some((e) => `${e.source}-${e.target}-${e.type}` === edgeKey)
}

function selectPath(index) {
  selectedPathIndex.value = selectedPathIndex.value === index ? null : index
  highlightPaths()
}

// ── Edge type filter ─────────────────────────────────────────
function applyEdgeTypeFilter() {
  if (!graph) return
  graph.forEachEdge((edge, attrs) => {
    const rt = attrs.relType
    graph.setEdgeAttribute(edge, '_hidden', rt && edgeTypeFilters.value[rt] === false)
  })
  if (renderer) renderer.refresh()
}

// ── Keyword filter ───────────────────────────────────────────
function applyKeywordFilter() {
  if (!graph) return
  const q = keyword.value.toLowerCase().trim()
  graph.forEachNode((node, attrs) => {
    const label = (attrs.label || '').toLowerCase()
    if (q && !label.includes(q)) {
      graph.setNodeAttribute(node, 'color', '#2a2a2a')
      graph.setNodeAttribute(node, 'size', 3)
    } else {
      graph.setNodeAttribute(node, 'color', attrs._origColor)
      graph.setNodeAttribute(node, 'size', attrs._origSize)
    }
  })
  if (renderer) renderer.refresh()
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
  if (!graph || !timelineEnabled.value || !timelineDate.value) return

  let contracts = 0
  let directors = 0
  let subsidiaries = 0
  const hiddenNodes = new Set()

  graph.forEachNode((node, attrs) => {
    const type = attrs.nodeType
    const props = attrs.properties || {}

    if (type === 'Contract') {
      const pubDate = (props.publication_date || '').slice(0, 7)
      if (pubDate && pubDate > timelineDate.value) {
        graph.setNodeAttribute(node, '_hidden', true)
        hiddenNodes.add(node)
      } else {
        graph.setNodeAttribute(node, '_hidden', false)
        if (pubDate) contracts++
      }
    } else if (type === 'Person') {
      graph.setNodeAttribute(node, '_hidden', false)
      directors++
    } else {
      graph.setNodeAttribute(node, '_hidden', false)
      if (type === 'Company' && node !== graphData.value?.center?.id) subsidiaries++
    }
  })

  graph.forEachEdge((edge, _attrs, source, target) => {
    graph.setEdgeAttribute(edge, '_hidden', hiddenNodes.has(source) || hiddenNodes.has(target))
  })

  timelineStats.value = { contracts, directors, subsidiaries }
  if (renderer) renderer.refresh()
}

function clearTimelineFilter() {
  if (!graph) return
  graph.forEachNode((node) => graph.setNodeAttribute(node, '_hidden', false))
  graph.forEachEdge((edge) => graph.setEdgeAttribute(edge, '_hidden', false))
  if (renderer) renderer.refresh()
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
  // Sigma doesn't export SVG natively — export PNG instead
  exportPng()
}

function exportPng() {
  if (!renderer) return
  // Sigma exposes the canvas layers
  const layers = renderer.getCanvases()
  const canvas = document.createElement('canvas')
  const mainCanvas = layers.edges || layers.nodes || Object.values(layers)[0]
  if (!mainCanvas) return
  canvas.width = mainCanvas.width
  canvas.height = mainCanvas.height
  const ctx = canvas.getContext('2d')
  // Draw all layers in order
  for (const layer of Object.values(layers)) {
    ctx.drawImage(layer, 0, 0)
  }
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = 'graph.png'
  link.click()
}

function exportJson() {
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
  typeFilters.value = view.typeFilters ?? { Company: true, Contract: true, Authority: true, Person: true, Lobbyist: true }
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
  document.addEventListener('keydown', onKeydown)
  await fetchGraph()
  await nextTick()
  renderGraph()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  // Release body scroll lock if still in fullscreen
  if (fullscreen.value) document.body.style.overflow = ''
  if (renderer) { renderer.kill(); renderer = null }
  if (graph) { graph.clear(); graph = null }
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

watch(timeRange, async () => {
  await fetchGraph()
  await nextTick()
  renderGraph()
})

watch(edgeTypeFilters, () => {
  applyEdgeTypeFilter()
}, { deep: true })

watch(() => props.entityId, async () => {
  clearPathState()
  pathMode.value = false
  await fetchGraph()
  await nextTick()
  renderGraph()
})

async function retryFetch() {
  await fetchGraph()
  await nextTick()
  renderGraph()
}
</script>

<template>
  <div
    class="graph-explorer"
    :class="{ 'graph-explorer--fullscreen': fullscreen }"
    data-testid="graph-explorer"
  >
    <!-- Fullscreen close button (top-right) -->
    <button
      v-if="fullscreen"
      class="ge-fs-close"
      data-testid="ge-fs-close"
      :title="$t('graph_explorer.exit_fullscreen')"
      @click="exitFullscreen"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
    <!-- Controls bar -->
    <div class="ge-controls" data-testid="ge-controls">
      <!-- Depth stepper -->
      <div class="ge-stepper" data-testid="ge-depth">
        <span class="ge-control__label">{{ $t('graph_explorer.depth') }}</span>
        <button
          class="ge-stepper__btn"
          data-testid="ge-depth-dec"
          :disabled="depth <= 0"
          @click="decrementDepth"
        >−</button>
        <span class="ge-stepper__value" data-testid="ge-depth-value">{{ depth }}</span>
        <button
          class="ge-stepper__btn"
          data-testid="ge-depth-inc"
          :disabled="depth >= 3"
          @click="incrementDepth"
        >+</button>
      </div>

      <!-- Period -->
      <div class="ge-control" data-testid="ge-time-range">
        <span class="ge-control__label">{{ $t('graph_explorer.period') }}</span>
        <select v-model="timeRange" class="ge-select" data-testid="ge-time-select">
          <option value="12m">12 mo</option>
          <option value="3y">3 yr</option>
          <option value="5y">5 yr</option>
          <option value="all">{{ $t('app.all') }}</option>
        </select>
      </div>

      <!-- Node type multi-select -->
      <MultiSelect
        v-model="typeFilters"
        label="Nodes"
        :colors="nodeTypeColors"
        data-testid="ge-node-filters"
      />

      <!-- Edge type multi-select -->
      <MultiSelect
        v-if="Object.keys(edgeTypeFilters).length > 0"
        v-model="edgeTypeFilters"
        label="Edges"
        data-testid="ge-edge-filters"
      />

      <!-- Keyword filter -->
      <input
        v-model="keyword"
        type="text"
        :placeholder="$t('graph_explorer.filter')"
        class="ge-keyword"
        data-testid="ge-keyword"
      />

      <!-- Fullscreen toggle (hidden when already fullscreen — use X close instead) -->
      <button
        v-if="!fullscreen"
        class="ge-fs-btn"
        data-testid="ge-fullscreen-btn"
        :title="$t('graph_explorer.fullscreen')"
        @click="enterFullscreen"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"/>
        </svg>
      </button>

      <!-- Options gear -->
      <div class="ge-options" data-testid="ge-options">
        <button
          class="ge-options__trigger"
          data-testid="ge-options-btn"
          :title="$t('graph_explorer.more_options')"
          :class="{ 'ge-options__trigger--active': optionsOpen }"
          @click.stop="optionsOpen = !optionsOpen"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
          </svg>
        </button>
        <div v-if="optionsOpen" class="ge-options__menu" data-testid="ge-options-menu">
          <button
            class="ge-options__item"
            data-testid="ge-path-toggle"
            @click="togglePathMode(); optionsOpen = false"
          >
            {{ pathMode ? '✕ Exit path mode' : 'Find path to…' }}
          </button>
          <button
            class="ge-options__item"
            data-testid="ge-timeline-toggle"
            @click="toggleTimeline(); optionsOpen = false"
          >
            {{ timelineEnabled ? '✕ Timeline' : 'Timeline' }}
          </button>
          <div class="ge-options__divider"></div>
          <div class="ge-options__group">
            <span class="ge-options__group-label">{{ $t('graph_explorer.export') }}</span>
            <div class="ge-options__export">
              <button class="ge-export-btn" data-testid="ge-export-svg" @click="exportSvg">{{ $t('graph_explorer.svg') }}</button>
              <button class="ge-export-btn" data-testid="ge-export-png" @click="exportPng">{{ $t('graph_explorer.png') }}</button>
              <button class="ge-export-btn" data-testid="ge-export-json" @click="exportJson">{{ $t('graph_explorer.json') }}</button>
            </div>
          </div>
          <div class="ge-options__divider"></div>
          <button
            class="ge-options__item"
            data-testid="ge-save-view"
            @click="saveView(); optionsOpen = false"
          >{{ $t('graph_explorer.save_view') }}</button>
          <button
            v-if="savedViews.length > 0"
            class="ge-options__item"
            data-testid="ge-show-saved"
            @click="showSavedViews = !showSavedViews; optionsOpen = false"
          >
            Saved ({{ savedViews.length }})
          </button>
          <div class="ge-options__divider"></div>
          <PocketButton
            widget-type="graph_explorer"
            :config="pocketConfig"
            :default-name="pocketName"
            :capture-target="captureTarget"
          />
        </div>
      </div>
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
        <span class="ge-control__label">{{ $t('graph_explorer.path_to') }}</span>
        <input
          v-model="pathQuery"
          type="text"
          :placeholder="$t('graph_explorer.search_entity_name')"
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
      <span v-if="pathLoading" class="ge-path-loading" data-testid="ge-path-loading">{{ $t('graph_explorer.finding_paths') }}</span>
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
    >{{ $t('graph_explorer.no_paths_found_between_these_entities') }}</div>

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
    <div v-if="loading" class="ge-loading" data-testid="ge-loading">{{ $t('graph_explorer.loading_graph') }}</div>
    <div v-if="expandLoading" class="ge-expand-loading" data-testid="ge-expand-loading">{{ $t('graph_explorer.expanding_node') }}</div>

    <!-- Error — prominent card with retry. Hides the canvas below so
         the user sees the error, not a 400px empty square. -->
    <div v-if="error" class="ge-error" data-testid="ge-error" role="alert">
      <div class="ge-error__icon" aria-hidden="true">!</div>
      <div class="ge-error__body">
        <div class="ge-error__title">{{ $t('graph_explorer.couldnt_load_the_graph') }}</div>
        <div class="ge-error__message">{{ error }}</div>
      </div>
      <button
        type="button"
        class="ge-error__retry"
        data-testid="ge-error-retry"
        @click="retryFetch"
      >{{ $t('app.retry') }}</button>
    </div>

    <!-- Empty state -->
    <div
      v-if="!loading && !error && graphData && graphData.nodes.length === 0"
      class="ge-empty"
      data-testid="ge-empty"
    >{{ $t('graph_explorer.no_connections_found_for_this_entity') }}</div>

    <!-- Canvas — hidden on error via v-show so the sigma ref stays
         mounted and renderGraph() can pick up where it left off after
         a successful retry. -->
    <div
      v-show="!error"
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
          class="ge-tooltip__btn ge-tooltip__btn--expand"
          data-testid="ge-expand-collapse"
          @click="toggleNodeExpansion(tooltip.id); tooltip = null"
        >
          {{ tooltip.isExpanded ? '▼ Collapse' : tooltip.isCollapsed ? '▶ Expand' : '▶ Expand' }}
        </button>
        <button
          v-if="tooltip.type === 'Company'"
          class="ge-tooltip__btn"
          data-testid="ge-go-profile"
          @click="goToProfile(tooltip.id, tooltip.type)"
        >{{ $t('graph_explorer.go_to_profile') }}</button>
        <button
          class="ge-tooltip__btn"
          data-testid="ge-set-center"
          @click="setAsCenter(tooltip.id)"
        >{{ $t('graph_explorer.set_as_center') }}</button>
        <button
          v-if="pathMode && tooltip.id !== entityId"
          class="ge-tooltip__btn"
          data-testid="ge-find-path-to"
          @click="selectPathTarget({ id: tooltip.id, label: tooltip.label, type: tooltip.type })"
        >{{ $t('graph_explorer.find_path_to') }}</button>
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
  gap: 8px;
  padding: 6px 0;
  align-items: center;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}

.ge-control {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text);
}

.ge-control__label {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  font-size: 10px;
}

/* ── Depth stepper ─────────────────────── */
.ge-stepper {
  display: flex;
  align-items: center;
  gap: 2px;
}

.ge-stepper__btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  border-radius: 3px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  padding: 0;
}

.ge-stepper__btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.ge-stepper__btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.ge-stepper__value {
  font-weight: 700;
  font-size: 12px;
  min-width: 16px;
  text-align: center;
}

.ge-type-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.ge-select {
  padding: 2px 6px;
  font-size: 11px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 3px;
  cursor: pointer;
}

.ge-keyword {
  padding: 2px 6px;
  font-size: 11px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 3px;
  width: 90px;
}

/* ── Fullscreen toggle ─────────────────── */
.ge-fs-btn {
  margin-left: auto;  /* pushes this and the gear to the right */
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 4px;
}
.ge-fs-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ── Options menu ──────────────────────── */
.ge-options {
  position: relative;
}

.ge-options__trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 4px;
}

.ge-options__trigger:hover,
.ge-options__trigger--active {
  border-color: var(--accent);
  color: var(--accent);
}

.ge-options__menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 30;
  min-width: 200px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  padding: 4px 0;
}

.ge-options__item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 12px;
  font-size: 11px;
  color: var(--text);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
}

.ge-options__item:hover {
  background: var(--surface);
}

.ge-options__divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

.ge-options__group {
  padding: 4px 12px;
}

.ge-options__group-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--muted);
  letter-spacing: 0.05em;
}

.ge-options__export {
  display: flex;
  gap: 4px;
  margin-top: 4px;
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

.ge-loading, .ge-empty {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
}

.ge-error {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  margin: 8px 0;
  background: color-mix(in srgb, #ef4444 12%, var(--surface));
  border: 1px solid color-mix(in srgb, #ef4444 40%, transparent);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text);
}
.ge-error__icon {
  flex: 0 0 24px;
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  background: #ef4444;
  color: #fff;
  border-radius: 50%;
  font-weight: 700;
  font-size: 14px;
  line-height: 1;
}
.ge-error__body { flex: 1 1 auto; min-width: 0; }
.ge-error__title {
  font-weight: 600;
  color: #ef4444;
  margin-bottom: 2px;
}
.ge-error__message {
  color: var(--muted);
  word-break: break-word;
}
.ge-error__retry {
  flex: 0 0 auto;
  padding: 6px 14px;
  background: transparent;
  border: 1px solid #ef4444;
  border-radius: 4px;
  color: #ef4444;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.ge-error__retry:hover {
  background: #ef4444;
  color: #fff;
}
.ge-error__retry:focus-visible {
  outline: 2px solid #ef4444;
  outline-offset: 2px;
}

.ge-canvas {
  flex: 1;
  min-height: 400px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
}

/* ── Fullscreen mode ───────────────────── */
.graph-explorer--fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--bg);
  padding: 8px;
  margin: 0;
  min-height: 0;
}

.graph-explorer--fullscreen .ge-canvas {
  min-height: 0;  /* fill remaining flex space instead of using min-height */
}

/* Close X button (top-right) */
.ge-fs-close {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1010;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--muted);
  cursor: pointer;
  border-radius: 4px;
}
.ge-fs-close:hover {
  border-color: #ef4444;
  color: #ef4444;
}

/* Landscape short screens (phone in landscape) — put controls as a left rail */
@media (orientation: landscape) and (max-height: 600px) {
  .graph-explorer--fullscreen {
    flex-direction: row;
  }
  .graph-explorer--fullscreen .ge-controls {
    flex-direction: column;
    align-items: stretch;
    border-bottom: none;
    border-right: 1px solid var(--border);
    margin-bottom: 0;
    margin-right: 8px;
    padding: 0 8px 0 0;
    max-width: 180px;
  }
  /* In left rail, the options gear should stay at the bottom */
  .graph-explorer--fullscreen .ge-fs-btn,
  .graph-explorer--fullscreen .ge-options {
    margin-left: 0;
    margin-top: auto;
  }
  .graph-explorer--fullscreen .ge-options__menu {
    left: calc(100% + 4px);
    right: auto;
    top: 0;
  }
  /* Keep close X clear of the rail */
  .ge-fs-close {
    top: 8px;
    right: 8px;
  }
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
.ge-tooltip__btn--expand {
  font-weight: 600;
}
.ge-expand-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--bg, #fff);
  border: 1px solid var(--border, #ddd);
  border-radius: 6px;
  padding: 0.5rem 1rem;
  font-size: 0.8rem;
  color: var(--muted, #999);
  z-index: 20;
  pointer-events: none;
}
</style>
