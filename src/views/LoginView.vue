<script setup>
import { isAuthed, login, register, loginWithGoogle, logout } from '../api/session.js'
import { ref, computed, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'

const router = useRouter()
const error = ref(null)
const loading = ref(false)
const manualToken = ref('')
const mode = ref('login') // 'login' | 'register'
const loginEmail = ref('')
const loginPassword = ref('')
const regName = ref('')
const regEmail = ref('')
const regPassword = ref('')
const regPasswordConfirm = ref('')

// Live mismatch indicator — only "true" once both fields have been
// touched, so an empty confirm field on first render doesn't flash a
// red error.
const passwordMismatch = computed(
  () => regPasswordConfirm.value.length > 0
        && regPassword.value !== regPasswordConfirm.value,
)

// Fontem Google OAuth client (fontem.eu brand-holder account, ID-token
// flow only — no client secret touches the browser or the backend).
// Rotate by issuing a new OAuth client in Google Cloud and updating
// both this constant AND the default in gmr-community-api's auth.py.
const GOOGLE_CLIENT_ID =
  '1055538305131-87jn8h6gunj55q1akfdkuv6kpg43ld4t.apps.googleusercontent.com'

const hasToken = computed(() => isAuthed.value)

onMounted(() => {
  if (hasToken.value) return

  /* Wait for the Google GSI script to load, then render the button */
  waitForGoogle(() => {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: onGoogleResponse,
    })
    window.google.accounts.id.renderButton(
      document.getElementById('google-signin-btn'),
      {
        type: 'standard',
        shape: 'rectangular',
        theme: 'outline',
        text: 'signin_with',
        size: 'large',
        width: 320,
      },
    )
  })
})

function waitForGoogle(cb, attempts = 0) {
  if (window.google?.accounts?.id) {
    cb()
  } else if (attempts < 50) {
    setTimeout(() => waitForGoogle(cb, attempts + 1), 100)
  }
}

async function onGoogleResponse(response) {
  error.value = null
  loading.value = true
  try {
    await loginWithGoogle(response.credential)
    window.location.href = '/'
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function handleTokenSignIn() {
  // Deprecated post-2026-06-13 session migration — the access token
  // now lives in memory only and there's no userspace path to inject
  // one. Surface a helpful error rather than silently breaking.
  error.value = (
    'Manual-token sign-in is no longer supported. ' +
    'Use email + password or Google sign-in.'
  )
}

async function handleLocalLogin() {
  error.value = null
  loading.value = true
  try {
    await login(loginEmail.value, loginPassword.value)
    window.location.href = '/'
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  error.value = null
  // Reject mismatched passwords before hitting the network. The
  // backend can't tell — it only receives `password` — so this is
  // the only place the second field's contract is enforced.
  if (regPassword.value !== regPasswordConfirm.value) {
    error.value = "Passwords don't match"
    return
  }
  loading.value = true
  try {
    await register(regEmail.value, regPassword.value, regName.value)
    window.location.href = '/'
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function handleSignOut() {
  await logout()
  window.location.href = '/'
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <!-- Already signed in -->
      <template v-if="hasToken">
        <h1 class="login-title">{{ $t('login.youre_signed_in') }}</h1>
        <p class="login-desc">{{ $t('login.you_already_have_an_active_session') }}</p>
        <div class="login-actions">
          <button class="btn-primary" @click="router.push('/')">{{ $t('login.go_to_home') }}</button>
          <button class="btn-secondary" @click="handleSignOut">{{ $t('app.sign_out') }}</button>
        </div>
      </template>

      <!-- Sign in -->
      <template v-else>
        <h1 class="login-title">Sign in to Fontem</h1>
        <p class="login-desc">
          Sign in to start creating data stories, raising issues, and collaborating with the community.
        </p>

        <div v-if="error" class="login-error" data-testid="login-error">{{ error }}</div>
        <div v-if="loading" class="login-loading">Signing in...</div>

        <!-- Mode tabs -->
        <div class="auth-tabs">
          <button :class="{ active: mode === 'login' }" @click="mode = 'login'">Sign in</button>
          <button :class="{ active: mode === 'register' }" @click="mode = 'register'">Create account</button>
        </div>

        <!-- Login form -->
        <form v-if="mode === 'login'" class="auth-form" @submit.prevent="handleLocalLogin">
          <input v-model="loginEmail" type="email" class="login-input" placeholder="Email" required data-testid="login-email" />
          <input v-model="loginPassword" type="password" class="login-input" placeholder="Password" required data-testid="login-password" />
          <button type="submit" class="btn-primary" :disabled="loading" data-testid="login-submit">
            {{ loading ? 'Signing in...' : 'Sign in' }}
          </button>
          <RouterLink to="/forgot-password" class="login-forgot-link" data-testid="login-forgot-link">
            Forgot your password?
          </RouterLink>
        </form>

        <!-- Register form -->
        <form v-if="mode === 'register'" class="auth-form" @submit.prevent="handleRegister">
          <input v-model="regName" type="text" class="login-input" placeholder="Full name" required data-testid="reg-name" />
          <input v-model="regEmail" type="email" class="login-input" placeholder="Email" required data-testid="reg-email" />
          <input v-model="regPassword" type="password" class="login-input" placeholder="Password (min 8 chars)" required minlength="8" data-testid="reg-password" />
          <input v-model="regPasswordConfirm" type="password" class="login-input" placeholder="Confirm password" required minlength="8" data-testid="reg-password-confirm" />
          <p
            v-if="passwordMismatch"
            class="login-error"
            data-testid="reg-password-mismatch"
          >Passwords don't match</p>
          <button
            type="submit"
            class="btn-primary"
            :disabled="loading || passwordMismatch"
            data-testid="reg-submit"
          >
            {{ loading ? 'Creating account...' : 'Create account' }}
          </button>
        </form>

        <div class="login-divider"><span>or continue with</span></div>

        <!-- Google button -->
        <div id="google-signin-btn" class="google-btn-wrapper" data-testid="google-signin-btn"></div>

        <!-- Token entry (dev) -->
        <details class="token-details">
          <summary class="token-summary">Sign in with token</summary>
          <form class="token-form" @submit.prevent="handleTokenSignIn">
            <input v-model="manualToken" type="password" class="login-input" placeholder="Paste a JWT token" autocomplete="off" data-testid="token-input" />
            <button type="submit" class="btn-secondary btn-sm" data-testid="token-submit">Go</button>
          </form>
        </details>
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

.auth-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

.auth-tabs button {
  flex: 1;
  padding: 0.5rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
}

.auth-tabs button.active {
  color: var(--text);
  border-bottom-color: var(--accent);
  font-weight: 600;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 0.5rem;
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

.login-loading {
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 1rem;
}

.google-btn-wrapper {
  display: flex;
  justify-content: center;
  min-height: 44px;
}

.login-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1.5rem 0;
  font-size: 0.75rem;
  color: var(--muted);
}

.login-divider::before,
.login-divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--border);
}

.token-details { margin-top: 0; }

.token-summary {
  font-size: 0.8rem;
  color: var(--muted);
  cursor: pointer;
  user-select: none;
}

.token-summary:hover { color: var(--text); }

.token-form {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.login-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.8rem;
  background: var(--bg);
  color: var(--text);
  outline: none;
}

.login-input:focus { border-color: var(--accent); }

.btn-primary {
  padding: 0.6rem 1.2rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary:hover { opacity: 0.9; }

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

.btn-sm {
  padding: 0.4rem 0.85rem;
  font-size: 0.8rem;
}

.login-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

</style>
