/**
 * Central session store — replaces the localStorage 'gmr-token' pattern.
 *
 * Closes finding #6 of the 2026-06-11 platform security review. The
 * access token is held in memory only (a module-level ref + a
 * reactive Vue ref so views can react). The refresh token rides in an
 * httpOnly cookie the server sets — JS never sees it, so a future XSS
 * regression can't exfil long-lived auth.
 *
 * The contract:
 *
 * - {@link login}, {@link register}, {@link loginWithGoogle} hit the
 *   server, receive `{access_token, user}` in the body + a Set-Cookie
 *   header for the refresh, and stash both client-side.
 * - {@link refresh} POSTs `/auth/refresh` (browser auto-sends the
 *   cookie). On success we replace the in-memory access token and
 *   the browser replaces the cookie atomically.
 * - {@link logout} POSTs `/auth/logout` and clears local state.
 * - {@link signOutEverywhere} POSTs `/auth/sign_out_everywhere`
 *   (requires the access JWT) and clears local state.
 *
 * The `user` profile is mirrored to localStorage so the SPA shell
 * can render an authenticated layout on cold reload before
 * `/auth/refresh` returns. It's *advisory* — every privileged API
 * call re-checks server-side. Reads here are tolerant of corruption.
 */
import { reactive, computed } from 'vue'


// In-memory only. Survives navigation (SPA), dies on tab close.
let accessToken = null

const state = reactive({
  user: _readPersistedUser(),
  // Tick changes every time the in-memory access token rotates; views
  // that depend on "am I authed?" should track `isAuthed` which reads
  // this. The token itself doesn't go in `reactive()` because storing
  // it in any DOM-observable state means a wider blast radius for an
  // XSS regression that walks the Vue tree.
  tick: 0,
})


export const isAuthed = computed(() => {
  // Read the reactive tick so a bare ``setAccessToken`` (which
  // mutates the *non-reactive* module-level token) still
  // re-evaluates this computed. Authed if either signal holds:
  // - user cache populated (SSR / cold-boot optimism)
  // - access token in memory (post-login / post-refresh)
  // The ``_tick`` binding is intentional — it's how Vue's reactivity
  // tracker registers the dependency; an unused-expression `state.tick`
  // would lint-fail and `void state.tick` trips Sonar S3735.
  // eslint-disable-next-line no-unused-vars
  const _tick = state.tick
  return !!state.user || !!accessToken
})


export const currentUser = computed(() => state.user)


/** Internal: stash credentials returned from a successful auth call. */
function _accept(data) {
  accessToken = data.access_token
  if (data.user) {
    state.user = data.user
    try {
      localStorage.setItem('fontem-user', JSON.stringify(data.user))
    } catch { /* SSR or private mode — ignore */ }
  }
  state.tick++
}


function _clear() {
  accessToken = null
  state.user = null
  state.tick++
  try {
    localStorage.removeItem('fontem-user')
    // Legacy keys — wipe so a half-migrated tab can't carry a stale
    // 30-day token forward.
    localStorage.removeItem('gmr-token')
    localStorage.removeItem('gmr-user')
  } catch { /* SSR or private mode — ignore */ }
}


function _readPersistedUser() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem('fontem-user')
    if (raw) return JSON.parse(raw)
    // Legacy migration: read the pre-2026-06-13 user cache if present.
    const legacy = localStorage.getItem('gmr-user')
    if (legacy) return JSON.parse(legacy)
  } catch { /* corrupted JSON — treat as anonymous */ }
  return null
}


/** Returns the current access token, or null. Used by the API client. */
export function getAccessToken() {
  return accessToken
}


export async function login(email, password) {
  const res = await fetch('/capi/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `HTTP ${res.status}`)
  }
  _accept(await res.json())
}


export async function register(email, password, name) {
  const res = await fetch('/capi/auth/register', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `HTTP ${res.status}`)
  }
  _accept(await res.json())
}


export async function loginWithGoogle(credential) {
  const res = await fetch('/capi/auth/google', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `HTTP ${res.status}`)
  }
  _accept(await res.json())
}


// Concurrent refresh guard. If three API calls all 401 at once, we
// want one /auth/refresh round trip — not three competing rotations
// that would force two of them to lose the family race.
let refreshInFlight = null


export function refresh() {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    try {
      const res = await fetch('/capi/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        _clear()
        return false
      }
      _accept(await res.json())
      return true
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}


export async function logout() {
  try {
    await fetch('/capi/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
  } catch { /* network failure on logout shouldn't trap the user */ }
  _clear()
}


export async function signOutEverywhere() {
  if (!accessToken) {
    _clear()
    return
  }
  try {
    await fetch('/capi/auth/sign_out_everywhere', {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } finally {
    _clear()
  }
}


// Internal-only: tests and the API client need to reset the in-memory
// access token between calls. Not exported on the public surface.
export const _internal = {
  setAccessToken(t) { accessToken = t; state.tick++ },
  setUserForTests(u) {
    state.user = u
    if (u) {
      try { localStorage.setItem('fontem-user', JSON.stringify(u)) } catch { /* ignore */ }
    }
    state.tick++
  },
  getRefreshInFlight() { return refreshInFlight },
  clearForTests() { _clear(); refreshInFlight = null },
}
