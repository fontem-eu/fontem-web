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
const tooltip = ref(null) // {x, y, node}
const cyContainer = ref(null)

let cy = null

// ── Node styles ──────────────────────────────────────────────
const NODE_STYLES = {
  Company:   { shape: 'ellipse',   color: '#3b82f6' },
  Contract:  { shape: 'diamond',   color: '#f59e0b' },
  Authority: { shape: 'hexagon',   color: '#10b981' },
  Person:    { shape: 'triangle',  color: '#8b5cf6' },
  Unknown:   { shape: 'ellipse',   color: '#6b7280' },
}

// ── API ──────────────────────────────────────────────────────
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

// ── Cytoscape ────────────────────────────────────────────────
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

  // Click node → show tooltip
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

  // Click background → dismiss tooltip
  cy.on('tap', (evt) => {
    if (evt.target === cy) tooltip.value = null
  })

  applyKeywordFilter()
}

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

function setAsCenter(nodeId) {
  tooltip.value = null
  emit('navigate', nodeId)
}

function goToProfile(nodeId, nodeType) {
  tooltip.value = null
  if (nodeType === 'Company') {
    const id = nodeId
    window.location.hash = ''
    window.location.pathname = `/c/${id}/profile`
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
