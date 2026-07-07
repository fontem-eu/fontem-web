<script setup>
/**
 * Request a password-reset link. The endpoint is enumeration-safe —
 * it always succeeds — so we always show the same "check your email"
 * confirmation regardless of whether the address matched an account.
 */
import { ref } from 'vue'
import { forgotPassword } from '../api/session.js'

const email = ref('')
const submitted = ref(false)
const loading = ref(false)
const error = ref(null)

async function onSubmit() {
  error.value = null
  loading.value = true
  try {
    await forgotPassword(email.value)
    // Always land here — we never reveal whether the email existed.
    submitted.value = true
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card" data-testid="forgot-card">
      <template v-if="!submitted">
        <h1 class="login-title">{{ $t('forgot_password.reset_your_password') }}</h1>
        <p class="login-desc">
          {{ $t('forgot_password.enter_your_email_send_link') }}
        </p>
        <div v-if="error" class="login-error">{{ error }}</div>
        <form @submit.prevent="onSubmit">
          <input
            v-model="email"
            type="email"
            required
            :placeholder="$t('forgot_password.you_example_com')"
            class="login-input"
            data-testid="forgot-email"
          />
          <button
            type="submit"
            class="login-btn"
            :disabled="loading"
            data-testid="forgot-submit"
          >
            {{ loading ? $t('forgot_password.sending') : $t('forgot_password.send_reset_link') }}
          </button>
        </form>
      </template>
      <template v-else>
        <h1 class="login-title">{{ $t('forgot_password.check_your_email') }}</h1>
        <p class="login-desc" data-testid="forgot-confirmation">
          {{ $t('forgot_password.if_account_exists_sent_link') }}
        </p>
      </template>
    </div>
  </div>
</template>
