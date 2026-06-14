<script setup>
/**
 * Set a new password from a reset link. Reads ?token=…, validates the
 * two password fields match client-side, then POSTs to /auth/reset.
 * On success the server has already revoked every session, so we send
 * the user to /login to sign in fresh.
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { resetPassword } from '../api/session.js'

const route = useRoute()
const router = useRouter()
const token = ref('')
const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref(null)
const done = ref(false)

onMounted(() => { token.value = route.query.token || '' })

const mismatch = computed(
  () => confirm.value.length > 0 && password.value !== confirm.value,
)

async function onSubmit() {
  error.value = null
  if (!token.value) {
    error.value = 'This reset link is missing its token.'
    return
  }
  if (password.value !== confirm.value) {
    error.value = "Passwords don't match."
    return
  }
  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters.'
    return
  }
  loading.value = true
  try {
    await resetPassword(token.value, password.value)
    done.value = true
    // Sessions were revoked server-side; sign in fresh after a beat.
    setTimeout(() => router.push('/login'), 1800)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card" data-testid="reset-card">
      <template v-if="!done">
        <h1 class="login-title">Set a new password</h1>
        <div v-if="error" class="login-error" data-testid="reset-error">{{ error }}</div>
        <form @submit.prevent="onSubmit">
          <input
            v-model="password"
            type="password"
            required
            placeholder="New password"
            class="login-input"
            data-testid="reset-password"
          />
          <input
            v-model="confirm"
            type="password"
            required
            placeholder="Confirm new password"
            class="login-input"
            data-testid="reset-confirm"
          />
          <p v-if="mismatch" class="login-error">Passwords don't match.</p>
          <button
            type="submit"
            class="login-btn"
            :disabled="loading || mismatch"
            data-testid="reset-submit"
          >
            {{ loading ? 'Saving…' : 'Set new password' }}
          </button>
        </form>
      </template>
      <template v-else>
        <h1 class="login-title">Password updated ✓</h1>
        <p class="login-desc" data-testid="reset-done">
          Your password has been changed and all sessions signed out.
          Redirecting you to sign in…
        </p>
      </template>
    </div>
  </div>
</template>
