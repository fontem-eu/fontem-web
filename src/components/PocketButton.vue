<script setup>
import { ref } from 'vue'
import { usePocket } from '../composables/usePocket.js'

const props = defineProps({
  widgetType: { type: String, required: true },
  config: { type: Object, required: true },
  defaultName: { type: String, default: '' },
})

const { save } = usePocket()
const showPrompt = ref(false)
const nameInput = ref('')
const saved = ref(false)

function open() {
  nameInput.value = props.defaultName
  showPrompt.value = true
}

function confirm() {
  save(props.widgetType, props.config, nameInput.value.trim() || props.defaultName)
  showPrompt.value = false
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}

function cancel() {
  showPrompt.value = false
}
</script>

<template>
  <span class="pocket-wrapper">
    <button
      class="pocket-btn"
      :class="{ 'pocket-saved': saved }"
      data-testid="pocket-save-btn"
      :title="saved ? 'Saved to pocket' : 'Save to pocket'"
      @click="open"
    >
      <svg v-if="!saved" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      <span class="pocket-label">{{ saved ? 'Saved' : 'Pocket' }}</span>
    </button>

    <!-- Name prompt overlay -->
    <div v-if="showPrompt" class="pocket-prompt" data-testid="pocket-prompt">
      <div class="pocket-prompt-card" @click.stop>
        <label class="pocket-prompt-label">Save to pocket</label>
        <input
          v-model="nameInput"
          type="text"
          class="pocket-prompt-input"
          :placeholder="defaultName || 'Name this snapshot'"
          data-testid="pocket-name-input"
          @keydown.enter="confirm"
          @keydown.escape="cancel"
        />
        <div class="pocket-prompt-actions">
          <button class="pocket-cancel" @click="cancel">Cancel</button>
          <button class="pocket-confirm" data-testid="pocket-confirm" @click="confirm">Save</button>
        </div>
      </div>
    </div>
  </span>
</template>

<style scoped>
.pocket-wrapper {
  position: relative;
  display: inline-flex;
}

.pocket-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  white-space: nowrap;
}

.pocket-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.pocket-saved {
  color: var(--accent);
  border-color: var(--accent);
}

.pocket-label { line-height: 1; }

.pocket-prompt {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.pocket-prompt-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.25rem;
  width: 90%;
  max-width: 340px;
}

.pocket-prompt-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 0.5rem;
}

.pocket-prompt-input {
  display: block;
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  font-size: 0.8rem;
  outline: none;
  box-sizing: border-box;
}

.pocket-prompt-input:focus {
  border-color: var(--accent);
}

.pocket-prompt-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.pocket-cancel,
.pocket-confirm {
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  background: var(--surface);
  color: var(--text);
}

.pocket-confirm {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
</style>
