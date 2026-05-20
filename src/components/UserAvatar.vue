<script setup>
/**
 * Compact circular user avatar.
 *
 * Three render fallbacks, in order:
 *   1. `user.avatar_url` — render the image (User.avatar_url is the
 *      backend's existing field, populated when the user uploads one
 *      or via OAuth provider). On image-load failure, fall through.
 *   2. Initials derived from the name; if the name is unusable,
 *      derived from the email's local-part instead.
 *   3. Generic head/shoulders SVG when nothing usable is available.
 *
 * The component is presentational — colour, size, click handling
 * are decided by the parent.
 */
import { computed, ref } from 'vue'

const props = defineProps({
  user: { type: Object, default: null },
  size: { type: Number, default: 28 },
  ariaLabel: { type: String, default: '' },
})

const imgFailed = ref(false)

const avatarUrl = computed(() => {
  if (imgFailed.value) return null
  return props.user?.avatar_url || null
})

/**
 * Initials algorithm — exposed pure for tests.
 *
 *   "Bernardo Marques"        → "BM"
 *   "Bernardo"                → "BE"   (first two chars of the token)
 *   "Maria de Lurdes Silva"   → "MS"   (first + last token)
 *   "Émile Zola"              → "ÉZ"   (Unicode preserved)
 *   "" / null  → fall through to email
 *   "alice@x"  → "AL"
 *   nothing usable → null (caller renders the head icon)
 */
function deriveInitials(name, email) {
  const cleanName = (name || '').trim()
  if (cleanName) {
    // Split on any whitespace, drop empty tokens.
    const parts = cleanName.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      // First + last token (handles "Maria de Lurdes Silva" → MS).
      return (firstChar(parts[0]) + firstChar(parts[parts.length - 1])).toUpperCase()
    }
    // Single token: take its first two characters.
    return twoChars(parts[0]).toUpperCase()
  }
  // Fall back to the email's local-part.
  const localPart = (email || '').split('@')[0]
  if (localPart) return twoChars(localPart).toUpperCase()
  return null
}

// Iterator-based char picks so a multi-byte grapheme (e.g. "É") counts
// as one character — `string[0]` would split the surrogate pair.
function firstChar(s) {
  const iter = s[Symbol.iterator]().next()
  return iter.done ? '' : iter.value
}
function twoChars(s) {
  let out = ''
  for (const ch of s) {
    out += ch
    if ([...out].length === 2) break
  }
  return out
}

const initials = computed(() => deriveInitials(props.user?.name, props.user?.email))

const tooltip = computed(() => {
  if (props.ariaLabel) return props.ariaLabel
  const name = (props.user?.name || '').trim()
  const email = (props.user?.email || '').trim()
  if (name && email) return `${name} (${email})`
  return name || email || 'Signed in'
})

defineExpose({ deriveInitials })
</script>

<template>
  <span
    class="avatar"
    :style="{ width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.42) + 'px' }"
    :title="tooltip"
    :aria-label="tooltip"
    data-testid="user-avatar"
  >
    <img
      v-if="avatarUrl"
      :src="avatarUrl"
      :alt="tooltip"
      class="avatar-img"
      data-testid="user-avatar-img"
      @error="imgFailed = true"
    />
    <span
      v-else-if="initials"
      class="avatar-initials"
      data-testid="user-avatar-initials"
    >{{ initials }}</span>
    <svg
      v-else
      class="avatar-icon"
      :width="Math.round(size * 0.6)"
      :height="Math.round(size * 0.6)"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      data-testid="user-avatar-icon"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  </span>
</template>

<style scoped>
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent-bg, rgba(10, 102, 194, 0.18));
  color: var(--accent, #0a66c2);
  font-weight: 600;
  user-select: none;
  flex: 0 0 auto;
  overflow: hidden;
  /* Subtle ring so the avatar reads as its own affordance against
     adjacent header icons. */
  box-shadow: inset 0 0 0 1px var(--border);
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.avatar-initials {
  line-height: 1;
  /* Kerning tweak so two letters look balanced inside a circle. */
  letter-spacing: -0.02em;
}
.avatar-icon { color: currentColor; }
</style>
