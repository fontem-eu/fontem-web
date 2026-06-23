<script setup>
/**
 * Dossier tree navigator. Renders a flat node list (`{id, title, parent_id}`)
 * as a Confluence-style tree: select to navigate, expand/collapse, and (when
 * `editable`) add a sub-article or remove a node. Pure presentation — all
 * mutations are emitted for the parent (DossierView) to persist.
 */
import { ref, computed, toRef, provide, watch } from 'vue'
import { buildTree } from '../utils/buildTree.js'
import TreeNode from './TreeNode.vue'

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  selectedId: { type: String, default: null },
  editable: { type: Boolean, default: true },
})
const emit = defineEmits(['select', 'add-child', 'remove'])

const roots = computed(() => buildTree(props.nodes))
const expanded = ref(new Set((props.nodes || []).map((n) => n.id)))

// Auto-expand newly-arrived nodes so freshly-added sub-articles are visible.
watch(() => props.nodes, (ns) => {
  for (const n of ns || []) if (!expanded.value.has(n.id)) expanded.value.add(n.id)
}, { deep: true })

function toggle(id) {
  const s = new Set(expanded.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expanded.value = s
}

provide('treenav', {
  selectedId: toRef(props, 'selectedId'),
  editable: props.editable,
  expanded,
  toggle,
  onSelect: (id) => emit('select', id),
  onAddChild: (id) => emit('add-child', id),
  onRemove: (id) => emit('remove', id),
})
</script>

<template>
  <div class="tree-nav" data-testid="tree-nav">
    <div v-if="!roots.length" class="tn-empty" data-testid="tree-empty">
      {{ $t('investigations.dossier_empty') }}
    </div>
    <TreeNode v-for="r in roots" :key="r.id" :node="r" :depth="0" />
  </div>
</template>

<style scoped>
.tree-nav { list-style: none; padding: 0; margin: 0; }
.tn-empty { color: var(--muted); font-size: 0.8rem; padding: 0.5rem; }
</style>
