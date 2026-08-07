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
  listAssistantModels,
  chooseAssistantModel,
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
const builtinModel = ref('')
const models = ref([])
const selectedModel = ref('')
const modelBusy = ref(false)
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
    // Null when the deployment has no local server wired up — then the
    // built-in row hides itself and a key really is required again.
    builtinModel.value = data.builtin?.model || ''
    // Only meaningful when the built-in is in use; a stored key overrides
    // it entirely, so the selector hides itself in that case.
    if (builtinModel.value) {
      const m = await listAssistantModels()
      models.value = m.models || []
      selectedModel.value = m.selected || ''
    }
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

async function pickModel(id) {
  if (id === selectedModel.value || modelBusy.value) return
  const previous = selectedModel.value
  selectedModel.value = id          // optimistic: the control must feel instant
  modelBusy.value = true
  error.value = ''
  try {
    const res = await chooseAssistantModel(id)
    selectedModel.value = res.selected || id
  } catch (err) {
    selectedModel.value = previous  // put it back rather than lying
    error.value = err.message
  } finally {
    modelBusy.value = false
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

    <!-- The built-in is what you get with no key, so it is stated as a
         fact rather than offered as a choice. It stops being active the
         moment a key is stored, and the Remove button on that key is the
         way back — there is no separate selector to keep in sync. -->
    <div
      v-if="builtinModel"
      class="pk-builtin" :class="{ 'pk-builtin--active': !credentials.length }"
      data-testid="provider-builtin"
    >
      <div>
        <strong>{{ $t('provider_keys.builtin_title') }}</strong>
        <span class="pk-builtin-model">{{ builtinModel }}</span>
      </div>
      <span
        v-if="!credentials.length" class="pk-badge" data-testid="provider-builtin-active"
      >{{ $t('provider_keys.builtin_active') }}</span>
    </div>
    <!-- Only meaningful while the built-in is what runs. A stored key
         overrides it entirely, so offering a choice then would be a
         control that does nothing. -->
    <div v-if="builtinModel && models.length > 1 && !credentials.length"
         class="pk-models" data-testid="builtin-model-choice">
      <button
        v-for="m in models" :key="m.id" type="button"
        class="pk-model-opt"
        :class="{ 'pk-model-opt--on': m.id === selectedModel }"
        :disabled="modelBusy"
        :aria-pressed="m.id === selectedModel"
        :data-testid="`builtin-model-${m.id}`"
        @click="pickModel(m.id)"
      >
        <span class="pk-model-name">{{ m.label }}</span>
        <span class="pk-model-rate">
          {{ $t('provider_keys.model_rate', { n: m.tokens_per_second }) }}
          <template v-if="m.context_tokens < 8192">
            · {{ $t('provider_keys.model_short_context', { n: m.context_tokens }) }}
          </template>
        </span>
      </button>
    </div>

    <p v-if="builtinModel" class="pk-builtin-note">
      {{ credentials.length
        ? $t('provider_keys.builtin_superseded')
        : $t('provider_keys.builtin_note') }}
    </p>

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
    <p v-else-if="!builtinModel" class="pk-empty" data-testid="provider-keys-empty">
      {{ $t('provider_keys.empty') }}
    </p>

    <h3 class="pk-subhead">{{ $t('provider_keys.byo_title') }}</h3>
    <p class="pk-intro">{{ $t('provider_keys.byo_intro') }}</p>

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
.pk-models { display: flex; gap: 0.4rem; margin: 0.5rem 0 0.2rem; flex-wrap: wrap; }
.pk-model-opt { display: flex; flex-direction: column; align-items: flex-start; gap: 0.1rem;
                padding: 0.4rem 0.7rem; border: 1px solid var(--bezel-border);
                border-radius: 8px; background: none; cursor: pointer; text-align: left; }
.pk-model-opt--on { border-color: var(--accent); }
.pk-model-opt:disabled { opacity: 0.6; cursor: default; }
.pk-model-name { font-size: 0.85rem; font-weight: 600; }
.pk-model-rate { font-size: 0.72rem; color: var(--muted); }
.pk-builtin { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem;
               padding: 0.55rem 0.65rem; border: 1px solid var(--bezel-border); border-radius: 8px; }
.pk-builtin--active { border-color: var(--accent); }
.pk-builtin-model { color: var(--muted); font-size: 0.78rem; margin-left: 0.5rem; }
.pk-builtin-note { color: var(--muted); font-size: 0.8rem; margin: 0.4rem 0 0.9rem; }
.pk-badge { font-size: 0.72rem; font-weight: 600; color: var(--accent);
            border: 1px solid var(--accent); border-radius: 999px; padding: 0.1rem 0.5rem; }
.pk-subhead { font-size: 0.9rem; font-weight: 600; margin: 1rem 0 0.25rem; }
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
