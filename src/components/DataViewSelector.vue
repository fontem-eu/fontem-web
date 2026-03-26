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
  <div class="gmr-view-sel-wrap">
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
  </div>
</template>

<style scoped>
/* Mobile: scrollable horizontal tab strip */
.gmr-view-sel-wrap {
  position: relative;
  width: 100%;
}

/* Fade gradient hinting there are more tabs to the right */
.gmr-view-sel-wrap::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 2.5rem;
  height: 100%;
  background: linear-gradient(to right, transparent, var(--bg));
  pointer-events: none;
}

.gmr-view-sel {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
  min-width: unset;
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.gmr-view-sel::-webkit-scrollbar {
  display: none;
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
  .gmr-view-sel-wrap {
    width: auto;
  }

  .gmr-view-sel-wrap::after {
    display: none;
  }

  .gmr-view-sel {
    flex-direction: column;
    flex-wrap: nowrap;
    padding: 8px 0;
    border-bottom: none;
    min-width: 140px;
    width: auto;
    overflow-x: visible;
  }

  .gmr-view-sel__item {
    flex: none;
    width: 100%;
    text-align: left;
    padding: 8px 12px;
  }
}
</style>
