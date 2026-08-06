<script setup>
/**
 * Connect your own AI client to Fontem.
 *
 * The inversion: rather than Fontem hosting a model and paying for it,
 * you point the client you already pay for at Fontem's tools. Your
 * subscription, your quota.
 *
 * The token is shown exactly once. That is deliberate and worth the
 * inconvenience — a token you can re-read later is one an attacker can
 * re-read later.
 */
import { ref, onMounted } from 'vue'
import { listMcpTokens, createMcpToken, revokeMcpToken } from '../api/community.js'

const tokens = ref([])
const label = ref('')
const fresh = ref('')        // plaintext, in memory only, until dismissed
const busy = ref(false)
const error = ref('')
const copied = ref(false)

async function load() {
  try {
    tokens.value = (await listMcpTokens()).tokens || []
  } catch (err) { error.value = err.message }
}

async function create() {
  error.value = ''
  busy.value = true
  try {
    const res = await createMcpToken(label.value)
    fresh.value = res.token
    label.value = ''
    // Insert from the response rather than re-fetching. The create call
    // already returns the summary, and a GET straight after the POST came
    // back without the new row often enough to be visible: you created a
    // token and your own list did not show it until you reloaded. Newest
    // first, matching the server's ordering.
    const summary = { id: res.id, label: res.label,
                      created_at: res.created_at, last_used_at: res.last_used_at }
    tokens.value = [summary, ...tokens.value]
  } catch (err) { error.value = err.message } finally { busy.value = false }
}

async function revoke(id) {
  busy.value = true
  try {
    await revokeMcpToken(id)
    // Drop it locally rather than re-fetching, for the same reason create
    // inserts locally: a GET straight after the write came back stale, so
    // a revoked client kept appearing in the list until you reloaded —
    // which for a security control reads as "revoke did not work".
    tokens.value = tokens.value.filter((t) => t.id !== id)
  }
  catch (err) { error.value = err.message } finally { busy.value = false }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(fresh.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch { /* clipboard unavailable — the value is on screen to select */ }
}

onMounted(load)
</script>

<template>
  <section class="mt-card" data-testid="mcp-tokens-card">
    <h2 class="mt-title">Connect your AI assistant</h2>
    <p class="mt-intro">
      Use Fontem's data from Claude, ChatGPT or any MCP-capable client —
      on your own subscription. Create a token here, then follow
      <router-link to="/help#connect-ai">the setup guide</router-link>.
    </p>

    <div v-if="fresh" class="mt-fresh" data-testid="mcp-token-fresh">
      <p class="mt-fresh-warn">
        Copy this now — it is shown once and cannot be retrieved again.
      </p>
      <code class="mt-token" data-testid="mcp-token-value">{{ fresh }}</code>
      <div class="mt-fresh-actions">
        <button type="button" class="mt-btn" data-testid="mcp-token-copy" @click="copy">
          {{ copied ? 'Copied' : 'Copy' }}
        </button>
        <button type="button" class="mt-btn" data-testid="mcp-token-dismiss" @click="fresh = ''">
          Done
        </button>
      </div>
    </div>

    <ul v-if="tokens.length" class="mt-list" data-testid="mcp-tokens-list">
      <li v-for="t in tokens" :key="t.id" class="mt-item">
        <div>
          <strong>{{ t.label }}</strong>
          <span class="mt-meta">
            added {{ new Date(t.created_at).toLocaleDateString() }} ·
            {{ t.last_used_at ? `last used ${new Date(t.last_used_at).toLocaleDateString()}` : 'never used' }}
          </span>
        </div>
        <button
type="button" class="mt-btn" :disabled="busy"
                :data-testid="`mcp-revoke-${t.id}`" @click="revoke(t.id)">Revoke</button>
      </li>
    </ul>
    <p v-else class="mt-empty" data-testid="mcp-tokens-empty">No clients connected yet.</p>

    <form class="mt-form" @submit.prevent="create">
      <input
v-model="label" class="mt-input" data-testid="mcp-token-label"
             placeholder="Which client? e.g. Claude Desktop" >
      <button type="submit" class="mt-btn mt-primary" :disabled="busy" data-testid="mcp-token-create">
        {{ busy ? 'Creating…' : 'Create token' }}
      </button>
    </form>

    <p v-if="error" class="mt-error" data-testid="mcp-token-error">{{ error }}</p>
  </section>
</template>

<style scoped>
.mt-card { border: 1px solid var(--bezel-border); border-radius: 10px; padding: 1rem; margin-block: 1rem; }
.mt-title { font-size: 1rem; font-weight: 600; margin: 0 0 0.35rem; }
.mt-intro { color: var(--muted); font-size: 0.85rem; margin: 0 0 0.8rem; }
.mt-fresh { border: 1px solid var(--accent); border-radius: 8px; padding: 0.7rem; margin-bottom: 0.9rem; }
.mt-fresh-warn { font-size: 0.82rem; margin: 0 0 0.5rem; font-weight: 600; }
.mt-token { display: block; word-break: break-all; font-size: 0.8rem; padding: 0.5rem;
            background: var(--bezel); border-radius: 6px; margin-bottom: 0.5rem; }
.mt-fresh-actions { display: flex; gap: 0.4rem; }
.mt-list { list-style: none; padding: 0; margin: 0 0 0.9rem; display: flex; flex-direction: column; gap: 0.4rem; }
.mt-item { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem;
           padding: 0.5rem 0.6rem; border: 1px solid var(--bezel-border); border-radius: 8px; }
.mt-meta { color: var(--muted); font-size: 0.78rem; margin-left: 0.5rem; }
.mt-empty { color: var(--muted); font-size: 0.85rem; margin: 0 0 0.9rem; }
.mt-form { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.mt-input { flex: 1; min-width: 12rem; padding: 0.45rem 0.55rem; border: 1px solid var(--bezel-border);
            border-radius: 7px; background: var(--bg); color: var(--text); }
.mt-btn { padding: 0.45rem 0.8rem; border-radius: 7px; border: 1px solid var(--bezel-border);
          background: transparent; color: var(--text); cursor: pointer; }
.mt-primary { border-color: var(--accent); }
.mt-btn[disabled] { opacity: 0.6; cursor: default; }
.mt-error { color: var(--danger, #b3261e); font-size: 0.85rem; }
</style>
