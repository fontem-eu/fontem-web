<script setup>
/**
 * Entity-mention chip — rendered inside Tiptap as a class-coloured
 * pill. Click dispatches a CustomEvent on `document` so any ancestor
 * (story view or editor) can open the side panel without this
 * component needing to know about routing.
 */
import { computed } from 'vue'
import { NodeViewWrapper } from '@tiptap/vue-3'

const props = defineProps({
  node: { type: Object, required: true },
  editor: { type: Object, required: true },
  deleteNode: { type: Function, required: true },
})

const iri = computed(() => props.node.attrs.iri)
const label = computed(() => props.node.attrs.label || '')
const cls = computed(() => props.node.attrs.class || 'Company')

const editable = computed(() => props.editor?.isEditable ?? false)

function onActivate(e) {
  e.stopPropagation()
  if (typeof window === 'undefined') return
  // Bubble through `document` rather than emit on the node — Tiptap
  // doesn't pipe component emits to the parent anyway, and the side
  // panel lives outside the editor tree.
  document.dispatchEvent(new CustomEvent('entity-mention-click', {
    detail: { iri: iri.value, label: label.value, class: cls.value },
  }))
}
</script>

<template>
  <NodeViewWrapper as="span" class="entity-mention-wrap">
    <button
      type="button"
      class="chip"
      :class="`cls-${cls.toLowerCase()}`"
      :data-entity-iri="iri"
      :data-entity-class="cls"
      :data-testid="`entity-mention-${cls.toLowerCase()}`"
      :title="`${cls}: ${label}`"
      @click="onActivate"
      @mousedown.prevent
    >
      <span class="chip-dot" />
      <span class="chip-label">{{ label }}</span>
      <button
        v-if="editable"
        type="button"
        class="chip-delete"
        aria-label="Remove mention"
        @click.stop="deleteNode"
      >×</button>
    </button>
  </NodeViewWrapper>
</template>

<style scoped>
.entity-mention-wrap { display: inline; }

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.05rem 0.5rem 0.05rem 0.4rem;
  margin: 0 0.1rem;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--surface);
  font: inherit;
  font-size: 0.85em;
  color: var(--text);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  vertical-align: baseline;
}
.chip:hover {
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
}
.chip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.chip-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.7;
  flex-shrink: 0;
}
.chip-label { white-space: nowrap; }
.chip-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.95rem;
  height: 0.95rem;
  margin-left: 0.1rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.75rem;
  line-height: 1;
}
.chip-delete:hover { background: color-mix(in srgb, var(--text) 12%, transparent); color: var(--text); }

/* Class-coloured dot. The chip body stays neutral so a paragraph
   full of mentions doesn't look like a tag-cloud. */
.chip.cls-company { color: #16a34a; }
.chip.cls-authority { color: #2563eb; }
.chip.cls-person { color: #b45309; }
.chip.cls-lobbyist { color: #db2777; }
.chip.cls-nutsregion { color: #7c3aed; }
.chip.cls-cohesionproject { color: #0891b2; }
.chip.cls-sanctionedentity { color: #dc2626; }
</style>
