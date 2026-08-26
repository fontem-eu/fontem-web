<script setup>
/**
 * A NUTS region typeahead.
 *
 * Replaces four cascading <select>s (NutsRegionPicker) for the case where the
 * user already knows what they are looking for. Four selects make you walk the
 * hierarchy — country, then region, then sub-region — which is fine for
 * browsing and tedious when you just want to type "Coimbra".
 *
 * Three things it does that are easy to get wrong:
 *
 * EUROPE IS A REAL OPTION, not an empty value. "All of it" is a choice
 * somebody makes deliberately, and an empty input that silently means
 * everywhere is indistinguishable from an input nobody filled in.
 *
 * MATCHES ARE RANKED, not merely filtered. A search for "port" should offer
 * Portugal before Porto and before Alto Alentejo — so prefix matches on name
 * sort above code matches, which sort above anything containing the term.
 *
 * IT IS A REAL COMBOBOX. Arrow keys move, Enter selects, Escape closes,
 * aria-activedescendant tells a screen reader which option is current. A
 * typeahead that only works with a mouse is a worse select box.
 */
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNutsRegions } from '../composables/useNutsRegions.js'

const props = defineProps({
  /** A NUTS code, or 'EU' for everywhere. Empty means nothing chosen yet. */
  modelValue: { type: String, default: '' },
  /** Deepest level offered. 0 = countries only. */
  maxLevel: { type: Number, default: 3 },
  /** Show the "Europe — all regions" option. */
  allowEverywhere: { type: Boolean, default: true },
  placeholder: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()
const { regions, load } = useNutsRegions()

const EVERYWHERE = 'EU'
const MAX_SUGGESTIONS = 40

const query = ref('')
const open = ref(false)
const active = ref(0)
const inputEl = ref(null)
const listId = `nuts-list-${Math.random().toString(36).slice(2, 9)}`

const everywhereOption = computed(() => ({
  code: EVERYWHERE, name: t('region_input.everywhere'), level: -1,
  hint: t('region_input.everywhere_hint'),
}))

const byCode = computed(() => {
  const out = new Map()
  for (const r of regions.value) out.set(r.code, r)
  return out
})

/** "Norte" is ambiguous; "Norte · Portugal" is not. NUTS codes nest by
 *  prefix, so the ancestors are derivable without another lookup. */
function hintFor(region) {
  if (region.level <= 0) return ''
  const parents = []
  for (let len = region.code.length - 1; len >= 2; len -= 1) {
    const parent = byCode.value.get(region.code.slice(0, len))
    if (parent) parents.unshift(parent.name)
  }
  return parents.join(' · ')
}

const selected = computed(() => {
  if (!props.modelValue) return null
  if (props.modelValue === EVERYWHERE) return everywhereOption.value
  const found = byCode.value.get(props.modelValue)
  return found ? { ...found, hint: hintFor(found) } : null
})

const candidates = computed(
  () => regions.value.filter((r) => r.level <= props.maxLevel),
)

// Match strength, lowest wins: a name that starts with what you typed beats
// a code that does, which beats a name that merely contains it. -1 means no
// match at all. Split out of `suggestions` because the ranking is the part
// worth reading on its own — and it kept that computed over the cognitive
// complexity limit.
function rankOf(region, term) {
  const name = region.name.toLowerCase()
  if (name.startsWith(term)) return 0
  if (region.code.toLowerCase().startsWith(term)) return 1
  if (name.includes(term)) return 2
  return -1
}

// Shallower regions first within a rank: typing "PT" more likely means
// Portugal than one of its municipalities.
function byRankThenDepth(a, b) {
  return a.rank - b.rank
    || a.region.level - b.region.level
    || a.region.name.localeCompare(b.region.name)
}

function everywhereMatches(term) {
  return !term
    || everywhereOption.value.name.toLowerCase().includes(term)
    || EVERYWHERE.toLowerCase().startsWith(term)
}

const suggestions = computed(() => {
  const term = query.value.trim().toLowerCase()
  const out = []

  if (props.allowEverywhere && everywhereMatches(term)) {
    out.push(everywhereOption.value)
  }
  if (!term) {
    // No term yet: offer countries, which is the useful starting point.
    const countries = candidates.value.filter((r) => r.level === 0)
    for (const r of countries.slice(0, MAX_SUGGESTIONS)) {
      out.push({ ...r, hint: '' })
    }
    return out.slice(0, MAX_SUGGESTIONS)
  }

  const scored = candidates.value
    .map((region) => ({ region, rank: rankOf(region, term) }))
    .filter(({ rank }) => rank >= 0)
    .sort(byRankThenDepth)

  for (const { region } of scored.slice(0, MAX_SUGGESTIONS)) {
    out.push({ ...region, hint: hintFor(region) })
  }
  return out
})

onMounted(load)

watch(() => props.modelValue, () => { if (!open.value) query.value = '' })
watch(suggestions, () => { active.value = 0 })

function show() {
  open.value = true
  active.value = 0
}

function choose(region) {
  emit('update:modelValue', region.code)
  query.value = ''
  open.value = false
}

function clear() {
  emit('update:modelValue', '')
  query.value = ''
  open.value = false
  nextTick(() => inputEl.value?.focus())
}

function onKeydown(event) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!open.value) return show()
    const step = event.key === 'ArrowDown' ? 1 : -1
    const count = suggestions.value.length
    if (count) active.value = (active.value + step + count) % count
    return undefined
  }
  if (event.key === 'Enter' && open.value && suggestions.value[active.value]) {
    event.preventDefault()
    return choose(suggestions.value[active.value])
  }
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    open.value = false
  }
  return undefined
}

