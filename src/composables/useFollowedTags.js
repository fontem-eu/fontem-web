/**
 * Followed-tags state, transparently backed by either:
 *
 *   - **localStorage** for unauthenticated users (`gmr-followed-tags`)
 *   - the **community API** (`/me/followed-tags`) for authenticated ones
 *
 * The split lets people experiment with browse-by-tag before signing
 * in, then have those choices migrated to the server on first login
 * (see `migrateLocalToServer`). Same composable, two storage strategies.
 *
 * Caps mirror the backend (50). Slug normalisation also matches.
 */
import { ref, readonly } from 'vue'
import {
  listFollowedTags as apiList,
  followTag as apiFollow,
  unfollowTag as apiUnfollow,
} from '../api/community.js'

const STORAGE_KEY = 'gmr-followed-tags'
export const MAX_FOLLOWED_TAGS = 50

// Module-level singleton — every component that calls
// `useFollowedTags()` shares the same reactive state, so flipping
// follow state in one place reflows the carousel chip strip,
// header avatar, etc., without prop-drilling.
const tags = ref([])
const ready = ref(false)
let initPromise = null

function isAuthed() {
  if (typeof localStorage === 'undefined') return false
  return !!localStorage.getItem('gmr-token')
}

function readLocal() {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : []
  } catch {
    return []
  }
}

function writeLocal(value) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Quota or private-mode — silently degrade. The chip strip will
    // still toggle in-memory; nothing persists across reloads.
  }
}

function normaliseTag(raw) {
  if (!raw) return ''
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
}

async function init() {
  if (initPromise) return initPromise
  initPromise = (async () => {
    if (isAuthed()) {
      try {
        const r = await apiList()
        tags.value = Array.isArray(r?.tags) ? r.tags : []
      } catch {
        tags.value = []
      }
    } else {
      tags.value = readLocal()
    }
    ready.value = true
  })()
  return initPromise
}

async function follow(rawTag) {
  const slug = normaliseTag(rawTag)
  if (!slug) return
  if (tags.value.includes(slug)) return
  if (tags.value.length >= MAX_FOLLOWED_TAGS) return

  if (isAuthed()) {
    try {
      const r = await apiFollow(slug)
      const stored = r?.tag || slug
      if (!tags.value.includes(stored)) tags.value = [...tags.value, stored]
    } catch {
      // Server rejected (probably the cap hit a TOCTOU race).
      // Don't mutate local state — caller can re-read `tags`.
    }
    return
  }
  // Unauth path: localStorage.
  const next = [...tags.value, slug]
  tags.value = next
  writeLocal(next)
}

async function unfollow(rawTag) {
  const slug = normaliseTag(rawTag)
  if (!slug) return
  if (!tags.value.includes(slug)) return

  if (isAuthed()) {
    try {
      await apiUnfollow(slug)
    } catch {
      // 4xx/5xx — the user almost certainly intended to remove it,
      // so update the UI optimistically. The next `init()` (page
      // reload) will re-sync against the server.
    }
  }
  const next = tags.value.filter((t) => t !== slug)
  tags.value = next
  if (!isAuthed()) writeLocal(next)
}

function toggle(rawTag) {
  const slug = normaliseTag(rawTag)
  if (tags.value.includes(slug)) return unfollow(slug)
  return follow(slug)
}

function isFollowing(rawTag) {
  return tags.value.includes(normaliseTag(rawTag))
}

/**
 * Migrate the localStorage follow set into the user's account on
 * sign-in. Called by the auth-success handler. Idempotent: if the
 * user already has those tags server-side, the backend's
 * ON CONFLICT DO NOTHING absorbs the duplicates.
 */
async function migrateLocalToServer() {
  if (!isAuthed()) return
  const local = readLocal()
  if (!local.length) return
  for (const t of local) {
    try { await apiFollow(t) } catch { /* skip cap-hits silently */ }
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
  }
  // Pull the merged set fresh.
  const r = await apiList().catch(() => ({ tags: [] }))
  tags.value = Array.isArray(r?.tags) ? r.tags : []
}

export function useFollowedTags() {
  // Lazy first-call init — components that mount before/after each
  // other share the same singleton.
  if (!ready.value && !initPromise) init()
  return {
    tags: readonly(tags),
    ready: readonly(ready),
    follow,
    unfollow,
    toggle,
    isFollowing,
    init,
    migrateLocalToServer,
  }
}

// Test helper — allows resetting between tests so the singleton
// doesn't leak state.
export function _resetFollowedTagsForTests() {
  tags.value = []
  ready.value = false
  initPromise = null
}
