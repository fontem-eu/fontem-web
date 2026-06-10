<script setup>
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { marked } from 'marked'
import { validateProposal, executeProposal } from '../composables/useEditProposals.js'
import { getAssistConversation } from '../api/community.js'
import { sanitizeMarkdown } from '../utils/sanitize.js'
import { useVisibleViewportHeight } from '../composables/useVisibleViewportHeight.js'

// Keeps `--visible-vh` on <html> in sync with the actual visible
// viewport height. The CSS for `.assist-panel` reads this var so the
// input row at the bottom of the flex column stays above the address
// bar on mobile browsers where `100vh` resolves to the *layout*
// viewport (the largest possible, chrome bars hidden). Belt + braces
// alongside the `dvh` fallback in the stylesheet.
useVisibleViewportHeight()

const props = defineProps({
  reportContext: { type: String, default: '' },
  reportId: { type: String, default: '' },
  editorState: { type: Object, default: () => ({}) },
})

function conversationKey() {
  return props.reportId ? `report:${props.reportId}` : ''
}

// `applied` carries the executed proposal so the parent can decide
// what to do next (re-pull metadata vs. persist editor content).
// `refresh` is kept for legacy callers but is no longer emitted by
// applyProposal — the old behaviour blew away unsaved local edits
// because the parent re-fetched the entire report from the server.
const emit = defineEmits(['insert', 'refresh', 'applied'])

const open = ref(false)
const input = ref('')
const inputEl = ref(null)

// Auto-grow the textarea up to ``--assist-input-max-h`` (8 lines /
// ~12rem). Past that the box stops growing and scrolls vertically.
// We measure scrollHeight on every input event after collapsing
// height to 0 so the new measurement reflects the current content
// rather than the previous (taller) box.
function autoGrow() {
  const el = inputEl.value
  if (!el) return
  el.style.height = '0px'
  const max = parseFloat(
    getComputedStyle(el).getPropertyValue('max-height'),
  ) || el.scrollHeight
  el.style.height = Math.min(el.scrollHeight, max) + 'px'
}

// Watch for programmatic resets (e.g. after send) so the textarea
// shrinks back to one row instead of staying at the multi-line size.
watch(input, async (v) => {
  if (v === '') {
    await nextTick()
    autoGrow()
  }
})
const loading = ref(false)
const messages = ref([])
const error = ref(null)
const messagesEl = ref(null)

// "Bypass permissions" / accept-all mode. When on, every propose_edit
// proposal that comes back from a tool call is applied as soon as it
// lands — no Apply/Dismiss prompt. Stored in localStorage so power
// users don't toggle it every session. Off by default: applying
// destructive edits without explicit consent is a strong signal we
// only want behind an opt-in.
const BYPASS_KEY = 'fontem-assist-bypass-permissions'
const bypassPermissions = ref(
  typeof localStorage !== 'undefined'
    && localStorage.getItem(BYPASS_KEY) === '1',
)
watch(bypassPermissions, (on) => {
  if (typeof localStorage === 'undefined') return
  if (on) localStorage.setItem(BYPASS_KEY, '1')
  else localStorage.removeItem(BYPASS_KEY)
})

// Streaming status — now shows real tool activity
const streamPhase = ref(null)
const streamDetail = ref('')
const streamElapsed = ref(0)
let elapsedTimer = null

// Configure marked for safe rendering
marked.setOptions({ breaks: true, gfm: true })

function renderMarkdown(text) {
  if (!text) return ''
  return sanitizeMarkdown(marked.parse(text))
}

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function startElapsedTimer() {
  const start = Date.now()
  streamElapsed.value = 0
  elapsedTimer = setInterval(() => {
    streamElapsed.value = Math.round((Date.now() - start) / 1000)
  }, 1000)
}

function stopElapsedTimer() {
  if (elapsedTimer) {
    clearInterval(elapsedTimer)
    elapsedTimer = null
  }
  streamPhase.value = null
  streamDetail.value = ''
  streamElapsed.value = 0
}

onUnmounted(stopElapsedTimer)

// ── Conversation loading ──────────────────────────────────────
// History is owned and persisted server-side by the assistant module.
// We just hydrate the UI with whatever it returns for this report.

