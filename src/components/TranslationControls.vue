<script setup>
/**
 * Editor-side translation controls: pick which text you are editing
 * (the original or one of the 24 language translations), see at a
 * glance which translations exist (✓) and which are potentially
 * outdated (⚠), and resolve an outdated flag after reviewing the
 * original's changes without retranslating.
 */
import { computed } from 'vue'
import { EU_LANGUAGES } from '../composables/eu-languages.js'

const props = defineProps({
  storyLanguage: { type: String, default: 'en' },
  translations: { type: Array, default: () => [] }, // [{lang, outdated}]
  current: { type: String, default: '' }, // '' = original
})
const emit = defineEmits(['switch', 'resolve'])

const byLang = computed(() => new Map(props.translations.map((t) => [t.lang, t])))
const mark = (code) => {
  const t = byLang.value.get(code)
  if (!t) return ''
  return t.outdated ? ' ⚠' : ' ✓'
}
// The original's own language doesn't need a translation entry.
const options = computed(() => EU_LANGUAGES.filter((l) => l.code !== props.storyLanguage))
const activeOutdated = computed(() => byLang.value.get(props.current)?.outdated === true)
</script>

<template>
  <span class="tctl">
    <select
      class="tctl-select" :value="current" data-testid="translation-select"
      :aria-label="$t('translations.label')"
      @change="emit('switch', $event.target.value)"
    >
      <option value="">{{ $t('translations.original') }} ({{ storyLanguage }})</option>
      <option v-for="l in options" :key="l.code" :value="l.code">{{ l.label }}{{ mark(l.code) }}</option>
    </select>
    <template v-if="current">
      <span
        v-if="activeOutdated" class="tctl-outdated"
        data-testid="translation-outdated-flag" :title="$t('translations.outdated')"
      >⚠ {{ $t('translations.outdated_short') }}</span>
      <button
        v-if="activeOutdated" class="tctl-resolve" data-testid="resolve-translation"
        :title="$t('translations.resolve')" @click="emit('resolve')"
      >{{ $t('translations.resolve') }}</button>
    </template>
  </span>
</template>

<style scoped>
.tctl { display: inline-flex; align-items: center; gap: 0.4rem; }
.tctl-select { padding: 0.35rem 0.5rem; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 0.85rem; }
.tctl-outdated { background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; border-radius: 6px; padding: 0.15rem 0.5rem; font-size: 0.72rem; font-weight: 600; white-space: nowrap; }
:global(html.dark) .tctl-outdated { background: #451a03; color: #fbbf24; border-color: #b45309; }
.tctl-resolve { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 6px; padding: 0.3rem 0.6rem; font-size: 0.78rem; cursor: pointer; }
.tctl-resolve:hover { border-color: var(--accent); color: var(--accent); }
</style>