function onBlur() {
  // Deferred so a click on an option lands before the list unmounts.
  setTimeout(() => { open.value = false }, 120)
}
</script>

<template>
  <div class="nri">
    <div v-if="selected" class="nri-selected" data-testid="region-selected">
      <span class="nri-selected-name">{{ selected.name }}</span>
      <span v-if="selected.hint" class="nri-selected-hint">{{ selected.hint }}</span>
      <button
        type="button" class="nri-clear" data-testid="region-clear"
        :aria-label="$t('region_input.clear')" @click="clear"
      >×</button>
    </div>

    <template v-else>
      <input
        ref="inputEl"
        v-model="query"
        type="text"
        class="nri-input"
        role="combobox"
        autocomplete="off"
        data-testid="region-input"
        :aria-expanded="open"
        :aria-controls="listId"
        :aria-activedescendant="open && suggestions[active] ? `${listId}-${active}` : undefined"
        :placeholder="placeholder || $t('region_input.placeholder')"
        @focus="show"
        @input="show"
        @keydown="onKeydown"
        @blur="onBlur"
      />

      <ul
v-if="open && suggestions.length" :id="listId" class="nri-list"
          role="listbox" data-testid="region-suggestions">
        <li
          v-for="(region, i) in suggestions" :id="`${listId}-${i}`" :key="region.code"
          class="nri-option" :class="{ 'is-active': i === active }"
          role="option" :aria-selected="i === active"
          :data-testid="`region-option-${region.code}`"
          @mousedown.prevent="choose(region)"
          @mouseenter="active = i"
        >
          <span class="nri-option-name">{{ region.name }}</span>
          <span v-if="region.hint" class="nri-option-hint">{{ region.hint }}</span>
          <code v-if="region.level >= 0" class="nri-option-code">{{ region.code }}</code>
        </li>
      </ul>

      <p v-else-if="open && query.trim()" class="nri-empty" data-testid="region-no-match">
        {{ $t('region_input.no_match', { term: query.trim() }) }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.nri { position: relative; }
.nri-input { width: 100%; font: inherit; font-size: 0.9rem; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.45rem 0.6rem; }
.nri-input:focus { outline: none; border-color: var(--accent); }
.nri-selected { display: flex; align-items: center; gap: 0.5rem; border: 1px solid var(--accent); border-radius: 8px; padding: 0.4rem 0.5rem 0.4rem 0.6rem; background: color-mix(in srgb, var(--accent) 8%, transparent); }
.nri-selected-name { font-size: 0.9rem; font-weight: 600; }
.nri-selected-hint { font-size: 0.75rem; color: var(--muted); flex: 1; }
.nri-clear { margin-left: auto; font: inherit; font-size: 1rem; line-height: 1; border: none; background: none; color: var(--muted); cursor: pointer; padding: 0 0.2rem; }
.nri-clear:hover { color: var(--text); }
.nri-list { position: absolute; z-index: 60; left: 0; right: 0; top: calc(100% + 4px); max-height: 17rem; overflow-y: auto; list-style: none; margin: 0; padding: 0.25rem; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 28px rgba(0,0,0,0.18); }
.nri-option { display: flex; align-items: baseline; gap: 0.5rem; padding: 0.4rem 0.5rem; border-radius: 7px; cursor: pointer; }
.nri-option.is-active { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.nri-option-name { font-size: 0.88rem; }
.nri-option-hint { font-size: 0.72rem; color: var(--muted); flex: 1; }
.nri-option-code { font-size: 0.7rem; color: var(--muted); margin-left: auto; }
.nri-empty { position: absolute; z-index: 60; left: 0; right: 0; top: calc(100% + 4px); margin: 0; padding: 0.6rem; font-size: 0.85rem; color: var(--muted); background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
</style>
