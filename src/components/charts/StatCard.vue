<script setup>
/**
 * Simple stat card with big number + label.
 * Props: value (string/number), label, color (optional), sub (optional subtitle)
 */
defineProps({
  value: { type: [String, Number], required: true },
  label: { type: String, required: true },
  sub: { type: String, default: '' },
  color: { type: String, default: null },
})
</script>

<template>
  <div class="sc">
    <div class="sc-value" :style="color ? { color } : {}">{{ value }}</div>
    <div class="sc-label">{{ label }}</div>
    <div v-if="sub" class="sc-sub">{{ sub }}</div>
  </div>
</template>

<style scoped>
.sc { text-align: center; padding: 0.75rem; }
.sc-value { font-size: 1.6rem; font-weight: 700; color: var(--accent); line-height: 1.2; }
.sc-label { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 0.15rem; }
.sc-sub { font-size: 0.7rem; color: var(--muted); margin-top: 0.1rem; opacity: 0.7; }
</style>
