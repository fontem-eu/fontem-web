<script setup>
import { ref, nextTick } from 'vue'
import { validateProposal, executeProposal } from '../composables/useEditProposals.js'

const props = defineProps({
  reportContext: { type: String, default: '' },
  reportId: { type: String, default: '' },
  editorState: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['insert', 'refresh'])

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

  const assistMsg = { role: 'assistant', text: '', tools: 0, suggestions: [] }
  messages.value.push(assistMsg)

  try {
    const token = localStorage.getItem('gmr-token')
    const res = await fetch('/capi/assist/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message: text,
        history: chatHistory.value,
        report_context: props.reportContext,
      }),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      while (buffer.includes('\n\n')) {
        const idx = buffer.indexOf('\n\n')
        const block = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)

        let eventType = 'chunk'
        let eventData = ''
        for (const line of block.split('\n')) {
          if (line.startsWith('event: ')) eventType = line.slice(7)
          else if (line.startsWith('data: ')) eventData = line.slice(6)
        }

        if (eventType === 'chunk' && eventData) {
          try {
            assistMsg.text += JSON.parse(eventData).text || ''
            await nextTick()
            scrollToBottom()
          } catch { /* skip malformed */ }
        } else if (eventType === 'error') {
          try { error.value = JSON.parse(eventData).error } catch { /* skip */ }
        }
      }
    }

    // Parse any edit proposals from the response
    assistMsg.proposals = parseProposals(assistMsg.text)
    chatHistory.value.push({ role: 'user', content: text })
    chatHistory.value.push({ role: 'assistant', content: assistMsg.text })
  } catch (err) {
    error.value = err.message
    if (!assistMsg.text) {
      messages.value.pop()
      messages.value.push({ role: 'error', text: err.message })
    }
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

/**
 * Parse JSON proposals from Claude's response text.
 * Claude returns propose_edit results as JSON objects with "proposed": true.
 */
function parseProposals(text) {
  const proposals = []
  const jsonPattern = /\{[^{}]*"proposed"\s*:\s*true[^{}]*\}/g
  let match
  while ((match = jsonPattern.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[0])
      if (parsed.proposed && parsed.action) {
        const validation = validateProposal({ action: parsed.action, ...parsed.params })
        if (validation.valid) {
          proposals.push({ action: parsed.action, params: parsed.params, description: parsed.description })
        }
      }
    } catch { /* skip malformed JSON */ }
  }
  return proposals
}

async function applyProposal(proposal, msgIndex) {
  const result = await executeProposal(props.reportId, proposal, props.editorState)
  if (result.ok) {
    // Mark as applied in the message
    const msg = messages.value[msgIndex]
    if (msg?.proposals) {
      const idx = msg.proposals.indexOf(proposal)
      if (idx >= 0) msg.proposals[idx] = { ...proposal, applied: true }
    }
    emit('refresh')
  } else {
    error.value = `Edit failed: ${result.error}`
  }
}

function dismissProposal(proposal, msgIndex) {
  const msg = messages.value[msgIndex]
  if (msg?.proposals) {
    msg.proposals = msg.proposals.filter(p => p !== proposal)
  }
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
            <!-- Edit proposals -->
            <div v-if="msg.proposals?.length" class="msg-proposals">
              <div
                v-for="(p, pi) in msg.proposals"
                :key="pi"
                class="msg-proposal"
                :class="{ 'proposal-applied': p.applied }"
              >
                <div class="proposal-header">
                  <span class="proposal-action">{{ p.action.replace(/_/g, ' ') }}</span>
                  <span v-if="p.applied" class="proposal-status">Applied</span>
                </div>
                <div class="proposal-desc">{{ p.description }}</div>
                <div v-if="!p.applied" class="proposal-buttons">
                  <button class="proposal-apply" @click="applyProposal(p, i)">Apply</button>
                  <button class="proposal-dismiss" @click="dismissProposal(p, i)">Dismiss</button>
                </div>
              </div>
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

.msg-proposals {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.msg-proposal {
  border: 1px solid var(--accent);
  border-radius: 6px;
  padding: 0.5rem;
  background: color-mix(in srgb, var(--accent) 5%, var(--surface));
}

.proposal-applied {
  opacity: 0.6;
  border-style: dashed;
}

.proposal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.proposal-action {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: capitalize;
  color: var(--accent);
}

.proposal-status {
  font-size: 0.6rem;
  color: #15803d;
  font-weight: 600;
}

.proposal-desc {
  font-size: 0.7rem;
  color: var(--muted);
  margin-bottom: 0.35rem;
}

.proposal-buttons {
  display: flex;
  gap: 0.3rem;
}

.proposal-apply {
  font-size: 0.65rem;
  padding: 0.2rem 0.5rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}

.proposal-dismiss {
  font-size: 0.65rem;
  padding: 0.2rem 0.5rem;
  background: none;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 3px;
  cursor: pointer;
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
