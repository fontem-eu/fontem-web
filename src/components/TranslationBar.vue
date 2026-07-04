<script setup>
/**
 * Language picker for the story page. One compact control — the
 * universally-recognised translate glyph + a select listing the original
 * and every available translation — instead of a chip per language.
 * The active translation's potentially-outdated state shows as a yellow
 * badge: the original moved after the translation was written, so the
 * reader should know the two texts may have drifted.
 */
import { computed } from 'vue'
import { EU_LANGUAGES } from '../composables/eu-languages.js'

const props = defineProps({
  language: { type: String, default: 'en' }, // the original's language
  translations: { type: Array, default: () => [] }, // [{lang, outdated}]
  current: { type: String, default: '' }, // '' = original
})
const emit = defineEmits(['switch'])

const label = (code) => EU_LANGUAGES.find((l) => l.code === code)?.label || code
const active = computed(() => props.translations.find((t) => t.lang === props.current) || null)
</script>

<template>
  <div v-if="translations.length" class="tbar" data-testid="translation-bar">
    <span class="tbar-icon" aria-hidden="true">
      <!-- Material Symbols "translate" — the conventional glyph for
           language switching, so readers recognise the control. -->
      <svg viewBox="0 -960 960 960" width="18" height="18" fill="currentColor">
        <path d="m476-80 182-480h84L924-80h-84l-43-117H603L560-80h-84ZM160-200l-56-56 202-202q-35-35-63.5-80T190-640h84q20 39 40 68t48 58q33-33 68.5-92.5T484-720H40v-80h280v-80h80v80h280v80H564q-21 72-63 148t-83 116l96 98-30 82-122-125-202 201Zm468-72h144l-72-204-72 204Z" />
      </svg>
    </span>
    <select
      class="tbar-select" :value="current" data-testid="translation-picker"
      :aria-label="$t('translations.label')"
      @change="emit('switch', $event.target.value)"
    >
      <option value="">{{ label(language) }} · {{ $t('translations.original') }}</option>
      <option v-for="t in translations" :key="t.lang" :value="t.lang">
        {{ label(t.lang) }}{{ t.outdated ? ' ⚠' : '' }}
      </option>
    </select>

    <span
      v-if="active && active.outdated"
      class="tbar-outdated" data-testid="translation-outdated-badge"
      :title="$t('translations.outdated')"
    >⚠ {{ $t('translations.outdated_short') }}</span>
  </div>
</template>

<style scoped>
.tbar { display: flex; align-items: center; flex-wrap: wrap; gap: 0.45rem; margin: 0.6rem 0; }
.tbar-icon { display: inline-flex; align-items: center; color: var(--muted); }
.tbar-select { padding: 0.3rem 0.55rem; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 0.85rem; max-width: 16rem; }
/* the yellow label: readable on both themes (dark amber text on pale amber) */
.tbar-outdated { background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; border-radius: 6px; padding: 0.15rem 0.55rem; font-size: 0.75rem; font-weight: 600; }
:global(html.dark) .tbar-outdated { background: #451a03; color: #fbbf24; border-color: #b45309; }
</style>
