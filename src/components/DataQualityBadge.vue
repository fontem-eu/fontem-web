<script setup>
/**
 * A small, reusable data-quality badge. Given a list of concerns it
 * renders one indicator (the highest-severity glyph) with a tooltip
 * listing every concern. Renders nothing when there are no concerns, so
 * callers can drop it next to any datum unconditionally.
 *
 * concerns: Array<{ level: 'error' | 'warning', key: string }>
 *   `key` is an i18n key resolved with $t().
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  concerns: { type: Array, default: () => [] },
})

const { t } = useI18n()

const hasError = computed(() => props.concerns.some((c) => c.level === 'error'))
const tooltip = computed(() =>
  props.concerns.map((c) => t(c.key)).join('\n'),
)
const ariaLabel = computed(() => `${t('data_quality.badge_aria')}: ${tooltip.value}`)
</script>

<template>
  <!-- A warning triangle (⚠). An inline <svg> (not a span[role=img]) so
       it is accessible and portable; <title> gives the native tooltip. -->
  <svg
    v-if="concerns.length"
    class="dq-badge"
    :class="hasError ? 'dq-badge--error' : 'dq-badge--warning'"
    viewBox="0 0 16 16"
    width="13"
    height="13"
    role="img"
    :aria-label="ariaLabel"
    data-testid="dq-badge"
  >
    <title>{{ tooltip }}</title>
    <path
      d="M8 1.2 15 14H1L8 1.2Z"
      fill="currentColor"
      fill-opacity="0.18"
      stroke="currentColor"
      stroke-width="1.2"
      stroke-linejoin="round"
    />
    <rect x="7.25" y="6" width="1.5" height="4" rx="0.75" fill="currentColor" />
    <circle cx="8" cy="11.6" r="0.9" fill="currentColor" />
  </svg>
</template>

<style scoped>
.dq-badge {
  display: inline-block;
  margin-left: 0.35em;
  vertical-align: middle;
  cursor: help;
}
.dq-badge--error { color: #dc2626; }
.dq-badge--warning { color: #d97706; }
</style>
