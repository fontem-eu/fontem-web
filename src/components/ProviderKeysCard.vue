<script setup>
/**
 * Bring-your-own LLM provider keys.
 *
 * The platform used to pay for everyone's inference through one key. This
 * is where a user supplies their own instead — their key, their bill,
 * their rate limits.
 *
 * The key is write-only: it is sent once and never read back. What comes
 * back is a short hash so you can tell *which* key is stored without the
 * UI ever holding key material. Deliberately not the last four characters,
 * because the tail of an API key is still key material.
 */
import { ref, onMounted } from 'vue'
import {
  listProviderCredentials,
  putProviderCredential,
  deleteProviderCredential,
} from '../api/community.js'

const PROVIDER_LABELS = {
  anthropic: 'Anthropic (Claude)',
  mistral: 'Mistral',
  openai: 'OpenAI',
}

const supported = ref([])
const credentials = ref([])
const provider = ref('anthropic')
const apiKey = ref('')
const model = ref('')
const busy = ref(false)
const error = ref('')
const notice = ref('')

async function load() {
  try {
    const data = await listProviderCredentials()
    supported.value = data.supported || []
    credentials.value = data.credentials || []
    if (supported.value.length && !supported.value.includes(provider.value)) {
      provider.value = supported.value[0]
    }
  } catch (err) {
    error.value = err.message
  }
}

async function save() {
  error.value = ''
  notice.value = ''
  if (!apiKey.value.trim()) {
    error.value = 'Enter an API key.'
    return
  }
  busy.value = true
  try {
    await putProviderCredential({
      provider: provider.value,
      apiKey: apiKey.value.trim(),
      model: model.value.trim(),
    })
    // Clear immediately: there is no reason for the key to stay in a DOM
    // node once it has been sent.
    apiKey.value = ''
    notice.value = 'Key saved. The assistant will use it from your next message.'
    await load()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

async function remove(p) {
  error.value = ''
  notice.value = ''
  busy.value = true
  try {
    await deleteProviderCredential(p)
    notice.value = 'Key removed.'
    await load()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="pk-card" data-testid="provider-keys-card">
    <h2 class="pk-title">Assistant provider</h2>
    <p class="pk-intro">
      The assistant runs on your own LLM account. Add a key from Anthropic,
      Mistral or OpenAI — usage is billed to you by them, not by Fontem.
      Keys are stored encrypted and are never shown again after saving.
    </p>

    <ul v-if="credentials.length" class="pk-list" data-testid="provider-keys-list">
      <li v-for="c in credentials" :key="c.provider" class="pk-item">
        <div>
          <strong>{{ PROVIDER_LABELS[c.provider] || c.provider }}</strong>
          <span class="pk-fp" data-testid="provider-fingerprint">key #{{ c.fingerprint }}</span>
          <span v-if="c.model" class="pk-model">{{ c.model }}</span>
          <span class="pk-used">
            {{ c.last_used_at ? `last used ${new Date(c.last_used_at).toLocaleDateString()}` : 'not used yet' }}
          </span>
        </div>
        <button
          type="button" class="pk-remove" :disabled="busy"
          :data-testid="`remove-${c.provider}`" @click="remove(c.provider)"
        >Remove</button>
      </li>
    </ul>
    <p v-else class="pk-empty" data-testid="provider-keys-empty">
      No provider configured — the assistant is unavailable until you add one.
    </p>

    <form class="pk-form" @submit.prevent="save">
      <label class="pk-label">
        Provider
        <select v-model="provider" class="pk-input" data-testid="provider-select">
          <option v-for="p in supported" :key="p" :value="p">
            {{ PROVIDER_LABELS[p] || p }}
          </option>
        </select>
      </label>
      <label class="pk-label">
        API key
        <input
          v-model="apiKey" type="password" autocomplete="off"
          class="pk-input" data-testid="provider-key-input"
          placeholder="Paste your key"
        >
      </label>
      <label class="pk-label">
        Model <span class="pk-optional">(optional)</span>
        <input
          v-model="model" type="text" class="pk-input"
          data-testid="provider-model-input" placeholder="Provider default"
        >
      </label>
      <button type="submit" class="pk-save" :disabled="busy" data-testid="provider-key-save">
        {{ busy ? 'Saving…' : 'Save key' }}
      </button>
    </form>

    <p v-if="error" class="pk-error" data-testid="provider-key-error">{{ error }}</p>
    <p v-if="notice" class="pk-notice" data-testid="provider-key-notice">{{ notice }}</p>
  </section>
</template>

<style scoped>
.pk-card { border: 1px solid var(--bezel-border); border-radius: 10px; padding: 1rem; margin-block: 1rem; }
.pk-title { font-size: 1rem; font-weight: 600; margin: 0 0 0.35rem; }
.pk-intro { color: var(--muted); font-size: 0.85rem; margin: 0 0 0.8rem; }
.pk-list { list-style: none; padding: 0; margin: 0 0 0.9rem; display: flex; flex-direction: column; gap: 0.4rem; }
.pk-item { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem;
           padding: 0.5rem 0.6rem; border: 1px solid var(--bezel-border); border-radius: 8px; }
.pk-fp, .pk-model, .pk-used { color: var(--muted); font-size: 0.78rem; margin-left: 0.5rem; }
.pk-empty { color: var(--muted); font-size: 0.85rem; margin: 0 0 0.9rem; }
.pk-form { display: flex; flex-direction: column; gap: 0.6rem; }
.pk-label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; }
.pk-optional { color: var(--muted); font-weight: 400; }
.pk-input { padding: 0.45rem 0.55rem; border: 1px solid var(--bezel-border); border-radius: 7px;
            background: var(--bg); color: var(--text); }
.pk-save, .pk-remove { padding: 0.45rem 0.8rem; border-radius: 7px; border: 1px solid var(--bezel-border);
                       background: transparent; color: var(--text); cursor: pointer; }
.pk-save[disabled], .pk-remove[disabled] { opacity: 0.6; cursor: default; }
.pk-error { color: var(--danger, #b3261e); font-size: 0.85rem; }
.pk-notice { color: var(--muted); font-size: 0.85rem; }
</style>
