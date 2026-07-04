<script setup>
/**
 * Language switcher for the story page. Renders one chip per available
 * language (the original + every translation); the active translation's
 * potentially-outdated state shows as a yellow badge — the original moved
 * after the translation was written, so the reader should know the two
 * texts may have drifted.
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
    <button
      class="tbar-chip" :class="{ 'tbar-chip--on': !current }"
      data-testid="translation-original" @click="emit('switch', '')"
    >{{ label(language) }} · {{ $t('translations.original') }}</button>
    <button
      v-for="t in translations" :key="t.lang"
      class="tbar-chip" :class="{ 'tbar-chip--on': current === t.lang }"
      :data-testid="'translation-chip-' + t.lang" @click="emit('switch', t.lang)"
    >{{ label(t.lang) }}<span v-if="t.outdated" class="tbar-dot" :title="$t('translations.outdated')">●</span></button>

    <span
      v-if="active && active.outdated"
      class="tbar-outdated" data-testid="translation-outdated-badge"
      :title="$t('translations.outdated')"
    >⚠ {{ $t('translations.outdated_short') }}</span>
  </div>
</template>

<style scoped>
.tbar { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; margin: 0.6rem 0; }
.tbar-chip { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 9999px; padding: 0.2rem 0.7rem; font-size: 0.8rem; cursor: pointer; }
.tbar-chip--on { border-color: var(--accent); color: var(--accent); font-weight: 600; }
.tbar-dot { color: #d97706; margin-left: 0.3rem; font-size: 0.6rem; vertical-align: middle; }
/* the yellow label: readable on both themes (dark amber text on pale amber) */
.tbar-outdated { background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; border-radius: 6px; padding: 0.15rem 0.55rem; font-size: 0.75rem; font-weight: 600; }
:global(html.dark) .tbar-outdated { background: #451a03; color: #fbbf24; border-color: #b45309; }
</style>
