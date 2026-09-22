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
 * THE SERVER RANKS, not this component. /api/nuts/search matches across all
 * 24 languages — "Attica", "Attiki" and "Αττική" all reach EL3, "Lisbonne"
 * and "Lissabon" both reach PT1A0 — and returns which form matched, which
 * the rows show. That surface is public and other people call it, so having
 * a second ranking here meant two implementations of one behaviour and a
 * folding contract that had to agree character for character between Python
 * and JavaScript. One implementation, on the side that owns the data.
 *
 * TYPING IS NOT A REQUEST PER KEYSTROKE. Queries are debounced, and one
 * in flight is aborted the moment the next is typed, so the list can only
 * ever settle on the newest query — a slow response for "att" cannot land
 * after "attica" and overwrite it.
 *
 * IT IS A REAL COMBOBOX. Arrow keys move, Enter selects, Escape closes,
 * aria-activedescendant tells a screen reader which option is current. A
 * typeahead that only works with a mouse is a worse select box.
 */
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNutsRegions } from '../composables/useNutsRegions.js'
import { currentLang } from '../composables/useLang.js'
import { searchNutsRegions } from '../api/nuts.js'
import { foldText } from '../utils/foldText.js'

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
/** Long enough that a normal typing burst is one request, short enough that
 *  the list feels attached to the keyboard. */
const DEBOUNCE_MS = 140

const query = ref('')
const results = ref([])
const searching = ref(false)
let debounce = null
let inflight = null
const open = ref(false)
const active = ref(0)
const inputEl = ref(null)
// useId(), not Math.random(): this app server-renders (entry-server.js),
// and a random id differs between the server and client passes, so the
// aria-controls/aria-activedescendant wiring pointed at a different
// element on each and Vue reported a hydration mismatch. useId() is
// stable across both. It also drops the pseudorandom-generator warning
// SonarQube raised here (javascript:S2245).
const listId = `nuts-list-${useId()}`

const everywhereOption = computed(() => ({
  code: EVERYWHERE, name: t('region_input.everywhere'), level: -1,
  hint: t('region_input.everywhere_hint'),
}))

const byCode = computed(() => {
  const out = new Map()
  for (const r of regions.value) out.set(r.code, r)
  return out
})

/** The national-language name, when it is not already what we're showing.
 *  A reader on the English site scanning for Αττική should still recognise
 *  the row, and the native form is the one printed on official documents. */
function nativeAliasOf(region) {
  const native = region.name_native || ''
  if (!native || foldText(native) === foldText(region.name)) return ''
  return native
}

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
  return found ? { ...found, hint: hintFor(found), native: nativeAliasOf(found) } : null
})

const candidates = computed(
  () => regions.value.filter((r) => r.level <= props.maxLevel),
)

function everywhereMatches(term) {
  return !term
    || foldText(everywhereOption.value.name).includes(term)
    || EVERYWHERE.toLowerCase().startsWith(term)
}

/**
 * Ask the server for matches.
 *
 * Aborts whatever was in flight: only the newest query may produce a list,
 * so a slow response for "att" can never land after "attica" and replace it.
 * A failed search leaves the previous list rather than blanking it — the
 * next keystroke will ask again anyway.
 */
async function runSearch(term) {
  inflight?.abort()
  const controller = new AbortController()
  inflight = controller
  searching.value = true
  try {
    const data = await searchNutsRegions(term, {
      maxLevel: props.maxLevel, limit: MAX_SUGGESTIONS, signal: controller.signal,
    })
    if (controller === inflight) results.value = data?.matches || []
  } catch {
    // An abort is the normal case here, not a failure worth showing.
  } finally {
    if (controller === inflight) {
      inflight = null
      searching.value = false
    }
  }
}

watch(query, (value) => {
  const term = value.trim()
  clearTimeout(debounce)
  if (!term) {
    inflight?.abort()
    inflight = null
    results.value = []
    return
  }
  debounce = setTimeout(() => runSearch(term), DEBOUNCE_MS)
})

onBeforeUnmount(() => {
  clearTimeout(debounce)
  inflight?.abort()
})

const suggestions = computed(() => {
  const term = foldText(query.value)
  const out = []

  if (props.allowEverywhere && everywhereMatches(term)) {
    out.push(everywhereOption.value)
  }
  if (!term) {
    // No term yet: offer countries, which is the useful starting point.
    const countries = candidates.value.filter((r) => r.level === 0)
    for (const r of countries.slice(0, MAX_SUGGESTIONS)) {
      out.push({ ...r, hint: '', native: nativeAliasOf(r) })
    }
    return out.slice(0, MAX_SUGGESTIONS)
  }

  // Server order is the ranking — it knows the 24 languages and which form
  // matched. Everything added here is presentation: the ancestor chain, the
  // national-language name, and the form that matched when it is neither.
  for (const match of results.value.slice(0, MAX_SUGGESTIONS)) {
    const known = byCode.value.get(match.code)
    const region = { ...(known || {}), ...match }
    out.push({
      ...region,
      hint: hintFor(region),
      native: nativeAliasOf(region),
      matched: matchedAliasOf(match),
    })
  }
  return out
})

/**
 * The form that matched, when the row does not already show it.
 *
 * Someone typing "Lisbonne" on the English site gets a row reading "Lisbon
 * metropolitan area"; without this they have to take on trust that it is the
 * right region.
 */
function matchedAliasOf(match) {
  const matched = match.matched || ''
  if (!matched) return ''
  const shown = [match.name, match.name_native].map(foldText)
  return shown.includes(foldText(matched)) ? '' : matched
}

onMounted(load)

// Names are localised server-side, so a language switch needs a reload —
// otherwise the picker keeps offering the previous language's names.
watch(() => currentLang(), () => { load() })

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
      <span v-if="selected.native" class="nri-option-native">{{ selected.native }}</span>
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

      <!--
        SonarQube flags the listbox/option roles here (Web:S6819, Web:S6842)
        and wants a native <datalist> or <select>. Those rules do not model
        the ARIA 1.2 combobox pattern, which this implements in full: the
        input carries role=combobox with aria-expanded, aria-controls and
        aria-activedescendant, and each entry carries aria-selected. A
        <datalist> cannot render the name/hint/code layout, cannot be styled,
        and cannot be driven by asynchronously loaded suggestions — swapping
        to one would remove behaviour screen readers currently get.

        S6842 could be satisfied by moving the role onto an interactive
        element; S6819 could not, because it fires on role=listbox existing
        at all. Both are recorded as false positives in SonarQube against
        this justification rather than degrading the markup.
        NOSONAR
      -->
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
          <span v-if="region.native" class="nri-option-native">{{ region.native }}</span>
          <span
v-if="region.matched" class="nri-option-matched"
                :title="$t('region_input.matched_hint')">“{{ region.matched }}”</span>
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
.nri-option-native { font-size: 0.72rem; color: var(--text-2, var(--muted)); }
.nri-option-matched { font-size: 0.72rem; color: var(--muted); font-style: italic; }
.nri-option-hint { font-size: 0.72rem; color: var(--muted); flex: 1; }
.nri-option-code { font-size: 0.7rem; color: var(--muted); margin-left: auto; }
.nri-empty { position: absolute; z-index: 60; left: 0; right: 0; top: calc(100% + 4px); margin: 0; padding: 0.6rem; font-size: 0.85rem; color: var(--muted); background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
</style>
