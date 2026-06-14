<script setup>
/**
 * Persistent banner shown when the signed-in user hasn't confirmed
 * their email. Participation is server-gated ("Required" verification),
 * so this is the user-facing explanation + a one-click resend.
 *
 * Hidden for anonymous visitors and verified accounts (incl.
 * grandfathered + OAuth users, whose email_verified is true).
 */
import { ref } from 'vue'
import { isAuthed, emailVerified, resendVerification } from '../api/session.js'

const sending = ref(false)
const sent = ref(false)
const error = ref(null)

async function onResend() {
  error.value = null
  sending.value = true
  try {
    await resendVerification()
    sent.value = true
  } catch (err) {
    error.value = err.message
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <output
    v-if="isAuthed && !emailVerified"
    class="verify-banner"
    data-testid="verify-email-banner"
  >
    <span class="verify-banner-text">
      Confirm your email to publish, comment, and follow topics. Check
      your inbox for the link.
    </span>
    <span v-if="sent" class="verify-banner-sent" data-testid="verify-banner-sent">
      Sent — check your inbox.
    </span>
    <button
      v-else
      class="verify-banner-btn"
      :disabled="sending"
      data-testid="verify-banner-resend"
      @click="onResend"
    >
      {{ sending ? 'Sending…' : 'Resend email' }}
    </button>
    <span v-if="error" class="verify-banner-error">{{ error }}</span>
  </output>
</template>

<style scoped>
.verify-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.6rem 1rem;
  background: var(--color-warning-bg, #fff4e5);
  color: var(--color-warning-fg, #7a4a00);
  border-bottom: 1px solid var(--color-warning-border, #f0d2a0);
  font-size: 0.9rem;
}
.verify-banner-text { flex: 1 1 auto; }
.verify-banner-btn {
  flex: 0 0 auto;
  padding: 0.3rem 0.8rem;
  border: 1px solid currentColor;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.verify-banner-btn:disabled { opacity: 0.6; cursor: default; }
.verify-banner-sent { font-weight: 600; }
.verify-banner-error { color: var(--color-danger, #b00020); }
</style>
