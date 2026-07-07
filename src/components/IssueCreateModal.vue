<script setup>
import { ref, watch } from 'vue'
import { createIssue } from '../api/community.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  entityType: { type: String, default: '' },
  entityId: { type: String, default: '' },
})

const emit = defineEmits(['close', 'created'])

const title = ref('')
const body = ref('')
const issueType = ref('incorrect_data')
const formEntityType = ref('')
const formEntityId = ref('')
const submitting = ref(false)
const error = ref(null)

const issueTypes = [
  'incorrect_data',
  'duplicate_entity',
  'missing_connection',
  'missing_entity',
  'other',
]

watch(() => props.visible, (v) => {
  if (v) {
    title.value = ''
    body.value = ''
    issueType.value = 'incorrect_data'
    formEntityType.value = props.entityType || ''
    formEntityId.value = props.entityId || ''
    error.value = null
  }
})

async function submit() {
  if (!title.value.trim()) {
    error.value = 'Title is required.'
    return
  }
  submitting.value = true
  error.value = null
  try {
    const issue = await createIssue({
      title: title.value.trim(),
      body: body.value,
      issue_type: issueType.value,
      entity_type: formEntityType.value || undefined,
      entity_id: formEntityId.value || undefined,
    })
    emit('created', issue)
    emit('close')
  } catch (err) {
    error.value = err.message
  } finally {
    submitting.value = false
  }
}

function close() {
  emit('close')
}

function onBackdrop(e) {
  if (e.target === e.currentTarget) close()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="icm-backdrop" data-testid="issue-create-backdrop" @click="onBackdrop">
      <div class="icm-modal" data-testid="issue-create-modal">
        <div class="icm-header">
          <h2>{{ $t('app.raise_an_issue') }}</h2>
          <button class="icm-close" data-testid="issue-create-close" @click="close">&times;</button>
        </div>

        <p v-if="error" class="icm-error" data-testid="issue-create-error">{{ error }}</p>

        <div class="icm-field">
          <label class="icm-label" for="icm-title">{{ $t('issue_create.title') }}</label>
          <input
            id="icm-title"
            v-model="title"
            type="text"
            class="icm-input"
            data-testid="issue-create-title"
            :placeholder="$t('issue_create.brief_summary_of_the_issue')"
          />
        </div>

        <div class="icm-field">
          <label class="icm-label" for="icm-type">{{ $t('issue_create.issue_type') }}</label>
          <select id="icm-type" v-model="issueType" class="icm-select" data-testid="issue-create-type">
            <option v-for="t in issueTypes" :key="t" :value="t">{{ t.replace(/_/g, ' ') }}</option>
          </select>
        </div>

        <div class="icm-row">
          <div class="icm-field icm-half">
            <label class="icm-label" for="icm-entity-type">{{ $t('app.entity_type') }}</label>
            <input
              id="icm-entity-type"
              v-model="formEntityType"
              type="text"
              class="icm-input"
              data-testid="issue-create-entity-type"
              :placeholder="$t('issue_create_modal.eg_company')"
            />
          </div>
          <div class="icm-field icm-half">
            <label class="icm-label" for="icm-entity-id">{{ $t('issue_create.entity_id') }}</label>
            <input
              id="icm-entity-id"
              v-model="formEntityId"
              type="text"
              class="icm-input"
              data-testid="issue-create-entity-id"
              :placeholder="$t('issue_create_modal.eg_gmr_id_or_ticker')"
            />
          </div>
        </div>

        <div class="icm-field">
          <label class="icm-label" for="icm-body">{{ $t('app.description') }}</label>
          <textarea
            id="icm-body"
            v-model="body"
            class="icm-textarea"
            data-testid="issue-create-body"
            rows="5"
            :placeholder="$t('issue_create.describe_the_issue_in_detail_markdown_su')"
          />
        </div>

        <div class="icm-actions">
          <button class="icm-cancel" @click="close">{{ $t('app.cancel') }}</button>
          <button
            class="icm-submit"
            data-testid="issue-create-submit"
            :disabled="submitting"
            @click="submit"
          >
            {{ submitting ? $t('app.submitting') : $t('app.submit_issue') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.icm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.icm-modal {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  overflow-y: auto;
  color: var(--text);
}
.icm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.icm-header h2 {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0;
}
.icm-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--muted);
  line-height: 1;
}
.icm-error {
  color: #dc2626;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}
.icm-field {
  margin-bottom: 0.85rem;
}
.icm-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 0.25rem;
}
.icm-input,
.icm-select,
.icm-textarea {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
  font-family: inherit;
  box-sizing: border-box;
}
.icm-textarea {
  resize: vertical;
}
.icm-row {
  display: flex;
  gap: 0.75rem;
}
.icm-half {
  flex: 1;
}
.icm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.icm-cancel {
  padding: 0.45rem 0.85rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 0.85rem;
  cursor: pointer;
}
.icm-submit {
  padding: 0.45rem 0.85rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
}
.icm-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
