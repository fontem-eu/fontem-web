<script setup>
/**
 * Entity side panel — slides in from the right when a chip is clicked
 * and shows facts about the mentioned entity. Listens on the
 * `entity-mention-click` document event (dispatched by EntityMentionView)
 * so any chip in any context (story view, editor) opens the panel
 * without prop drilling.
 *
 * Resolves the mention via /api/mentions/resolve?iri=<iri>. Today the
 * endpoint reads Neo4j; post-Virtuoso it'll DESCRIBE <iri> against
 * SPARQL — same shape, no caller change.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

const open = ref(false)
const loading = ref(false)
const error = ref(null)
const detail = ref(null)
let lastIri = null

async function resolve(iri) {
  loading.value = true
  error.value = null
  detail.value = null
  try {
    const res = await fetch(`/api/mentions/resolve?iri=${encodeURIComponent(iri)}`)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${body}`)
    }
    const data = await res.json()
    // Guard against stale responses if the user clicked a different
    // chip while the previous fetch was in flight.
    if (lastIri === iri) detail.value = data
  } catch (err) {
    if (lastIri === iri) error.value = err.message
  } finally {
    if (lastIri === iri) loading.value = false
  }
}

function onMentionClick(e) {
  const { iri } = e.detail || {}
  if (!iri) return
  open.value = true
  lastIri = iri
  resolve(iri)
}

function close() {
  open.value = false
  lastIri = null
}

function onKey(e) {
  if (e.key === 'Escape' && open.value) close()
}

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('entity-mention-click', onMentionClick)
    document.addEventListener('keydown', onKey)
  }
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('entity-mention-click', onMentionClick)
    document.removeEventListener('keydown', onKey)
  }
})
</script>

<template>
  <div v-if="open" class="side-panel-backdrop" @click="close">
    <dialog
      class="side-panel"
      open
      :aria-label="$t('entity_side.entity_details')"
      data-testid="entity-side-panel"
      @click.stop
    >
      <div class="side-panel-header">
        <span v-if="detail" class="cls-pill" :class="`cls-${detail.class.toLowerCase()}`">
          {{ detail.class }}
        </span>
        <button type="button" class="close-btn" data-testid="entity-side-panel-close" @click="close">×</button>
      </div>

      <div v-if="loading" class="side-panel-loading">{{ $t('app.loading') }}</div>
      <div v-else-if="error" class="side-panel-error">{{ error }}</div>
      <template v-else-if="detail">
        <h2 class="side-panel-title" data-testid="entity-side-panel-label">
          {{ detail.label || '(no label)' }}
        </h2>
        <dl v-if="detail.facts && detail.facts.length" class="side-panel-facts">
          <template v-for="f in detail.facts" :key="f.key">
            <dt>{{ f.key }}</dt>
            <dd>{{ f.value }}</dd>
          </template>
        </dl>
        <div v-if="detail.links?.profile" class="side-panel-links">
          <router-link
            :to="detail.links.profile"
            class="profile-link"
            data-testid="entity-side-panel-profile-link"
            @click="close"
          >Open full profile →</router-link>
        </div>
      </template>
    </dialog>
  </div>
</template>

<style scoped>
.side-panel-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.18);
  /* Above the sticky app header (z-index 70): the panel is a modal
     overlay — at 40 its close button rendered UNDER the header's
     avatar and clicks were intercepted whenever a short entity label
     kept the button inside the top 3.25rem. */
  z-index: 80;
}

.side-panel {
  position: fixed;
  z-index: 81;
  top: 0; right: 0; bottom: 0;
  left: auto;
  margin: 0;
  max-width: none;
  max-height: none;
  width: min(380px, 92vw);
  background: var(--surface);
  border: none;
  border-left: 1px solid var(--border);
  box-shadow: -4px 0 18px rgba(0, 0, 0, 0.08);
  padding: 1rem 1.25rem 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.side-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.cls-pill {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
}
.cls-pill.cls-company { background: color-mix(in srgb, #16a34a 18%, var(--surface)); color: #166534; }
.cls-pill.cls-authority { background: color-mix(in srgb, #2563eb 18%, var(--surface)); color: #1d4ed8; }
.cls-pill.cls-person { background: color-mix(in srgb, #b45309 18%, var(--surface)); color: #92400e; }
.cls-pill.cls-lobbyist { background: color-mix(in srgb, #db2777 18%, var(--surface)); color: #be185d; }
.cls-pill.cls-nutsregion { background: color-mix(in srgb, #7c3aed 18%, var(--surface)); color: #6d28d9; }
.cls-pill.cls-cohesionproject { background: color-mix(in srgb, #0891b2 18%, var(--surface)); color: #0e7490; }
.cls-pill.cls-sanctionedentity { background: color-mix(in srgb, #dc2626 18%, var(--surface)); color: #b91c1c; }

.close-btn {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.25rem;
}
.close-btn:hover { color: var(--text); }

.side-panel-loading,
.side-panel-error {
  font-size: 0.85rem;
}
.side-panel-error { color: #dc2626; }

.side-panel-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
  color: var(--text);
  line-height: 1.3;
}

.side-panel-facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 0.75rem;
  margin: 0;
  font-size: 0.85rem;
}
.side-panel-facts dt { color: var(--muted); }
.side-panel-facts dd { margin: 0; color: var(--text); }

.profile-link {
  display: inline-block;
  margin-top: 0.5rem;
  color: var(--accent);
  font-size: 0.85rem;
  text-decoration: none;
}
.profile-link:hover { text-decoration: underline; }
</style>