async function loadConversation() {
  const key = conversationKey()
  if (!key) return
  try {
    const conv = await getAssistConversation(key)
    if (conv && Array.isArray(conv.messages) && conv.messages.length > 0) {
      messages.value = conv.messages.map(m => ({ role: m.role, text: m.content }))
      await nextTick()
      scrollToBottom()
    }
  } catch {
    // Silent fail — conversation just won't be restored
  }
}

onMounted(loadConversation)

// ── Send message ─────────────────────────────────────────────

async function send() {
  const text = input.value.trim()
  if (!text || loading.value) return

  messages.value.push({ role: 'user', text })
  input.value = ''
  loading.value = true
  error.value = null
  streamPhase.value = 'connecting'
  streamDetail.value = 'Starting assistant...'
  startElapsedTimer()

  await nextTick()
  scrollToBottom()

  let assistMsg = null

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
        conversation_key: conversationKey(),
        context_block: props.reportContext,
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

        if (eventType === 'status' && eventData) {
          try {
            const status = JSON.parse(eventData)
            streamPhase.value = status.phase
            streamDetail.value = status.detail || ''
            // Capture propose_edit proposals from tool_use events
            if (status.proposal && status.proposal.action) {
              if (!assistMsg) {
                assistMsg = { role: 'assistant', text: '' }
                messages.value.push(assistMsg)
              }
              if (!assistMsg._toolProposals) assistMsg._toolProposals = []
              assistMsg._toolProposals.push(status.proposal)
            }
            await nextTick()
            scrollToBottom()
          } catch { /* skip */ }
        } else if (eventType === 'chunk' && eventData) {
          try {
            const chunkText = JSON.parse(eventData).text || ''
            if (!assistMsg) {
              assistMsg = { role: 'assistant', text: '' }
              messages.value.push(assistMsg)
            }
            assistMsg.text += chunkText
            streamPhase.value = 'streaming'
            streamDetail.value = 'Writing response...'
            await nextTick()
            scrollToBottom()
          } catch { /* skip malformed */ }
        } else if (eventType === 'error') {
          try { error.value = JSON.parse(eventData).error } catch { /* skip */ }
        }
      }
    }

    if (!assistMsg) {
      messages.value.push({ role: 'error', text: 'No response received from assistant.' })
    } else {
      // Merge proposals from text parsing and from tool_use events
      const textProposals = parseProposals(assistMsg.text)
      const toolProposals = (assistMsg._toolProposals || []).map(p => ({
        action: p.action,
        params: { content: p.content, ...p },
        description: p.description || `${p.action}: ${(p.content || '').slice(0, 80)}`,
      }))
      assistMsg.proposals = [...toolProposals, ...textProposals]
      delete assistMsg._toolProposals
      // Accept-all mode: fire each proposal serially through the same
      // applyProposal path users would click, so the "Applied" badge
      // and the parent's `applied` emit fire the same way. Awaiting
      // here keeps the order deterministic if the same prompt
      // produces multiple edits (e.g. set_title + insert_content).
      if (bypassPermissions.value && assistMsg.proposals.length > 0) {
        const msgIndex = messages.value.indexOf(assistMsg)
        for (const proposal of [...assistMsg.proposals]) {
          await applyProposal(proposal, msgIndex, true)
        }
      }
    }
  } catch (err) {
    error.value = err.message
    if (!assistMsg) {
      messages.value.push({ role: 'error', text: err.message })
    }
  } finally {
    loading.value = false
    stopElapsedTimer()
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

function parseProposals(text) {
  const proposals = []
  // Extract top-level JSON objects containing "proposed": true.
  // We can't use a simple regex because proposals have nested braces
  // (e.g. params: {widget_type: "...", entityId: "..."}). Instead,
  // find each '{' that precedes '"proposed"' and track brace depth.
  let i = 0
  while (i < text.length) {
    const propIdx = text.indexOf('"proposed"', i)
    if (propIdx === -1) break
    // Walk backwards to find the opening brace
    let start = text.lastIndexOf('{', propIdx)
    if (start === -1) { i = propIdx + 1; continue }
    // Walk forward tracking brace depth to find the matching close
    let depth = 0
    let end = -1
    for (let j = start; j < text.length; j++) {
      if (text[j] === '{') depth++
      else if (text[j] === '}') { depth--; if (depth === 0) { end = j + 1; break } }
    }
    if (end === -1) { i = propIdx + 1; continue }
    try {
      const parsed = JSON.parse(text.slice(start, end))
      if (parsed.proposed && parsed.action) {
        const validation = validateProposal({ action: parsed.action, params: parsed.params })
        if (validation.valid) {
          proposals.push({ action: parsed.action, params: parsed.params, description: parsed.description })
        }
      }
    } catch { /* skip malformed JSON */ }
    i = end
  }
  return proposals
}

async function applyProposal(proposal, msgIndex, auto = false) {
  const result = await executeProposal(props.reportId, proposal, props.editorState)
  if (result.ok) {
    const msg = messages.value[msgIndex]
    if (msg?.proposals) {
      const idx = msg.proposals.indexOf(proposal)
      if (idx >= 0) msg.proposals[idx] = { ...proposal, applied: true, autoApplied: auto }
    }
    // Hand the parent enough context to persist the change correctly:
    // 'content' edits live only in the local editor until the parent
    // saves; 'metadata' edits already round-tripped through the API.
    emit('applied', {
      action: result.action,
      category: result.category,
      params: result.params,
    })
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
  // Clears the local UI view only. Server-side history is preserved
  // (the assistant module is the source of truth for conversation state).
  messages.value = []
  error.value = null
  stopElapsedTimer()
}

// Test-only surface: integration tests need to drive the apply flow
// without standing up the full SSE stream + jsdom timing. Only the
// pieces that integration-test scenarios need are exposed.
defineExpose({ applyProposal, messages })
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
      <span>{{ $t('assist.ai_assist') }}</span>
    </button>

    <!-- Panel overlay (click outside to close on mobile) -->
    <div v-if="open" class="assist-backdrop" @click="close"></div>

    <!-- Panel -->
    <div v-if="open" class="assist-panel" data-testid="assist-panel">
      <div class="assist-header">
        <span class="assist-title">{{ $t('assist.ai_assistant') }}</span>
        <div class="assist-header-actions">
          <label
            class="assist-bypass"
            :class="{ 'assist-bypass--on': bypassPermissions }"
            :title="bypassPermissions
              ? 'Accept-all is ON — proposed edits apply automatically'
              : 'Accept-all is OFF — proposed edits require Apply'"
          >
            <input
              v-model="bypassPermissions"
              type="checkbox"
              data-testid="assist-bypass-toggle"
            />
            <span>{{ $t('assist.accept_all') }}</span>
          </label>
          <button class="assist-clear" :title="$t('assist.clear_chat')" @click="clearChat">{{ $t('app.clear') }}</button>
          <button class="assist-close" data-testid="assist-close" :title="$t('app.close')" @click="close">&times;</button>
        </div>
      </div>

      <!-- Inline error banner (apply failures, stream errors). Without
           this the panel used to set `error.value` and render nothing,
           so users saw "Apply did nothing" with zero feedback. -->
      <div v-if="error" class="assist-error-banner" data-testid="assist-error">
        {{ error }}
        <button class="assist-error-dismiss" :aria-label="$t('app.dismiss')" @click="error = null">&times;</button>
      </div>

      <!-- Messages -->
      <div ref="messagesEl" class="assist-messages" data-testid="assist-messages">
        <div v-if="!messages.length && !loading" class="assist-empty">
          Ask me about the data — I can search entities, find connections,
          and suggest visualizations for your data story.
        </div>
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="assist-msg"
          :class="'assist-msg--' + msg.role"
        >
          <div v-if="msg.role === 'user'" class="msg-user">{{ msg.text }}</div>
          <div v-else-if="msg.role === 'assistant'" class="msg-assistant">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="msg-text msg-markdown" v-html="renderMarkdown(msg.text)"></div>
            <div class="msg-actions">
              <button class="msg-action" @click="insertText(msg.text)">{{ $t('assist.insert_into_story') }}</button>
            </div>
            <!-- Edit proposals -->
            <div v-if="msg.proposals?.length" class="msg-proposals" data-testid="assist-proposals">
              <div
                v-for="(p, pi) in msg.proposals"
                :key="pi"
                class="msg-proposal"
                :class="{ 'proposal-applied': p.applied }"
                :data-testid="`assist-proposal-${pi}`"
              >
                <div class="proposal-header">
                  <span class="proposal-action" data-testid="proposal-action">{{ p.action.replace(/_/g, ' ') }}</span>
                  <span
                    v-if="p.applied"
                    class="proposal-status"
                    :class="{ 'proposal-status--auto': p.autoApplied }"
                    data-testid="proposal-applied"
                  >
                    {{ p.autoApplied ? $t('app.applied_auto') : $t('app.applied') }}
                  </span>
                </div>
                <div class="proposal-desc" data-testid="proposal-desc">{{ p.description }}</div>
                <div v-if="!p.applied" class="proposal-buttons">
                  <button class="proposal-apply" data-testid="proposal-apply" @click="applyProposal(p, i)">{{ $t('assist.apply') }}</button>
                  <button class="proposal-dismiss" data-testid="proposal-dismiss" @click="dismissProposal(p, i)">{{ $t('app.dismiss') }}</button>
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
                <button class="msg-action" @click="insertSuggestion(s)">{{ $t('assist.embed') }}</button>
              </div>
            </div>
          </div>
          <div v-else-if="msg.role === 'error'" class="msg-error">{{ msg.text }}</div>
        </div>

        <!-- Streaming status indicator -->
        <div v-if="loading && streamPhase" class="assist-status" data-testid="assist-status">
          <div class="status-indicator">
            <span class="status-dot"></span>
            <span class="status-dot"></span>
            <span class="status-dot"></span>
          </div>
          <div class="status-text">
            <span class="status-detail">{{ streamDetail || $t('app.working') }}</span>
            <span v-if="streamElapsed > 0" class="status-elapsed">{{ streamElapsed }}s</span>
          </div>
        </div>
      </div>

      <p class="assist-disclosure">{{ $t('assist.conversations_are_processed_by_an_eu_bas') }}<router-link to="/privacy">{{ $t('assist.see_our_privacy_policy') }}</router-link>
      </p>

      <!-- Input -->
      <form class="assist-input" @submit.prevent="send">
        <textarea
          ref="inputEl"
          v-model="input"
          :placeholder="$t('assist.ask_about_the_data')"
          :disabled="loading"
          data-testid="assist-input"
          rows="1"
          @input="autoGrow"
          @keydown.enter.exact.prevent="send"
        />
        <button type="submit" :disabled="loading || !input.trim()" data-testid="assist-send">{{ $t('assist.send') }}</button>
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

/* Backdrop for mobile: click outside to close */
.assist-backdrop {
  display: none;
}

@media (max-width: 768px) {
  .assist-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 99;
  }
}

.assist-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 380px;
  /* Three-layer cascade for the panel's visible height — older
     browsers fall through to the simpler rule above.
       1. `100vh`               legacy fallback (large-viewport sized
                                — fine on desktop, broken on mobile
                                Chrome where it includes the address
                                bar area)
       2. `100dvh`              modern viewport-relative unit that
                                tracks the *visible* viewport as the
                                mobile chrome bar slides in/out
                                (Chrome 108+, Safari 15.4+, FF 101+)
       3. `var(--visible-vh)`   px value published by the visual-
                                Viewport API listener in
                                useVisibleViewportHeight().  Wins on
                                any browser that ships visualViewport
                                (essentially every mobile browser)
                                including older Chromium builds where
                                `dvh` isn't recognised.
     The input row sits at the bottom of the flex column; if the panel
     is sized to the *largest possible* viewport instead of the visible
     one, the row scrolls off the bottom edge on Android Chrome /
     Ecosia / etc.  Symptom reported by the user: "the input field is
     not even rendered." */
  height: 100vh;
  height: 100dvh;
  height: var(--visible-vh, 100dvh);
  background: var(--bg);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: 100;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
}

