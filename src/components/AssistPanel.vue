<script setup>
import { getAccessToken } from '../api/session.js'
import { ref, reactive, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { marked } from 'marked'
import { validateProposal, executeProposal } from '../composables/useEditProposals.js'
import {
  getAssistConversation,
  listAssistantModels,
  chooseAssistantModel,
} from '../api/community.js'
import { useAssistantContext } from '../composables/useAssistantContext.js'
import { useSidebar } from '../composables/useSidebar.js'
import { useRoute, useRouter } from 'vue-router'
import routeManifest from '../generated/route-manifest.json'
import { navigableRoutes, isNavigable as isNavigablePath, describeRoute } from '../agent/routeManifest.js'
import { sanitizeMarkdown } from '../utils/sanitize.js'
import { useVisibleViewportHeight } from '../composables/useVisibleViewportHeight.js'

// Keeps `--visible-vh` on <html> in sync with the actual visible
// viewport height. The CSS for `.assist-panel` reads this var so the
// input row at the bottom of the flex column stays above the address
// bar on mobile browsers where `100vh` resolves to the *layout*
// viewport (the largest possible, chrome bars hidden). Belt + braces
// alongside the `dvh` fallback in the stylesheet.
useVisibleViewportHeight()

/*
 * Props are still accepted so existing callers and tests keep working,
 * but the panel is mounted once in the app shell now and has no parent to
 * hand it editor state. When a prop is absent it falls back to whatever
 * surface has registered itself in the shared assistant context — the
 * report editor does so while it is mounted, and withdraws on unmount.
 */
const props = defineProps({
  reportContext: { type: String, default: null },
  reportId: { type: String, default: null },
  editorState: { type: Object, default: null },
})

const ctx = useAssistantContext()
/*
 * Router context is optional here, deliberately. This is a shell component
 * mounted once for the whole app, but it is also mounted directly in unit
 * tests that have no router — and a button that cannot render without one
 * is a button that breaks every test that touches it. Degrading to "no
 * navigation, rail assumed present" is the right failure: the panel still
 * works, it just cannot move the user.
 */
const route = useRoute()
const router = useRouter()

// The rail is absent on /login and present everywhere else, and its width
// changes when collapsed. The toggle sits beside it rather than on top of
// its account and collapse rows, so it has to know both.
const { collapsed: railCollapsed } = useSidebar()
const hasRail = computed(() => route?.path !== '/login')

/** Local guard before we move the user anywhere. */
function isNavigable(path) {
  return isNavigablePath(path, routeManifest)
}

const reportContext = computed(() => props.reportContext ?? ctx.reportContext.value)
const reportId = computed(() => props.reportId ?? ctx.reportId.value)
const editorState = computed(() => props.editorState ?? ctx.editorState.value)

function conversationKey() {
  return reportId.value ? `report:${reportId.value}` : 'global'
}

// `applied` carries the executed proposal so the parent can decide
// what to do next (re-pull metadata vs. persist editor content).
// `refresh` is kept for legacy callers but is no longer emitted by
// applyProposal — the old behaviour blew away unsaved local edits
// because the parent re-fetched the entire report from the server.
const rawEmit = defineEmits(['insert', 'refresh', 'applied'])

/*
 * Mounted globally there is no parent listening, so an emit alone would
 * drop the proposal on the floor. Forward to the registered handler too;
 * whichever surface can actually act on it gets it.
 */
function emit(event, payload) {
  rawEmit(event, payload)
  const handler = ctx.handlers.value?.[event]
  if (typeof handler === 'function') handler(payload)
}

const open = ref(false)

// The built-in model picker. Loaded when the panel is first opened rather
// than on mount: this component is mounted on every page, and a request
// per page-load for a control nobody has looked at yet is not worth it.
const models = ref([])
const selectedModel = ref('')
// False when the user has their own provider key: the turn spends that,
// so the built-in choice would change nothing and the picker stays hidden.
const modelChoiceApplies = ref(false)
const modelsLoaded = ref(false)
const modelBusy = ref(false)
// Teleport target only exists client-side; the panel is closed during SSR.
const mounted = ref(false)
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

// One shape for a tool-call proposal, used both mid-stream (the moment a
// status event carries one) and at the final merge.
function mapToolProposal(p) {
  return {
    action: p.action,
    params: { content: p.content, ...p },
    description: p.description || `${p.action}: ${(p.content || '').slice(0, 80)}`,
  }
}
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

/** Size of what the model got back, for the collapsed line. */
function formatBytes(n) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function renderMarkdown(text) {
  if (!text) return ''
  return sanitizeMarkdown(marked.parse(text))
}

function toggle() {
  open.value = !open.value
  if (open.value) loadModels()
}

async function loadModels() {
  if (modelsLoaded.value) return
  modelsLoaded.value = true          // set first: one attempt, not one per open
  try {
    const data = await listAssistantModels()
    models.value = data.models || []
    selectedModel.value = data.selected || ''
    modelChoiceApplies.value = data.active !== false
  } catch {
    // A picker that will not load is not worth an error message in a chat
    // window — the assistant still works on whatever the default is.
    models.value = []
  }
}

async function pickModel(id) {
  if (!id || id === selectedModel.value || modelBusy.value) return
  const previous = selectedModel.value
  selectedModel.value = id
  modelBusy.value = true
  try {
    const res = await chooseAssistantModel(id)
    selectedModel.value = res.selected || id
  } catch {
    // Put it back rather than lying. With :value bound the DOM follows
    // selectedModel, so reverting the ref reverts the visible control.
    selectedModel.value = previous
  } finally {
    modelBusy.value = false
  }
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

onMounted(() => {
  // Gate the Teleport: <body> is not a mountable target during SSR, and
  // the panel is closed then anyway.
  mounted.value = true
  loadConversation()
})

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
  let toolMsg = null

  try {
    const token = getAccessToken()
    const res = await fetch('/capi/assist/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message: text,
        conversation_key: conversationKey(),
        // Whether there is an editor to propose into. The server scopes
        // propose_edit out of the tool array unless this is true, so
        // omitting it did not merely lose a hint — it removed the tool.
        // The model, asked to use a tool it had never been given, narrated
        // instead: "the string has been added to the report as requested".
        // ASSIST-20 failed on exactly that, and it read for a long time as
        // the model declining to call a tool it was in fact never offered.
        //
        // executeProposal needs reportId AND editorState to apply an edit,
        // so that pair IS the condition for the tool to be useful — not a
        // separate flag that can drift away from it.
        has_editor: Boolean(reportId.value && editorState.value),
        context_block: reportContext.value,
          // Where the user is, and every page they can reach. Sent from
          // here rather than held server-side so there is one source of
          // truth: this is the same generated manifest the app routes
          // with, so the backend can never authorise a path this build
          // cannot serve.
          nav: {
            current: route?.fullPath,
            title: typeof document !== 'undefined' ? document.title : undefined,
            routes: navigableRoutes(routeManifest),
          },
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
            // Capture propose_edit proposals from tool_use events — and
            // surface them immediately. The card used to exist only after
            // the final merge at stream end, so nothing clickable appeared
            // until the model finished its prose tail: tens of seconds at
            // local-model speed, and the reason ASSIST-20 kept timing out
            // ten seconds after the first chunk. The proposal is complete
            // the moment this event arrives; there is nothing to wait for.
            // One bubble per tool call, pushed as it happens so the
            // chat reads as the model's working: what it reached for, in
            // what order, and what came back. The result arrives later on
            // a `tool_result` event and fills this in.
            if (status.phase === 'tool_use' && status.tool) {
              toolMsg = reactive({
                role: 'tool',
                name: status.tool,
                detail: status.detail || status.tool,
                elapsed: status.elapsed,
                running: true,
                expanded: false,
                args: null,
                result: '',
                bytes: 0,
                truncated: false,
              })
              messages.value.push(toolMsg)
            }
            if (status.proposal && status.proposal.action) {
              if (!assistMsg) {
                assistMsg = reactive({ role: 'assistant', text: '' })
                messages.value.push(assistMsg)
              }
              if (!assistMsg._toolProposals) assistMsg._toolProposals = []
              assistMsg._toolProposals.push(status.proposal)
              assistMsg.proposals = assistMsg._toolProposals.map(mapToolProposal)
            }
            await nextTick()
            scrollToBottom()
          } catch { /* skip */ }
        } else if (eventType === 'thinking' && eventData) {
          // Working-out, not the answer. The model narrates what it is
          // about to look up, and a turn that takes a minute used to show
          // nothing at all while it did it. Kept on its own field so it
          // can be styled as commentary and folded away once the real
          // answer arrives.
          try {
            const text = JSON.parse(eventData).text || ''
            if (text) {
              if (!assistMsg) {
                assistMsg = reactive({ role: 'assistant', text: '' })
                messages.value.push(assistMsg)
              }
              assistMsg.thinking = (assistMsg.thinking || '') + text + '\n'
              await nextTick()
              scrollToBottom()
            }
          } catch { /* skip malformed */ }
        } else if (eventType === 'chunk' && eventData) {
          try {
            const chunkText = JSON.parse(eventData).text || ''
            if (!assistMsg) {
              assistMsg = reactive({ role: 'assistant', text: '' })
              messages.value.push(assistMsg)
            }
            assistMsg.text += chunkText
            streamPhase.value = 'streaming'
            streamDetail.value = 'Writing response...'
            await nextTick()
            scrollToBottom()
          } catch { /* skip malformed */ }
        } else if (eventType === 'navigate' && eventData) {
          // The one tool that cannot run on the server. The backend already
          // validated the path against the manifest we sent, but validate
          // again here: this is the process that actually moves the user,
          // and it should not take a path on trust from anywhere.
          //
          // Validated, it is still only a REQUEST. Navigation is the one
          // action that takes the page out from under the user — mid-read,
          // mid-edit, mid-scroll — so it asks, every time.
          //
          // Deliberately NOT gated on `bypassPermissions`: accept-all is a
          // statement about proposed edits to an article, which the user is
          // looking at and can undo. It is not consent to be moved somewhere
          // else, and reading it as such would make the one irreversible-
          // feeling action the one nobody agreed to.
          try {
            const target = JSON.parse(eventData).path
            if (isNavigable(target)) {
              messages.value.push(reactive({
                role: 'nav',
                path: target,
                label: describeRoute(target, routeManifest) || target,
                state: 'pending',
              }))
              await nextTick()
              scrollToBottom()
            }
          } catch { /* malformed event: stay put */ }
        } else if (eventType === 'tool_result' && eventData) {
          // Matched by name to the newest still-running bubble rather than
          // by position: a turn can run several tools, and the executors do
          // not all resolve them in the order they were announced.
          try {
            const r = JSON.parse(eventData)
            const target = [...messages.value].reverse().find(
              (m) => m.role === 'tool' && m.running && m.name === r.tool)
            if (target) {
              target.running = false
              target.result = r.result || ''
              target.bytes = r.bytes || 0
              target.truncated = Boolean(r.truncated)
              if (r.args && Object.keys(r.args).length) target.args = r.args
              if (typeof r.elapsed === 'number') target.elapsed = r.elapsed
            }
            await nextTick()
            scrollToBottom()
          } catch { /* skip */ }
        } else if (eventType === 'error') {
          try { error.value = JSON.parse(eventData).error } catch { /* skip */ }
        }
      }
    }

    if (!assistMsg) {
      messages.value.push({ role: 'error', text: 'assist_panel.no_response' })
    } else {
      // Add the proposals parsed out of the prose. The tool_use ones are
      // already in `proposals` — rendered the moment their event arrived —
      // and must NOT be rebuilt from `_toolProposals` here.
      //
      // Rebuilding produced fresh objects and threw away the state the user
      // had already put on them. A proposal applied while the model was
      // still writing lost its `applied` flag when the turn ended: the
      // "Applied" badge disappeared and the Apply button came back, so a
      // second click re-inserted the same paragraph. A dismissed proposal
      // reappeared the same way. Both are invisible until the turn settles,
      // which is why they survived the end-to-end test — it asserts after
      // `done`, when the damage looks like the normal initial state.
      const textProposals = parseProposals(assistMsg.text)
      assistMsg.proposals = [...(assistMsg.proposals || []), ...textProposals]
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
  const result = await executeProposal(reportId.value, proposal, editorState.value)
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

/**
 * The user said yes to a navigation the assistant asked for.
 *
 * Re-validates rather than trusting the stored path: the bubble may have
 * been sitting in the transcript for a while, and this is still the process
 * that actually moves someone.
 */
function acceptNavigation(msg) {
  if (!msg || msg.state !== 'pending') return
  msg.state = 'accepted'
  if (isNavigable(msg.path)) router?.push(msg.path)
}

/** The user said no. The bubble stays, as a record of what was offered. */
function declineNavigation(msg) {
  if (!msg || msg.state !== 'pending') return
  msg.state = 'declined'
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
      :class="{
        'assist-toggle--open': open,
        'assist-toggle--rail': hasRail,
        'assist-toggle--rail-collapsed': hasRail && railCollapsed,
      }"
      data-testid="assist-toggle"
      @click="toggle"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span>{{ $t('assist.ai_assist') }}</span>
    </button>

    <!-- Panel overlay (click outside to close on mobile) -->
    <!-- Both the backdrop and the panel are position:fixed overlays, so
         they must not be laid out inside this component's mount point.
         ReportEditorView renders <AssistPanel> inside .secondary-controls,
         which is `display: none` below 640px unless the kebab opens it —
         and display:none on an ancestor stops a fixed child rendering at
         all. Opening the panel on desktop and narrowing to 375px left the
         panel present in the DOM with a 619px computed height and a 0x0
         bounding rect. Teleporting to <body> puts the overlay outside any
         collapsible container; the toggle button above stays in place. -->
    <Teleport v-if="mounted" to="body">
    <div v-if="open" class="assist-backdrop" @click="close"></div>

    <!-- Panel -->
    <div v-if="open" class="assist-panel" data-testid="assist-panel">
      <div class="assist-header">
        <span class="assist-title">{{ $t('assist.ai_assistant') }}</span>
        <div class="assist-header-actions">
          <!-- Only when the built-in is what runs. With a provider key
               stored the choice has no effect, and a control that does
               nothing is worse than no control. -->
          <!-- :value, not v-model. v-model writes selectedModel before
               @change fires, so pickModel's "already on that one" guard
               would see them equal and return without saving — the
               control moved and nothing persisted. selectedModel is
               owned by pickModel alone. -->
          <select
            v-if="modelChoiceApplies && models.length > 1"
            :value="selectedModel"
            class="assist-model"
            :disabled="modelBusy"
            :aria-label="$t('assist.model_label')"
            :title="$t('assist.model_label')"
            data-testid="assist-model-select"
            @change="pickModel($event.target.value)"
          >
            <!-- The model's own name, served by the API. Product names
                 are proper nouns; running them through i18n would only
                 create 24 chances to misspell one. -->
            <option v-for="m in models" :key="m.id" :value="m.id">
              {{ m.label }}
            </option>
          </select>
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
          {{ $t('assistant.empty_hint') }}
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
            <!-- The assistant's working-out. Shown expanded while it is
                 still the only thing there, folded to a summary once the
                 answer arrives, so a long turn is legible without the
                 commentary competing with the result. -->
            <details v-if="msg.thinking" class="msg-thinking" :open="!msg.text">
              <summary>{{ $t('assist.thinking') }}</summary>
              <div class="msg-thinking-body">{{ msg.thinking }}</div>
            </details>
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
          <!-- One tool call, as the model's working. Collapsed to a line;
               expanded it shows the arguments and exactly what came back,
               so an odd answer can be traced to a bad result or a bad
               reading of a good one. -->
          <!-- A navigation the assistant asked for. It asks every time,
               including when accept-all is on: that toggle is about edits
               to an article the user is looking at, not about being moved
               to another page. -->
          <div v-else-if="msg.role === 'nav'" class="msg-nav" data-testid="assist-nav">
            <div class="nav-ask">{{ $t('assist.navigate_ask', { page: msg.label }) }}</div>
            <div class="nav-path">{{ msg.path }}</div>
            <div v-if="msg.state === 'pending'" class="nav-buttons">
              <button class="nav-go" data-testid="assist-nav-go" @click="acceptNavigation(msg)">
                {{ $t('assist.navigate_go') }}
              </button>
              <button class="nav-stay" data-testid="assist-nav-stay" @click="declineNavigation(msg)">
                {{ $t('assist.navigate_stay') }}
              </button>
            </div>
            <div v-else class="nav-state" data-testid="assist-nav-state">
              {{ msg.state === 'accepted' ? $t('assist.navigate_went') : $t('assist.navigate_stayed') }}
            </div>
          </div>
          <div v-else-if="msg.role === 'tool'" class="msg-tool">
            <button
              class="tool-head"
              :class="{ 'tool-head--running': msg.running }"
              :aria-expanded="msg.expanded ? 'true' : 'false'"
              :data-testid="`tool-call-${msg.name}`"
              @click="msg.expanded = !msg.expanded"
            >
              <span class="tool-chevron" aria-hidden="true">{{ msg.expanded ? '▾' : '▸' }}</span>
              <span class="tool-name">{{ msg.detail }}</span>
              <span v-if="msg.running" class="tool-meta">{{ $t('assist.tool_running') }}</span>
              <span v-else class="tool-meta">{{ formatBytes(msg.bytes) }}</span>
            </button>
            <div v-if="msg.expanded" class="tool-body" data-testid="tool-call-body">
              <template v-if="msg.args">
                <div class="tool-label">{{ $t('assist.tool_arguments') }}</div>
                <pre class="tool-pre">{{ JSON.stringify(msg.args, null, 2) }}</pre>
              </template>
              <div class="tool-label">
                {{ $t('assist.tool_result') }}
                <span v-if="msg.truncated" class="tool-warn">{{ $t('assist.tool_truncated') }}</span>
              </div>
              <pre class="tool-pre">{{ msg.result || $t('assist.tool_no_result') }}</pre>
            </div>
          </div>
          <div v-else-if="msg.role === 'error'" class="msg-error">{{ $t(msg.text) }}</div>
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
    </Teleport>
  </div>
</template>

<style scoped>
.assist-wrapper {
  position: relative;
}

/* Anchored bottom-left, always in the same place.
 *
 * It used to be an inline button inside the report editor, which was fine
 * when that was the only page it existed on. Mounted globally it needs a
 * fixed home, and bottom-left is where it belongs: the same side as the
 * nav, so the two read as one control surface rather than competing.
 *
 * z-index 50 is deliberately BELOW the mobile drawer (60) and its scrim
 * (55). When the drawer is open the scrim covers this, which is right —
 * a button floating over an open nav drawer is a misclick waiting to
 * happen. Above the page content (10-ish) so it is never buried.
 *
 * Bottom offset consumes --cookie-banner-h for the same reason the rail
 * does: the banner is fixed along the bottom edge at z-index 1000, and
 * without this it sits on top of the button and makes it unclickable.
 */
.assist-toggle {
  position: fixed;
  left: 0.75rem;
  /* Fallback for browsers without svh/lvh (older Android Chromium): sits
     at the layout-viewport bottom, i.e. behind the address bar until you
     scroll. Not ideal, but never worse than before. */
  bottom: calc(0.4rem + var(--cookie-banner-h, 0px) + var(--safe-bottom, 0px));
  /* The real rule. `100lvh - 100svh` is the address bar's height — a
     CONSTANT, not a live measurement — so this pins the button to the
     small viewport's bottom edge: the position it settles into once you
     have scrolled. It is therefore visible before any scrolling AND never
     moves afterwards.
     The previous version added a JS-measured gap that tracked the bar in
     real time, which is precisely why everything wiggled on every scroll.
     Nothing here recalculates. */
  bottom: calc(0.4rem + var(--cookie-banner-h, 0px) + var(--safe-bottom, 0px)
               + (100lvh - 100svh));
  z-index: 50;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.85rem;
  border: 1px solid var(--bezel-border);
  border-radius: 999px;
  background: var(--bezel);
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
  transition: border-color 0.15s, color 0.15s, left 0.16s ease, background 0.15s;
}

/* Desktop: the rail occupies the left edge, so sit just beside it rather
 * than on top of its account and collapse rows. `left` transitions at the
 * same 0.16s as the rail's own width, so the two move together instead of
 * the button jumping after the rail has finished. */
@media (min-width: 900px) {
  .assist-toggle--rail { left: calc(15rem + 0.75rem); }
  .assist-toggle--rail-collapsed { left: calc(3.5rem + 0.75rem); }
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

.assist-model { font-size: 0.72rem; padding: 0.15rem 0.3rem; max-width: 9rem;
                border: 1px solid var(--bezel-border); border-radius: 6px;
                background: var(--bezel); color: inherit; }
.assist-model:disabled { opacity: 0.6; }
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
  /* min-height: 0 is load-bearing. A flex item defaults to
     min-height: auto, which means it refuses to shrink below its
     content — so this scroller grew to fit the conversation and pushed
     the input form past the bottom of the panel, which is clipped. There
     is enough slack on a tall desktop viewport to hide it; at 375x667
     the input left the panel entirely and stopped being visible at all
     (Playwright's boundingBox returned null). */
  min-height: 0;
  overflow-y: auto;
  padding: 0.75rem;
}

.assist-empty {
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.5;
  padding: 1rem 0;
}

.msg-thinking { font-size: 0.82rem; color: var(--muted); margin-bottom: 0.4rem;
                border-left: 2px solid var(--bezel-border); padding-left: 0.6rem; }
.msg-thinking summary { cursor: pointer; user-select: none; }
.msg-thinking-body { white-space: pre-wrap; margin-top: 0.3rem; opacity: 0.9; }
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

.msg-tool {
  margin: 0.25rem 0;
}
.tool-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--border-color, #d8dee4);
  border-radius: 4px;
  background: var(--bg-subtle, #f6f8fa);
  color: var(--text-secondary, #57606a);
  font: 500 0.78rem/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  cursor: pointer;
  text-align: left;
}
.tool-head:hover { border-color: var(--accent-color, #0969da); }
.tool-head--running { opacity: 0.75; }
.tool-chevron { flex: 0 0 auto; }
.tool-name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tool-meta { flex: 0 0 auto; font-size: 0.72rem; opacity: 0.75; font-variant-numeric: tabular-nums; }
.tool-body {
  margin-top: 0.3rem;
  padding: 0.5rem;
  border: 1px solid var(--border-color, #d8dee4);
  border-radius: 4px;
  background: var(--bg-subtle, #f6f8fa);
}
.tool-label {
  font: 600 0.68rem/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary, #57606a);
  margin-bottom: 0.25rem;
}
.tool-warn { color: var(--warning-color, #9a6700); text-transform: none; letter-spacing: 0; }
.tool-pre {
  margin: 0 0 0.5rem;
  padding: 0.4rem;
  max-height: 18rem;
  overflow: auto;
  background: var(--bg-default, #fff);
  border-radius: 3px;
  font: 400 0.72rem/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary, #1f2328);
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

/* Navigation request. Same visual weight as a proposal — it is the same
   kind of thing: something the assistant wants to do, pending consent. */
.msg-nav {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.4rem 0.5rem;
  margin: 0.25rem 0;
  background: var(--surface-2, transparent);
}

.nav-ask {
  font-size: 0.75rem;
}

.nav-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.65rem;
  color: var(--muted);
  margin: 0.15rem 0 0.35rem;
  overflow-wrap: anywhere;
}

.nav-buttons {
  display: flex;
  gap: 0.3rem;
}

.nav-go {
  font-size: 0.65rem;
  padding: 0.2rem 0.5rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}

.nav-stay {
  font-size: 0.65rem;
  padding: 0.2rem 0.5rem;
  background: none;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 3px;
  cursor: pointer;
}

.nav-state {
  font-size: 0.65rem;
  color: var(--muted);
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
