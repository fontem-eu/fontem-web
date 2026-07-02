<script setup>
/**
 * A small, clickable "modified" marker rendered next to a contract's
 * value when that contract is a modification carrying a before→after
 * change (value_before_eur present). Clicking emits `click` so the
 * parent can open the modification modal. Violet to stay distinct from
 * the amber/red DataQualityBadge next to it.
 */
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
defineEmits(['click'])
</script>

<template>
  <button
    type="button"
    class="errata-icon"
    :title="t('errata.icon_title')"
    :aria-label="t('errata.icon_title')"
    data-testid="errata-icon"
    @click.stop="$emit('click')"
  >
    <!-- A pencil (edit/modified) glyph. Inline SVG for portability. -->
    <svg viewBox="0 0 16 16" width="13" height="13" role="img" aria-hidden="true">
      <path
        d="M10.8 2.1a1.2 1.2 0 0 1 1.7 0l1.4 1.4a1.2 1.2 0 0 1 0 1.7l-7.5 7.5-3.4.9.9-3.4 7.5-7.5z"
        fill="currentColor"
        fill-opacity="0.18"
        stroke="currentColor"
        stroke-width="1.1"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</template>

<style scoped>
.errata-icon {
  display: inline-flex;
  align-items: center;
  margin-left: 0.35em;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: #7c3aed;
  vertical-align: middle;
}
.errata-icon:hover { color: #6d28d9; }
.errata-icon:focus-visible { outline: 2px solid #7c3aed; outline-offset: 1px; border-radius: 2px; }
</style>