/* On mobile: full width but not quite full height — leave room to see the page */
@media (max-width: 768px) {
  .assist-panel {
    width: 100%;
    top: 3rem;
    height: calc(100vh - 3rem);
    height: calc(100dvh - 3rem);
    height: calc(var(--visible-vh, 100dvh) - 3rem);
    border-left: none;
    border-top: 1px solid var(--border);
    border-radius: 12px 12px 0 0;
  }
}

.assist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.assist-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
}

.assist-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.assist-clear {
  font-size: 0.7rem;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
}

.assist-clear:hover { color: var(--text); }

.assist-bypass {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  color: var(--muted);
  cursor: pointer;
  user-select: none;
}
.assist-bypass input {
  margin: 0;
  cursor: pointer;
}
.assist-bypass--on {
  color: var(--accent);
  font-weight: 600;
}

.assist-close {
  font-size: 1.2rem;
  line-height: 1;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
}

.assist-close:hover {
  color: var(--text);
  border-color: var(--text);
}

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

/* Markdown rendering in assistant messages */
.msg-markdown { line-height: 1.5; color: var(--text); }
.msg-markdown :deep(p) { margin: 0.3rem 0; }
.msg-markdown :deep(h1),
.msg-markdown :deep(h2),
.msg-markdown :deep(h3) { margin: 0.5rem 0 0.2rem; font-size: 0.9rem; font-weight: 700; }
.msg-markdown :deep(ul),
.msg-markdown :deep(ol) { padding-left: 1.2rem; margin: 0.3rem 0; }
.msg-markdown :deep(li) { margin: 0.15rem 0; }
.msg-markdown :deep(table) { width: 100%; border-collapse: collapse; font-size: 0.75rem; margin: 0.4rem 0; }
.msg-markdown :deep(th),
.msg-markdown :deep(td) { border: 1px solid var(--border); padding: 0.25rem 0.4rem; text-align: left; }
.msg-markdown :deep(th) { background: var(--bg); font-weight: 600; }
.msg-markdown :deep(code) { background: var(--bg); padding: 0.1rem 0.25rem; border-radius: 3px; font-size: 0.8em; }
.msg-markdown :deep(pre) { background: var(--bg); padding: 0.5rem; border-radius: 4px; overflow-x: auto; }
.msg-markdown :deep(strong) { font-weight: 600; }
.msg-markdown :deep(a) { color: var(--accent); }

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

