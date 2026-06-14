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
        <h1 class="login-title">Reset your password</h1>
        <p class="login-desc">
          Enter your email and we'll send you a link to set a new password.
        </p>
        <div v-if="error" class="login-error">{{ error }}</div>
        <form @submit.prevent="onSubmit">
          <input
            v-model="email"
            type="email"
            required
            placeholder="you@example.com"
            class="login-input"
            data-testid="forgot-email"
          />
          <button
            type="submit"
            class="login-btn"
            :disabled="loading"
            data-testid="forgot-submit"
          >
            {{ loading ? 'Sending…' : 'Send reset link' }}
          </button>
        </form>
      </template>
      <template v-else>
        <h1 class="login-title">Check your email</h1>
        <p class="login-desc" data-testid="forgot-confirmation">
          If an account exists for that address, we've sent a link to
          reset your password. It expires in one hour.
        </p>
      </template>
    </div>
  </div>
</template>
