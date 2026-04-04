<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const token = ref('')
const error = ref(null)
const loading = ref(false)

const hasToken = computed(() => !!localStorage.getItem('gmr-token'))

async function handleSignIn() {
  error.value = null
  const trimmed = token.value.trim()
  if (!trimmed) {
    error.value = 'Please enter a token.'
    return
  }

  loading.value = true
  try {
    /* Validate by calling /capi/users/me — if 401, token is bad */
    const res = await fetch('/capi/users/me', {
      headers: { Authorization: `Bearer ${trimmed}` },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(res.status === 401 ? 'Invalid or expired token.' : `HTTP ${res.status}: ${text}`)
    }
    localStorage.setItem('gmr-token', trimmed)
    router.push('/')
    /* Reload to update all reactive hasToken checks */
    window.location.href = '/'
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function handleSignOut() {
  localStorage.removeItem('gmr-token')
  window.location.href = '/'
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <!-- Already signed in -->
      <template v-if="hasToken">
        <h1 class="login-title">You're signed in</h1>
        <p class="login-desc">You already have an active session.</p>
        <div class="login-actions">
          <button class="btn-primary" @click="router.push('/')">Go to Home</button>
          <button class="btn-secondary" @click="handleSignOut">Sign out</button>
        </div>
      </template>

      <!-- Sign in form -->
      <template v-else>
        <h1 class="login-title">Sign in to GMR</h1>
        <p class="login-desc">
          Enter your access token to start creating reports, raising issues, and collaborating with the community.
        </p>

        <div v-if="error" class="login-error" data-testid="login-error">{{ error }}</div>

        <form class="login-form" @submit.prevent="handleSignIn">
          <label class="login-label" for="token-input">Access token</label>
          <input
            id="token-input"
            v-model="token"
            type="password"
            class="login-input"
            placeholder="Paste your JWT token"
            autocomplete="off"
            data-testid="token-input"
          />
          <button
            type="submit"
            class="btn-primary"
            :disabled="loading"
            data-testid="sign-in-submit"
          >
            {{ loading ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>

        <div class="login-footer">
          <p>
            Don't have an account?
            <span class="login-hint">
              SSO via Zitadel is coming soon. Contact your admin for an access token.
            </span>
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  padding: 4rem 1rem;
}

.login-card {
  width: 100%;
  max-width: 400px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 2rem;
  background: var(--surface);
}

.login-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 0.5rem;
}

.login-desc {
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.5;
  margin: 0 0 1.5rem;
}

.login-error {
  padding: 0.5rem 0.75rem;
  margin-bottom: 1rem;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 4px;
  font-size: 0.8rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.login-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
}

.login-input {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.85rem;
  background: var(--bg);
  color: var(--text);
  outline: none;
  transition: border-color 0.15s;
}

.login-input:focus {
  border-color: var(--accent);
}

.btn-primary {
  padding: 0.6rem 1.2rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-secondary {
  padding: 0.6rem 1.2rem;
  background: none;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-secondary:hover {
  border-color: var(--accent);
  color: var(--text);
}

.login-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

.login-footer {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  font-size: 0.8rem;
  color: var(--muted);
}

.login-footer p { margin: 0; }

.login-hint {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--muted);
}
</style>
