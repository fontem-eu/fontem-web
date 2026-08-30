<script setup>
/**
 * The article's history: what changed, when, by whom — and the way back.
 *
 * Reading a revision list is how an author finds out that an edit they
 * did not make is now the published text. Restoring never rewrites the
 * chain: it writes the old content as a new revision on top, so the
 * thing you restored from is still there afterwards.
 */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { listRevisions, diffRevisions, restoreRevision } from '../api/community.js'

const props = defineProps({
  reportId: { type: String, required: true },
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['restored', 'close'])
const { t } = useI18n()

const revisions = ref([])
const selected = ref('')
const operations = ref([])
const loading = ref(false)
const busy = ref(false)
const error = ref('')

async function loadHistory() {
  loading.value = true
  error.value = ''
  try {
    revisions.value = await listRevisions(props.reportId)
    if (revisions.value.length) await select(revisions.value[0].id)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

/** Show what one revision changed against the one before it. */
async function select(revisionId) {
  selected.value = revisionId
  operations.value = []
  try {
    const body = await diffRevisions(props.reportId, null, revisionId)
    operations.value = body.operations || []
  } catch (err) {
    error.value = err.message
  }
}

async function restore(revisionId) {
  busy.value = true
  error.value = ''
  try {
    const result = await restoreRevision(props.reportId, revisionId)
    emit('restored', result.revision)
    await loadHistory()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

/** "3 added · 1 changed" — nothing when a save changed nothing. */
function summarise(changes) {
  const parts = []
  if (changes?.added) parts.push(t('history.n_added', { n: changes.added }))
  if (changes?.changed) parts.push(t('history.n_changed', { n: changes.changed }))
  if (changes?.removed) parts.push(t('history.n_removed', { n: changes.removed }))
  return parts.join(' · ')
}

function when(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
}

watch(() => props.open, (isOpen) => { if (isOpen) loadHistory() }, { immediate: true })
</script>

<template>
  <section v-if="open" class="history" data-testid="revision-history">
    <header class="history-head">
      <h3>{{ $t('history.title') }}</h3>
      <button
        type="button"
        class="history-close"
        data-testid="history-close"
        @click="emit('close')"
      >{{ $t('app.close') }}</button>
    </header>

    <p v-if="error" class="history-error" data-testid="history-error">{{ error }}</p>
    <p v-else-if="loading" class="history-empty">{{ $t('history.loading') }}</p>
    <p
      v-else-if="!revisions.length"
      class="history-empty"
      data-testid="history-empty"
    >{{ $t('history.no_revisions') }}</p>

    <div v-else class="history-body">
      <ul class="history-list">
        <li
          v-for="r in revisions"
          :key="r.id"
          class="history-row"
          :class="{ 'history-row--active': r.id === selected }"
          data-testid="history-row"
        >
          <button
            type="button"
            class="history-pick"
            data-testid="history-pick"
            @click="select(r.id)"
          >
            <span class="history-when">{{ when(r.created_at) }}</span>
            <span class="history-changes">{{ summarise(r.changes) || $t('history.no_change') }}</span>
            <!-- Whose edit this was. An assistant commit is a commit you
                 can see and drop, not an invisible change. -->
            <span
              v-if="r.author_kind === 'assistant'"
              class="history-badge"
              data-testid="history-assistant"
            >{{ $t('history.by_assistant') }}</span>
          </button>
          <button
            type="button"
            class="history-restore"
            :disabled="busy"
            data-testid="history-restore"
            @click="restore(r.id)"
          >{{ $t('history.restore') }}</button>
        </li>
      </ul>

      <div class="history-diff" data-testid="history-diff">
        <p
          v-if="!operations.length"
          class="history-empty"
        >{{ $t('history.no_change') }}</p>
        <template v-else>
          <div
            v-for="(op, i) in operations"
            :key="i"
            class="diff-block"
            :class="`diff-block--${op.op}`"
            :data-op="op.op"
            data-testid="diff-block"
          >
            <template v-if="op.op === 'replace'">
              <p class="diff-line diff-line--del">{{ op.before.text || op.before.label }}</p>
              <p class="diff-line diff-line--add">{{ op.after.text || op.after.label }}</p>
            </template>
            <p
              v-else
              class="diff-line"
              :class="{
                'diff-line--add': op.op === 'insert',
                'diff-line--del': op.op === 'delete',
              }"
            >{{ (op.after || op.before).text || (op.after || op.before).label }}</p>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.history {
  border: 1px solid var(--border, #ddd);
  border-radius: 6px;
  margin-bottom: 1rem;
  background: var(--surface, #fff);
}
.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.85rem;
  border-bottom: 1px solid var(--border, #ddd);
}
.history-head h3 { margin: 0; font-size: 0.9rem; }
.history-close {
  border: none;
  background: none;
  color: var(--muted, #666);
  font-size: 0.8rem;
  cursor: pointer;
}
.history-error { margin: 0; padding: 0.75rem 0.85rem; color: #991b1b; font-size: 0.82rem; }
.history-empty { margin: 0; padding: 0.75rem 0.85rem; color: var(--muted, #666); font-size: 0.82rem; }

.history-body { display: grid; grid-template-columns: minmax(12rem, 18rem) 1fr; }
@media (max-width: 768px) {
  .history-body { grid-template-columns: 1fr; }
}

.history-list {
  margin: 0;
  padding: 0.35rem;
  list-style: none;
  max-height: 22rem;
  overflow-y: auto;
  border-right: 1px solid var(--border, #ddd);
}
.history-row { display: flex; align-items: center; gap: 0.25rem; border-radius: 4px; }
.history-row--active { background: var(--bezel, rgb(0 0 0 / 5%)); }
.history-pick {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.45rem 0.55rem;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  color: inherit;
}
.history-when { font-size: 0.78rem; }
.history-changes { font-size: 0.72rem; color: var(--muted, #666); }
.history-badge {
  align-self: flex-start;
  font-size: 0.66rem;
  padding: 0 0.3rem;
  border: 1px solid var(--border, #ddd);
  border-radius: 3px;
  color: var(--muted, #666);
}
.history-restore {
  flex-shrink: 0;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--border, #ddd);
  border-radius: 4px;
  background: none;
  font-size: 0.72rem;
  cursor: pointer;
}

.history-diff { padding: 0.5rem 0.75rem; max-height: 22rem; overflow-y: auto; }
.diff-block { margin-bottom: 0.35rem; }
.diff-line {
  margin: 0;
  padding: 0.2rem 0.45rem;
  font-size: 0.8rem;
  border-radius: 3px;
  white-space: pre-wrap;
}
.diff-line--add { background: #e6f3ea; color: #1c6640; }
.diff-line--del { background: #fae9e9; color: #94292a; text-decoration: line-through; }
.diff-block--equal .diff-line { color: var(--muted, #666); }
</style>
