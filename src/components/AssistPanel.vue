<script setup>
import { ref, nextTick } from 'vue'
import { sendAssistMessage } from '../api/community.js'

const props = defineProps({
  reportContext: { type: String, default: '' },
})

const emit = defineEmits(['insert'])

const open = ref(false)
const input = ref('')
const loading = ref(false)
const messages = ref([])
const error = ref(null)
const chatHistory = ref([])
const messagesEl = ref(null)

function toggle() {
  open.value = !open.value
}

async function send() {
  const text = input.value.trim()
  if (!text || loading.value) return

  messages.value.push({ role: 'user', text })
  input.value = ''
  loading.value = true
  error.value = null

  await nextTick()
  scrollToBottom()

  try {
    const result = await sendAssistMessage(text, chatHistory.value, props.reportContext)
    messages.value.push({
      role: 'assistant',
      text: result.content,
      tools: result.tool_calls_made || 0,
      suggestions: result.suggestions || [],
    })
    // Update history for multi-turn
    chatHistory.value.push({ role: 'user', content: text })
    chatHistory.value.push({ role: 'assistant', content: result.content })
  } catch (err) {
    error.value = err.message
    messages.value.push({ role: 'error', text: err.message })
  } finally {
    loading.value = false
    await nextTick()
    scrollToBottom()
  }
}

function scrollToBottom() {
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

function insertText(text) {
  emit('insert', text)
}

function insertSuggestion(suggestion) {
  const config = {
    widget_type: suggestion.widget_type,
    schema_version: 1,
    entityId: suggestion.entity_id,
  }
  const marker = '\n```widget\n' + JSON.stringify(config) + '\n```\n'
  emit('insert', marker)
}

function clearChat() {
  messages.value = []
  chatHistory.value = []
  error.value = null
}
</script>

<template>
  <div class="assist-wrapper">
    <!-- Toggle button -->
    <button
      class="assist-toggle"
      :class="{ 'assist-toggle--open': open }"
      data-testid="assist-toggle"
      @click="toggle"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span>AI Assist</span>
    </button>

    <!-- Panel -->
    <div v-if="open" class="assist-panel" data-testid="assist-panel">
      <div class="assist-header">
        <span class="assist-title">AI Assistant</span>
        <button class="assist-clear" @click="clearChat" title="Clear chat">Clear</button>
      </div>

      <!-- Messages -->
      <div ref="messagesEl" class="assist-messages" data-testid="assist-messages">
        <div v-if="!messages.length" class="assist-empty">
          Ask me about the data — I can search entities, find connections,
          and suggest visualizations for your report.
        </div>
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="assist-msg"
          :class="'assist-msg--' + msg.role"
        >
          <div v-if="msg.role === 'user'" class="msg-user">{{ msg.text }}</div>
          <div v-else-if="msg.role === 'assistant'" class="msg-assistant">
            <div class="msg-text" v-text="msg.text"></div>
            <div v-if="msg.tools" class="msg-meta">
              {{ msg.tools }} tool call{{ msg.tools === 1 ? '' : 's' }} made
            </div>
            <div class="msg-actions">
              <button class="msg-action" @click="insertText(msg.text)">
                Insert into report
              </button>
            </div>
            <!-- Visualization suggestions -->
            <div v-if="msg.suggestions?.length" class="msg-suggestions">
              <div
                v-for="(s, j) in msg.suggestions"
                :key="j"
                class="msg-suggestion"
              >
                <span class="suggestion-type">{{ s.widget_type.replace(/_/g, ' ') }}</span>
                <span class="suggestion-caption">{{ s.caption }}</span>
                <button class="msg-action" @click="insertSuggestion(s)">
                  Embed
                </button>
              </div>
            </div>
          </div>
          <div v-else-if="msg.role === 'error'" class="msg-error">{{ msg.text }}</div>
        </div>
        <div v-if="loading" class="assist-loading">Thinking...</div>
      </div>

      <!-- Input -->
      <form class="assist-input" @submit.prevent="send">
        <input
          v-model="input"
          type="text"
          placeholder="Ask about the data..."
          :disabled="loading"
          data-testid="assist-input"
          @keydown.enter.prevent="send"
        />
        <button type="submit" :disabled="loading || !input.trim()" data-testid="assist-send">
          Send
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.assist-wrapper {
  position: relative;
}

.assist-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.assist-toggle:hover,
.assist-toggle--open {
  border-color: var(--accent);
  color: var(--accent);
}

.assist-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 380px;
  height: 100vh;
  background: var(--bg);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: 100;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
}

.assist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
}

.assist-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
}

.assist-clear {
  font-size: 0.7rem;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}

.assist-clear:hover { color: var(--text); }

.assist-messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
}

.assist-empty {
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.5;
  padding: 1rem 0;
}

.assist-msg {
  margin-bottom: 0.75rem;
}

.msg-user {
  background: var(--accent);
  color: #fff;
  padding: 0.5rem 0.75rem;
  border-radius: 12px 12px 4px 12px;
  font-size: 0.8rem;
  max-width: 90%;
  margin-left: auto;
}

.msg-assistant {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 0.5rem 0.75rem;
  border-radius: 12px 12px 12px 4px;
  font-size: 0.8rem;
  max-width: 95%;
}

.msg-text {
  white-space: pre-wrap;
  line-height: 1.5;
  color: var(--text);
}

.msg-meta {
  font-size: 0.65rem;
  color: var(--muted);
  margin-top: 0.3rem;
}

.msg-actions {
  margin-top: 0.4rem;
}

.msg-action {
  font-size: 0.65rem;
  color: var(--accent);
  background: none;
  border: 1px solid var(--accent);
  border-radius: 3px;
  padding: 0.15rem 0.4rem;
  cursor: pointer;
  margin-right: 0.3rem;
}

.msg-action:hover {
  background: var(--accent);
  color: #fff;
}

.msg-suggestions {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.msg-suggestion {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.5rem;
  border: 1px dashed var(--border);
  border-radius: 4px;
  font-size: 0.7rem;
}

.suggestion-type {
  font-weight: 600;
  color: var(--accent);
  text-transform: capitalize;
}

.suggestion-caption {
  flex: 1;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.msg-error {
  color: #dc2626;
  font-size: 0.75rem;
  padding: 0.3rem 0;
}

.assist-loading {
  font-size: 0.75rem;
  color: var(--muted);
  font-style: italic;
}

.assist-input {
  display: flex;
  gap: 0.4rem;
  padding: 0.75rem;
  border-top: 1px solid var(--border);
}

.assist-input input {
  flex: 1;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.8rem;
  background: var(--surface);
  color: var(--text);
  outline: none;
}

.assist-input input:focus {
  border-color: var(--accent);
}

.assist-input button {
  padding: 0.5rem 0.75rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.assist-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
