<script setup>
/**
 * Circular gauge chart for percentages.
 * Props: value (0-100), label, color (optional), size (px, default 120)
 */
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, required: true },
  label: { type: String, default: '' },
  color: { type: String, default: null },
  size: { type: Number, default: 120 },
})

const radius = computed(() => props.size / 2 - 8)
const circumference = computed(() => 2 * Math.PI * radius.value)
const dashOffset = computed(() => circumference.value * (1 - Math.min(props.value, 100) / 100))
const displayValue = computed(() => Math.round(props.value))
const gaugeColor = computed(() => {
  if (props.color) return props.color
  if (props.value >= 80) return '#16a34a'
  if (props.value >= 50) return '#d97706'
  return '#dc2626'
})
</script>

<template>
  <div class="gauge" :style="{ width: size + 'px' }">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <circle
        :cx="size / 2" :cy="size / 2" :r="radius"
        fill="none" stroke="var(--border, #e5e7eb)" stroke-width="6"
      />
      <circle
        :cx="size / 2" :cy="size / 2" :r="radius"
        fill="none" :stroke="gaugeColor" stroke-width="6"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        :transform="`rotate(-90 ${size / 2} ${size / 2})`"
        style="transition: stroke-dashoffset 0.6s ease"
      />
      <text
:x="size / 2" :y="size / 2 + 2" text-anchor="middle" dominant-baseline="middle"
        :fill="gaugeColor" font-weight="700" :font-size="size * 0.22">
        {{ displayValue }}%
      </text>
    </svg>
    <div v-if="label" class="gauge-label">{{ label }}</div>
  </div>
</template>

<style scoped>
.gauge { display: flex; flex-direction: column; align-items: center; }
.gauge-label { font-size: 0.75rem; color: var(--muted); margin-top: 0.25rem; text-align: center; }
</style>
