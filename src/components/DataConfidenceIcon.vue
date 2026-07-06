<script setup>
/**
 * Clickable data-confidence marker rendered next to a contract value —
 * the value-side sibling of the contract red flags. Colour encodes the
 * badness level (see contractValueBadness): red = value withheld (bad
 * source data), amber = shown but low-confidence, muted amber = caveat.
 * Clicking emits `click`; the parent opens DataConfidenceModal.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  badness: { type: Object, required: true },
})
defineEmits(['click'])
const { t } = useI18n()

const levelClass = computed(() => `dc-icon--l${props.badness.level}`)
const title = computed(() => t(props.badness.levelKey))
</script>

<template>
  <button
    type="button"
    class="dc-icon"
    :class="levelClass"
    :title="title"
    :aria-label="title"
    data-testid="data-confidence-icon"
    @click.stop="$emit('click')"
  >
    <!-- withheld: a barred circle (value removed) -->
    <svg v-if="badness.level === 3" viewBox="0 0 16 16" width="13" height="13" role="img" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-width="1.3" />
      <path d="M3.9 3.9 12.1 12.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </svg>
    <!-- low confidence / caveat: warning triangle -->
    <svg v-else viewBox="0 0 16 16" width="13" height="13" role="img" aria-hidden="true">
      <path d="M8 1.2 15 14H1L8 1.2Z" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
      <rect x="7.25" y="6" width="1.5" height="4" rx="0.75" fill="currentColor" />
      <circle cx="8" cy="11.6" r="0.9" fill="currentColor" />
    </svg>
  </button>
</template>

<style scoped>
.dc-icon {
  display: inline-flex;
  align-items: center;
  margin-left: 0.35em;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  vertical-align: middle;
}
.dc-icon--l3 { color: #dc2626; }
.dc-icon--l3:hover { color: #b91c1c; }
.dc-icon--l2 { color: #d97706; }
.dc-icon--l2:hover { color: #b45309; }
.dc-icon--l1 { color: #a16207; }
.dc-icon--l1:hover { color: #854d0e; }
.dc-icon:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; border-radius: 2px; }
</style>
