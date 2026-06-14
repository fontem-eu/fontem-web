<script setup>
/**
 * Verify-email landing. The verification email links here with a
 * ?token=… query; we POST it to /auth/verify-email on mount and show
 * the outcome. On success the session is refreshed so the
 * "confirm your email" banner disappears across the app.
 */
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { verifyEmail } from '../api/session.js'

const route = useRoute()
const router = useRouter()
const status = ref('verifying') // 'verifying' | 'success' | 'error'
const message = ref('')

onMounted(async () => {
  const token = route.query.token
  if (!token) {
    status.value = 'error'
    message.value = 'This link is missing its verification token.'
    return
  }
  try {
    await verifyEmail(token)
    status.value = 'success'
  } catch (err) {
    status.value = 'error'
    message.value = err.message
  }
})

function goHome() { router.push('/') }
</script>

<template>
  <div class="login-page">
    <div class="login-card" data-testid="verify-email-card">
      <template v-if="status === 'verifying'">
        <h1 class="login-title">Confirming your email…</h1>
        <p class="login-desc">One moment.</p>
      </template>
      <template v-else-if="status === 'success'">
        <h1 class="login-title">Email confirmed ✓</h1>
        <p class="login-desc">
          Your account is verified. You can now publish stories, comment,
          and follow topics.
        </p>
        <div class="login-actions">
          <button class="login-btn" data-testid="verify-email-continue" @click="goHome">
            Continue to Fontem
          </button>
        </div>
      </template>
      <template v-else>
        <h1 class="login-title">Couldn't confirm your email</h1>
        <p class="login-error" data-testid="verify-email-error">{{ message }}</p>
        <p class="login-desc">
          The link may have expired or already been used. Sign in and
          request a new verification email from the banner at the top.
        </p>
        <div class="login-actions">
          <button class="login-btn" @click="goHome">Go to Fontem</button>
        </div>
      </template>
    </div>
  </div>
</template>
