<script setup>
defineProps({
  modelValue: { type: String, required: true },
  views: { type: Array, required: true }, // [{ key: string, label: string }]
})

defineEmits(['update:modelValue'])

const GMR_LONG_TOOLTIP =
  'GMR Long scores a stock for long-term value investing using 5-year averages: ' +
  'P/E ≤ 15, P/B ≤ 1.5, ROE ≥ 15%, Net Margin ≥ 15%, D/E ≤ 1.5, Div. Yield ≥ 3.5%. ' +
  'Developed by Gonçalo Martins Rato.'
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
      <span
        v-if="v.key === 'gmr-long'"
        class="gmr-info"
        :title="GMR_LONG_TOOLTIP"
        data-testid="gmr-long-info"
        @click.stop
      >ⓘ</span>
    </button>
  </nav>
</template>

<style scoped>
/* Mobile: horizontal tab strip */
.gmr-view-sel {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
  min-width: unset;
  width: 100%;
}

.gmr-view-sel__item {
  display: block;
  flex: 1 1 auto;
  text-align: center;
  padding: 7px 10px;
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

/* Info icon */
.gmr-info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 3px;
  font-size: 0.7rem;
  color: var(--muted);
  opacity: 0.7;
  cursor: help;
  vertical-align: middle;
  line-height: 1;
}

/* Desktop: vertical left-side nav */
@media (min-width: 640px) {
  .gmr-view-sel {
    flex-direction: column;
    flex-wrap: nowrap;
    padding: 8px 0;
    border-bottom: none;
    min-width: 140px;
    width: auto;
  }

  .gmr-view-sel__item {
    flex: none;
    width: 100%;
    text-align: left;
    padding: 8px 12px;
  }
}
</style>
