<script setup>
defineProps({
  modelValue: { type: String, required: true },
  views: { type: Array, required: true }, // [{ key: string, label: string }]
})

defineEmits(['update:modelValue'])
</script>

<template>
  <nav class="gmr-view-sel" data-testid="view-selector" aria-label="Data view">
    <button
      v-for="v in views"
      :key="v.key"
      type="button"
      class="gmr-view-sel__item"
      :class="{ 'gmr-view-sel__item--active': modelValue === v.key }"
      :data-testid="`view-opt-${v.key}`"
      :aria-current="modelValue === v.key ? 'page' : undefined"
      @click="$emit('update:modelValue', v.key)"
    >
      {{ v.label }}
    </button>
  </nav>
</template>

<style scoped>
.gmr-view-sel {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0;
  min-width: 140px;
}

.gmr-view-sel__item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}

.gmr-view-sel__item:hover {
  background: var(--surface);
  color: var(--text);
}

.gmr-view-sel__item--active {
  background: var(--surface);
  color: var(--accent);
  font-weight: 600;
}
</style>
