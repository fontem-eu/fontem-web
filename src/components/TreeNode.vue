<script setup>
/** One node in the dossier TreeNav. Recursive — renders its children via
 * itself. All interaction is delegated to the injected `treenav` context so
 * events bubble to TreeNav without per-level wiring. */
import { inject, computed } from 'vue'

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
})
const ctx = inject('treenav')
const hasChildren = computed(() => (props.node.children || []).length > 0)
const isOpen = computed(() => ctx.expanded.value.has(props.node.id))
const isSelected = computed(() => ctx.selectedId.value === props.node.id)
</script>

<template>
  <div class="tn-item" :data-testid="'tree-node-' + node.id">
    <div
      class="tn-row"
      :class="{ 'tn-selected': isSelected }"
      :style="{ paddingLeft: (depth * 14 + 4) + 'px' }"
    >
      <button
        v-if="hasChildren"
        class="tn-toggle"
        :data-testid="'tree-toggle-' + node.id"
        :aria-expanded="isOpen"
        @click="ctx.toggle(node.id)"
      >{{ isOpen ? '▾' : '▸' }}</button>
      <span v-else class="tn-toggle tn-leaf" />
      <button class="tn-title" :data-testid="'tree-select-' + node.id" @click="ctx.onSelect(node.id)">
        {{ node.title || 'Untitled' }}
      </button>
      <template v-if="ctx.editable">
        <button class="tn-act" :data-testid="'tree-add-' + node.id" title="Add sub-article" @click="ctx.onAddChild(node.id)">+</button>
        <button class="tn-act tn-rm" :data-testid="'tree-remove-' + node.id" title="Remove" @click="ctx.onRemove(node.id)">×</button>
      </template>
    </div>
    <div v-if="hasChildren && isOpen" class="tn-children">
      <TreeNode v-for="child in node.children" :key="child.id" :node="child" :depth="depth + 1" />
    </div>
  </div>
</template>

<style scoped>
.tn-item { list-style: none; }
.tn-children { list-style: none; padding: 0; margin: 0; }
.tn-row { display: flex; align-items: center; gap: 0.25rem; padding: 0.2rem 0.25rem; border-radius: 4px; }
.tn-row:hover { background: var(--bg); }
.tn-selected { background: var(--surface); outline: 1px solid var(--accent); }
.tn-toggle { width: 16px; border: none; background: none; color: var(--muted); cursor: pointer; font-size: 0.7rem; padding: 0; }
.tn-leaf { cursor: default; }
.tn-title { flex: 1; text-align: left; border: none; background: none; color: var(--text); cursor: pointer; font-size: 0.83rem; padding: 0.1rem 0.2rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tn-act { border: none; background: none; color: var(--muted); cursor: pointer; font-size: 0.9rem; line-height: 1; padding: 0 0.2rem; opacity: 0; }
.tn-row:hover .tn-act { opacity: 1; }
.tn-rm:hover { color: #dc2626; }
</style>