.proposal-status--auto {
  color: var(--accent);
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

.assist-error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(220, 38, 38, 0.08);
  border-bottom: 1px solid rgba(220, 38, 38, 0.2);
  color: #b91c1c;
  font-size: 0.8rem;
}
.assist-error-dismiss {
  background: transparent;
  border: none;
  color: #b91c1c;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0 0.25rem;
}

/* Animated streaming status with detail text */
.assist-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  margin-top: 0.25rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px 12px 12px 4px;
  max-width: 90%;
}

.status-indicator {
  display: flex;
  gap: 3px;
  align-items: center;
  flex-shrink: 0;
}

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1.4s infinite ease-in-out;
}

.status-dot:nth-child(2) { animation-delay: 0.2s; }
.status-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes pulse {
  0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1.1); }
}

.status-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.status-detail {
  font-size: 0.75rem;
  color: var(--text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-elapsed {
  font-size: 0.65rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.assist-disclosure {
  padding: 0.25rem 0.75rem;
  margin: 0;
  font-size: 0.65rem;
  color: var(--muted);
  line-height: 1.4;
  flex-shrink: 0;
}
.assist-disclosure a {
  color: var(--muted);
  text-decoration: underline;
}
.assist-disclosure a:hover {
  color: var(--accent);
}

.assist-input {
  display: flex;
  align-items: flex-end;
  gap: 0.4rem;
  padding: 0.75rem;
  /* Lift the input above the fixed cookie consent banner when it's
     visible — the banner sits at viewport-bottom with z-index 1000
     and the assist panel ends at viewport-bottom too, so without this
     pad the textarea gets occluded (desktop) or fully hidden under
     the banner (mobile, where the panel is full-width). The variable
     defaults to 0px and is set by CookieConsentBanner.vue while the
     banner is rendered. */
  padding-bottom: calc(0.75rem + var(--cookie-banner-h, 0px));
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.assist-input textarea {
  flex: 1;
  min-width: 0;             /* let flex shrink below content width */
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  font: inherit;
  font-size: 0.8rem;
  background: var(--surface);
  color: var(--text);
  outline: none;
  /* Wrap long words/URLs so the textarea never widens past the
     panel — this was the mobile bug where pasting a URL pushed the
     entire input row off-screen. */
  resize: none;
  overflow-y: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  /* Auto-grow ceiling. Past ~8 short lines the box stops growing
     and scrolls; without the cap a long paste would push the
     messages list out of view entirely on mobile. */
  max-height: 12rem;
  line-height: 1.35;
}

.assist-input textarea:focus {
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
  flex-shrink: 0;
}

.assist-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
