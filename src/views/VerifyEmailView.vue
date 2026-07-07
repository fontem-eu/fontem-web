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
        <h1 class="login-title">{{ $t('verify_email.confirming_your_email') }}</h1>
        <p class="login-desc">{{ $t('verify_email.one_moment') }}</p>
      </template>
      <template v-else-if="status === 'success'">
        <h1 class="login-title">{{ $t('verify_email.email_confirmed') }} ✓</h1>
        <p class="login-desc">{{ $t('verify_email.your_account_is_verified') }}</p>
        <div class="login-actions">
          <button class="login-btn" data-testid="verify-email-continue" @click="goHome">{{ $t('verify_email.continue_to_fontem') }}</button>
        </div>
      </template>
      <template v-else>
        <h1 class="login-title">{{ $t('verify_email.couldnt_confirm_your_email') }}</h1>
        <p class="login-error" data-testid="verify-email-error">{{ message }}</p>
        <p class="login-desc">{{ $t('verify_email.the_link_may_have_expired') }}</p>
        <div class="login-actions">
          <button class="login-btn" @click="goHome">{{ $t('verify_email.go_to_fontem') }}</button>
        </div>
      </template>
    </div>
  </div>
</template>
