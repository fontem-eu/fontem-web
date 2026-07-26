<script setup>
/**
 * Story region picker — a single <select> of NUTS-0 countries.
 *
 * A data story's region is a whole country (or the default: the entire
 * European Union). The first option ("European Union", value "") is the
 * default — an empty nuts_region means "no single country, the whole EU".
 * The remaining options are the NUTS-0 countries (level 0) fetched from
 * /api/geo/nuts-regions, listed by name.
 *
 * v-model is a single string: "" for the EU, or a 2-letter country code.
 *
 * Migration: older stories may carry a DEEP NUTS code (e.g. "PT170").
 * Since a story is now pinned to a country, we collapse any incoming code
 * to its 2-letter country prefix — the deep code selects its country, and
 * we emit the collapsed code so the next save rewrites it (rather than
 * blanking the region or silently keeping a stale deep code).
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchNutsRegions } from '../api/geo.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()

// NUTS codes are hierarchical by prefix; a country is the first 2 chars.
function toCountry(code) {
  return code ? code.slice(0, 2) : ''
}

const countries = ref([])

// The <select> reflects the country prefix of whatever is stored, so a
// legacy deep code ("PT170") shows its country ("Portugal") selected.
const selected = computed(() => toCountry(props.modelValue))

// If the stored value is a deep code, emit the collapsed country so the
// next save persists the country instead of the stale deep code.
watch(
  () => props.modelValue,
  (v) => {
    const c = toCountry(v)
    if (c !== (v || '')) emit('update:modelValue', c)
  },
  { immediate: true },
)

function onChange(event) {
  emit('update:modelValue', event.target.value)
}

onMounted(async () => {
  try {
    const data = await fetchNutsRegions()
    countries.value = (data?.regions || [])
      .filter((r) => r.level === 0)
      .map((r) => ({ code: r.nuts_code || r.code, name: r.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    /* degrade: only the European Union default option is shown */
  }
})
</script>

<template>
  <select
    class="country-region-select"
    data-testid="country-region-select"
    :value="selected"
    @change="onChange"
  >
    <option value="">{{ t('report_editor.region_eu') }}</option>
    <option v-for="c in countries" :key="c.code" :value="c.code">
      {{ c.name }}
    </option>
  </select>
</template>

<style scoped>
.country-region-select {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface, transparent);
  color: var(--text);
  width: 100%;
  font-size: 0.8rem;
}
</style>
