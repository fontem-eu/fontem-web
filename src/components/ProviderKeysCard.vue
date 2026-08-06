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
import { useI18n } from 'vue-i18n'
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
const { t, locale } = useI18n()

// Without an explicit locale, toLocaleDateString() follows the browser
// rather than the site, so a French page printed dates in the user's OS
// format instead of the one they chose here.
const fmtDate = (iso) => new Date(iso).toLocaleDateString(locale.value)

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
    notice.value = t('provider_keys.saved_notice')
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
    notice.value = t('provider_keys.removed_notice')
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
    <h2 class="pk-title">{{ $t('provider_keys.title') }}</h2>
    <p class="pk-intro">{{ $t('provider_keys.intro') }}</p>

    <ul v-if="credentials.length" class="pk-list" data-testid="provider-keys-list">
      <li v-for="c in credentials" :key="c.provider" class="pk-item">
        <div>
          <strong>{{ PROVIDER_LABELS[c.provider] || c.provider }}</strong>
          <span class="pk-fp" data-testid="provider-fingerprint">
            {{ $t('provider_keys.fingerprint', { fp: c.fingerprint }) }}
          </span>
          <span v-if="c.model" class="pk-model">{{ c.model }}</span>
          <span class="pk-used">
            {{ c.last_used_at
              ? $t('provider_keys.last_used', { date: fmtDate(c.last_used_at) })
              : $t('provider_keys.not_used') }}
          </span>
        </div>
        <button
          type="button" class="pk-remove" :disabled="busy"
          :data-testid="`remove-${c.provider}`" @click="remove(c.provider)"
        >{{ $t('provider_keys.remove') }}</button>
      </li>
    </ul>
    <p v-else class="pk-empty" data-testid="provider-keys-empty">
      {{ $t('provider_keys.empty') }}
    </p>

    <form class="pk-form" @submit.prevent="save">
      <label class="pk-label">
        {{ $t('provider_keys.provider') }}
        <select v-model="provider" class="pk-input" data-testid="provider-select">
          <option v-for="p in supported" :key="p" :value="p">
            {{ PROVIDER_LABELS[p] || p }}
          </option>
        </select>
      </label>
      <label class="pk-label">
        {{ $t('provider_keys.api_key') }}
        <input
          v-model="apiKey" type="password" autocomplete="off"
          class="pk-input" data-testid="provider-key-input"
          :placeholder="$t('provider_keys.api_key_placeholder')"
        >
      </label>
      <label class="pk-label">
        {{ $t('provider_keys.model') }} <span class="pk-optional">{{ $t('provider_keys.optional') }}</span>
        <input
          v-model="model" type="text" class="pk-input"
          data-testid="provider-model-input" :placeholder="$t('provider_keys.model_placeholder')"
        >
      </label>
      <button type="submit" class="pk-save" :disabled="busy" data-testid="provider-key-save">
        {{ busy ? $t('provider_keys.saving') : $t('provider_keys.save') }}
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
