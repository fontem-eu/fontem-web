<script setup>
/**
 * Explains why a contract value is distrusted or was withheld — the
 * value-side sibling of the red-flags integrity panel. Driven by the
 * badness descriptor from contractValueBadness().
 */
import { useI18n } from 'vue-i18n'

defineProps({
  visible: { type: Boolean, default: false },
  contract: { type: Object, default: null },
  badness: { type: Object, default: null },
})
const emit = defineEmits(['close'])
const { t } = useI18n()

function onBackdrop(e) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible && contract && badness"
      class="dcm-backdrop"
      data-testid="confidence-backdrop"
      @click="onBackdrop"
    >
      <div class="dcm-modal">
        <header class="dcm-header">
          <h2>{{ t('data_quality.modal_title') }}</h2>
          <button class="dcm-close" :aria-label="t('errata.close')" @click="emit('close')">&times;</button>
        </header>
        <p class="dcm-title">{{ contract.title || contract.ted_notice_id }}</p>

        <span class="dcm-level" :class="`dcm-level--l${badness.level}`" data-testid="confidence-level">
          {{ t(badness.levelKey) }}
        </span>

        <p class="dcm-explain">{{ t(badness.explanationKey) }}</p>

        <table class="dcm-table">
          <tbody>
            <tr v-if="badness.reason">
              <th>{{ t('data_quality.detail_reason') }}</th>
              <td><code>{{ badness.reason }}</code></td>
            </tr>
            <tr v-if="badness.confidence != null">
              <th>{{ t('data_quality.detail_confidence') }}</th>
              <td>{{ Math.round(badness.confidence * 100) }} / 100</td>
            </tr>
            <tr v-if="badness.statusKey">
              <th>{{ t('data_quality.detail_status') }}</th>
              <td>{{ t(badness.statusKey) }}</td>
            </tr>
          </tbody>
        </table>

        <p v-if="badness.level === 3" class="dcm-audit">{{ t('data_quality.withheld_audit_note') }}</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dcm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dcm-modal {
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
.dcm-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
.dcm-header h2 { font-size: 1.15rem; font-weight: 700; margin: 0; }
.dcm-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--muted); line-height: 1; }
.dcm-title { font-weight: 600; margin: 0 0 0.75rem; }
.dcm-level {
  display: inline-block; padding: 0.15rem 0.6rem; border-radius: 999px;
  font-size: 0.8rem; font-weight: 700; margin-bottom: 0.75rem;
}
.dcm-level--l3 { background: #b91c1c; color: #fff; }
.dcm-level--l2 { background: #92400e; color: #fff; }
.dcm-level--l1 { background: #713f12; color: #fff; }
.dcm-explain { font-size: 0.92rem; line-height: 1.5; margin: 0 0 1rem; }
.dcm-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.dcm-table th, .dcm-table td { text-align: left; padding: 0.4rem 0.55rem; border-bottom: 1px solid var(--border); }
.dcm-table th { color: var(--muted); font-weight: 600; width: 40%; }
.dcm-audit { margin-top: 1rem; font-size: 0.82rem; color: var(--muted); }
</style>
