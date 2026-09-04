<script setup>
/**
 * Connect your own AI client to Dargle.
 *
 * The inversion: rather than Dargle hosting a model and paying for it,
 * you point the client you already pay for at Dargle's tools. Your
 * subscription, your quota.
 *
 * The token is shown exactly once. That is deliberate and worth the
 * inconvenience — a token you can re-read later is one an attacker can
 * re-read later.
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { listMcpTokens, createMcpToken, revokeMcpToken } from '../api/community.js'

const { locale } = useI18n()

// toLocaleDateString() with no argument follows the browser, not the site.
// Reading the site locale keeps a French page from printing US dates.
const fmtDate = (iso) => new Date(iso).toLocaleDateString(locale.value)

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
    <h2 class="mt-title">{{ $t('mcp_tokens.title') }}</h2>
    <p class="mt-intro">
      {{ $t('mcp_tokens.intro_pre') }}
      <router-link to="/help#connect-ai">{{ $t('mcp_tokens.intro_link') }}</router-link>.
    </p>

    <div v-if="fresh" class="mt-fresh" data-testid="mcp-token-fresh">
      <p class="mt-fresh-warn">{{ $t('mcp_tokens.fresh_warn') }}</p>
      <code class="mt-token" data-testid="mcp-token-value">{{ fresh }}</code>
      <div class="mt-fresh-actions">
        <button type="button" class="mt-btn" data-testid="mcp-token-copy" @click="copy">
          {{ copied ? $t('mcp_tokens.copied') : $t('mcp_tokens.copy') }}
        </button>
        <button type="button" class="mt-btn" data-testid="mcp-token-dismiss" @click="fresh = ''">
          {{ $t('mcp_tokens.done') }}
        </button>
      </div>
    </div>

    <ul v-if="tokens.length" class="mt-list" data-testid="mcp-tokens-list">
      <li v-for="t in tokens" :key="t.id" class="mt-item">
        <div>
          <strong>{{ t.label }}</strong>
          <span class="mt-meta">
            {{ $t('mcp_tokens.added', { date: fmtDate(t.created_at) }) }} ·
            {{ t.last_used_at
              ? $t('mcp_tokens.last_used', { date: fmtDate(t.last_used_at) })
              : $t('mcp_tokens.never_used') }}
          </span>
        </div>
        <button
          type="button" class="mt-btn" :disabled="busy"
          :data-testid="`mcp-revoke-${t.id}`" @click="revoke(t.id)"
        >{{ $t('mcp_tokens.revoke') }}</button>
      </li>
    </ul>
    <p v-else class="mt-empty" data-testid="mcp-tokens-empty">{{ $t('mcp_tokens.empty') }}</p>

    <form class="mt-form" @submit.prevent="create">
      <input
        v-model="label" class="mt-input" data-testid="mcp-token-label"
        :placeholder="$t('mcp_tokens.label_placeholder')"
      >
      <button type="submit" class="mt-btn mt-primary" :disabled="busy" data-testid="mcp-token-create">
        {{ busy ? $t('mcp_tokens.creating') : $t('mcp_tokens.create') }}
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
