<script setup>
/**
 * Shows what a contract modification (errata) changed: a before→after
 * table of the affected fields. Legacy TED F20 modifications self-contain
 * the value change (value_before → value); that's the one field we track
 * today, but the table is field-generic so more can be added later.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { fmtDual } from '../utils/format.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  contract: { type: Object, default: null },
})
const emit = defineEmits(['close'])
const { t } = useI18n()

function pctChange(before, after) {
  if (before == null || after == null || before === 0) return null
  return Math.round(((after - before) / before) * 100)
}

// One row per changed field. Value is the only field a legacy F20
// modification carries a before/after for; guard on a real before-value.
const rows = computed(() => {
  const c = props.contract
  if (!c || c.value_before_eur == null) return []
  return [{
    field: t('errata.value'),
    before: fmtDual(c.value_before_original, c.value_currency, c.value_before_eur),
    after: fmtDual(c.value_original, c.value_currency, c.value_eur),
    pct: pctChange(c.value_before_eur, c.value_eur),
  }]
})

const modifiesUrl = computed(() =>
  props.contract?.modifies_publication_number
    ? `https://ted.europa.eu/en/notice/-/detail/${props.contract.modifies_publication_number}`
    : null,
)

function onBackdrop(e) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible && contract"
      class="em-backdrop"
      data-testid="errata-backdrop"
      @click="onBackdrop"
    >
      <div class="em-modal">
        <header class="em-header">
          <h2>{{ t('errata.modal_title') }}</h2>
          <button class="em-close" :aria-label="t('errata.close')" @click="emit('close')">&times;</button>
        </header>

        <p v-if="contract.title" class="em-title">{{ contract.title }}</p>
        <p class="em-subtitle">{{ t('errata.subtitle') }}</p>

        <table v-if="rows.length" class="em-table" data-testid="errata-table">
          <thead>
            <tr>
              <th>{{ t('errata.field') }}</th>
              <th>{{ t('errata.previous') }}</th>
              <th>{{ t('errata.new') }}</th>
              <th>{{ t('errata.change') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.field">
              <td>{{ r.field }}</td>
              <td class="em-before">{{ r.before }}</td>
              <td class="em-after">{{ r.after }}</td>
              <td
                v-if="r.pct != null"
                class="em-pct"
                :class="r.pct >= 0 ? 'em-up' : 'em-down'"
              >{{ r.pct >= 0 ? '+' : '' }}{{ r.pct }}%</td>
              <td v-else>—</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="em-none">{{ t('errata.none') }}</p>

        <p v-if="modifiesUrl" class="em-modifies">
          {{ t('errata.modifies') }}:
          <a :href="modifiesUrl" target="_blank" rel="noopener" data-testid="errata-modifies-link">
            {{ contract.modifies_publication_number }}
          </a>
        </p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.em-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.em-modal {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  width: 100%;
  max-width: 520px;
  max-height: 85vh;
  overflow-y: auto;
  color: var(--text);
}
.em-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}
.em-header h2 { font-size: 1.15rem; font-weight: 700; margin: 0; }
.em-close {
  background: none; border: none; font-size: 1.5rem;
  cursor: pointer; color: var(--muted); line-height: 1;
}
.em-title { font-weight: 600; margin: 0 0 0.15rem; }
.em-subtitle { color: var(--muted); font-size: 0.85rem; margin: 0 0 1rem; }
.em-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.em-table th, .em-table td {
  text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--border);
}
.em-table th { color: var(--muted); font-weight: 600; }
.em-before { color: var(--muted); }
.em-after { font-weight: 600; }
.em-pct { font-weight: 600; }
.em-up { color: #dc2626; }
.em-down { color: #16a34a; }
.em-none { color: var(--muted); font-size: 0.9rem; }
.em-modifies { margin-top: 1rem; font-size: 0.85rem; color: var(--muted); }
.em-modifies a { color: var(--accent, #0969da); }
</style>
