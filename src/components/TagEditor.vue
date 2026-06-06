<script setup>
/**
 * Pill-style tag editor for the data-story edit page.
 *
 * Free-text input, server-side normalises to slug form
 * (`[a-z0-9-]`). Hard-capped at 3 tags per story (matches the
 * backend `MAX_TAGS_PER_STORY`). Suggests existing popular tags
 * via a small dropdown so the same tag doesn't get re-coined for
 * every story.
 *
 * Emits `update:modelValue` with the canonical slug list whenever
 * the user adds, removes, or reorders. The parent persists via
 * `setStoryTags()` on its own save cadence.
 */
import { ref, computed, onMounted, watch } from 'vue'
import { listAllTags } from '../api/community.js'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  maxTags: { type: Number, default: 3 },
})
const emit = defineEmits(['update:modelValue'])

const draft = ref('')
const allTags = ref([])           // [{tag, story_count}]
const showSuggestions = ref(false)

onMounted(async () => {
  try {
    const r = await listAllTags()
    allTags.value = Array.isArray(r?.tags) ? r.tags : []
  } catch {
    // Public endpoint, but if it 500s we just lose suggestions —
    // not a blocker for tag editing.
  }
})

// Mirror the backend slug rules so the user sees the canonical form
// instantly and we don't hit the server with garbage.
function normaliseTag(raw) {
  if (!raw) return ''
  return raw
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
}

const suggestions = computed(() => {
  const q = normaliseTag(draft.value)
  // Always exclude already-selected tags from the suggestions.
  const selected = new Set(props.modelValue)
  let pool = allTags.value.filter((t) => !selected.has(t.tag))
  if (q) pool = pool.filter((t) => t.tag.includes(q))
  // Cap visible suggestions at 6 — enough to be useful, not so many
  // they push the editor down on a small screen.
  return pool.slice(0, 6)
})

const atLimit = computed(() => props.modelValue.length >= props.maxTags)

function add(tagOrRaw) {
  const slug = normaliseTag(tagOrRaw)
  if (!slug) return
  if (atLimit.value) return
  if (props.modelValue.includes(slug)) return
  emit('update:modelValue', [...props.modelValue, slug])
  draft.value = ''
  showSuggestions.value = false
}

function remove(tag) {
  emit('update:modelValue', props.modelValue.filter((t) => t !== tag))
}

function onEnter() {
  if (draft.value.trim()) add(draft.value)
}

function onCommaOrSemi(event) {
  // Pressing comma or semicolon also adds — common pill-input UX.
  if (event.data === ',' || event.data === ';') {
    event.preventDefault?.()
    onEnter()
  }
}

watch(() => props.modelValue, () => {
  // If the parent forces the list down to <maxTags, focus may be
  // disabled — re-enable input.
})
</script>

<template>
  <div class="tag-editor" data-testid="tag-editor">
    <label class="label" for="tag-editor-input">{{ $t('tag_editor.tags') }}<span class="hint">{{ modelValue.length }}/{{ maxTags }}</span>
    </label>
    <div class="pills">
      <span
        v-for="t in modelValue"
        :key="t"
        class="pill"
        :data-testid="`tag-pill-${t}`"
      >
        {{ t }}
        <button
          type="button"
          class="pill-x"
          :aria-label="$t('tag_editor.remove_tag_aria', { tag: t })"
          @click="remove(t)"
        >×</button>
      </span>
      <input
        id="tag-editor-input"
        v-model="draft"
        type="text"
        class="input"
        :placeholder="atLimit ? '' : $t('tag_editor.add_tag_placeholder')"
        :disabled="atLimit"
        :maxlength="40"
        autocomplete="off"
        data-testid="tag-editor-input"
        @keydown.enter.prevent="onEnter"
        @beforeinput="onCommaOrSemi"
        @focus="showSuggestions = true"
        @blur="setTimeout(() => showSuggestions = false, 120)"
      />
    </div>

    <ul
      v-if="showSuggestions && !atLimit && suggestions.length"
      class="suggestions"
      data-testid="tag-suggestions"
    >
      <li v-for="s in suggestions" :key="s.tag">
        <button
          type="button"
          class="suggestion-btn"
          @mousedown.prevent="add(s.tag)"
        >
          <span class="suggestion-tag">{{ s.tag }}</span>
          <span class="suggestion-count">{{ s.story_count }}</span>
        </button>
      </li>
    </ul>

    <p v-if="atLimit" class="cap-hint">Maximum {{ maxTags }} tags reached. Remove one to add another.</p>
  </div>
</template>

<style scoped>
.tag-editor { position: relative; display: flex; flex-direction: column; gap: 0.4rem; }
.label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.hint { font-weight: 400; font-size: 0.75rem; color: var(--muted); }

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  padding: 0.4rem;
  min-height: 2.4rem;
  align-items: center;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: var(--accent-bg, rgba(10, 102, 194, 0.12));
  color: var(--accent, #0a66c2);
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 500;
}
.pill-x {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
  margin-left: 0.1rem;
}
.input {
  flex: 1;
  min-width: 7rem;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text);
  font: inherit;
}

.suggestions {
  list-style: none;
  margin: 0;
  padding: 0.25rem;
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  max-height: 14rem;
  overflow-y: auto;
}
.suggestion-btn {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 0;
  background: transparent;
  padding: 0.4rem 0.6rem;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--text);
  border-radius: 4px;
  text-align: left;
}
.suggestion-btn:hover { background: var(--accent-bg, rgba(10, 102, 194, 0.08)); }
.suggestion-tag { font-family: monospace; }
.suggestion-count { color: var(--muted); font-size: 0.75rem; }

.cap-hint { font-size: 0.75rem; color: var(--muted); margin: 0; }
</style>
