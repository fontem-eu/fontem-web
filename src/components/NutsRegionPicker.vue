<script setup>
/**
 * Cascading NUTS region picker — one <select> per level (0→3). Each deeper
 * level is enabled only once the level above is chosen and lists only the
 * children of that parent; changing a higher level resets the ones below.
 * Options show descriptive region NAMES, never codes.
 *
 * v-model is a single NUTS code (the deepest selected level, e.g. "PT170").
 * Fetches the region list itself from /api/geo/nuts-regions.
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchNutsRegions } from '../api/geo.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()

// A NUTS code is hierarchical by prefix (level L = L+2 chars), so the full
// selection array is reconstructable from a single code with no lookup.
function nutsFromCode(code) {
  const sel = ['', '', '', '']
  if (code) {
    for (let l = 0; l + 2 <= code.length && l <= 3; l += 1) sel[l] = code.slice(0, l + 2)
  }
  return sel
}

const allRegions = ref([])
const nutsSel = ref(nutsFromCode(props.modelValue))

watch(() => props.modelValue, (v) => { nutsSel.value = nutsFromCode(v || '') })

const byLevel = computed(() => {
  const m = [[], [], [], []]
  for (const r of allRegions.value) if (r.level >= 0 && r.level <= 3) m[r.level].push(r)
  return m
})

function regionOptions(level) {
  if (level === 0) return byLevel.value[0]
  const parent = nutsSel.value[level - 1]
  if (!parent) return []
  return byLevel.value[level].filter((r) => r.code.startsWith(parent))
}

function levelEnabled(level) {
  return level === 0 || Boolean(nutsSel.value[level - 1])
}

const activeCode = computed(() => {
  for (let l = 3; l >= 0; l -= 1) if (nutsSel.value[l]) return nutsSel.value[l]
  return ''
})

function onChange(level, code) {
  nutsSel.value[level] = code
  for (let l = level + 1; l <= 3; l += 1) nutsSel.value[l] = ''
  emit('update:modelValue', activeCode.value)
}

onMounted(async () => {
  try {
    const data = await fetchNutsRegions()
    allRegions.value = data?.regions || []
  } catch { /* picker degrades to codes-only if the list fails */ }
})
</script>

<template>
  <div class="nuts-picker" data-testid="nuts-picker">
    <select
      v-for="level in [0, 1, 2, 3]"
      :key="level"
      class="nuts-select"
      :data-testid="`nuts-l${level}`"
      :disabled="!levelEnabled(level)"
      :value="nutsSel[level]"
      @change="onChange(level, $event.target.value)"
    >
      <option value="">{{ t(`search.region_level.${level}`) }}</option>
      <option v-for="r in regionOptions(level)" :key="r.code" :value="r.code">
        {{ r.name }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.nuts-picker { display: flex; flex-direction: column; gap: 0.4rem; }
.nuts-select {
  padding: 0.4rem 0.5rem; border: 1px solid var(--border); border-radius: 6px;
  background: var(--surface, transparent); color: var(--text); width: 100%;
}
.nuts-select:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
