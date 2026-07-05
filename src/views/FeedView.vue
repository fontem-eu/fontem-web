<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useLang } from '../composables/useLang.js'
import { useRouter, useRoute } from 'vue-router'
import { listReports, listAllTags } from '../api/community.js'
import { useFollowedTags } from '../composables/useFollowedTags.js'
import { useStoriesTagFilter } from '../composables/useStoriesTagFilter.js'

const router = useRouter()
const route = useRoute()

const { lang: uiLang } = useLang()
const stories = ref([])
const loading = ref(true)
const error = ref(null)

// All public-story tags + counts, for the chip strip.
const allTags = ref([])

// Active tag filter — read from + writes back to the URL so the
// filter is shareable / bookmarkable.
const activeTag = computed(() => {
  const t = route.query.tag
  return typeof t === 'string' && t ? t : null
})

// `tags` is read inside the template via the composable's
// `isFollowing` helper; we don't need a ref here.
const { toggle, isFollowing } = useFollowedTags()

// Persist the last-selected filter tag in localStorage so the next
// time the user lands on `/` with no `?tag=` in the URL, the saved
// tag is restored — matches the user expectation that entering a
// story and coming back keeps the filter. `setTag` / `clearTag`
// below mirror the URL write into the storage on every change.
const { getStoredTag, saveTag, clearStoredTag } = useStoriesTagFilter()

async function loadStories() {
  loading.value = true
  error.value = null
  try {
    const data = await listReports({
      scope: 'public', limit: 50,
      tag: activeTag.value || undefined,
    })
    // The /data-stories list endpoint still returns `{ reports: [...] }`
    // (see Phase A1 — backend internals stay named Report); accept the
    // legacy `reports` key plus a future `stories` key, and the bare
    // array shape some tests use.
    stories.value = data.stories || data.reports || data || []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function loadTags() {
  try {
    const r = await listAllTags()
    allTags.value = Array.isArray(r?.tags) ? r.tags : []
  } catch { /* chip strip is enrichment, not blocking */ }
}

onMounted(async () => {
  // If the URL doesn't carry an explicit `?tag=`, try to restore the
  // last filter the user had selected. The router.replace happens
  // before the first listStories fetch so the URL + active filter
  // stay in sync and the network call already carries `tag=`.
  if (!activeTag.value) {
    const saved = getStoredTag()
    if (saved) {
      router.replace({ path: route.path, query: { ...route.query, tag: saved } })
    }
  }
  await Promise.all([loadStories(), loadTags()])
})

// Re-fetch the story list whenever the URL's `?tag=` flips.
watch(activeTag, () => { loadStories() })
// Language switch re-requests the feed so cards arrive with
// translated titles/abstracts (the API call carries ?lang=).
watch(uiLang, () => { loadStories() })

function setTag(tag) {
  router.replace({ path: route.path, query: { ...route.query, tag } })
  saveTag(tag)
}

function clearTag() {
  // eslint-disable-next-line no-unused-vars
  const { tag, ...rest } = route.query
  router.replace({ path: route.path, query: rest })
  clearStoredTag()
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function truncate(text, maxLen = 180) {
  if (!text || text.length <= maxLen) return text || ''
  return text.slice(0, maxLen) + '...'
}
</script>

<template>
  <div class="feed" data-testid="feed">
    <h1 class="feed-title">{{ $t('feed.feed') }}</h1>
    <p class="feed-sub">{{ $t('feed.public_data_stories_from_the_community_n') }}</p>

    <!-- Browse-by-tag chip strip. Each chip toggles the URL `?tag=`
         filter; a star toggles follow/unfollow (localStorage when
         logged out, server-side when logged in). The "All" pill
         clears the filter. -->
    <div v-if="allTags.length" class="tag-strip" data-testid="feed-tag-strip">
      <button
        type="button"
        class="tag-chip all-chip"
        :class="{ active: !activeTag }"
        data-testid="tag-chip-all"
        @click="clearTag"
      >{{ $t('app.all') }}</button>
      <span
        v-for="t in allTags"
        :key="t.tag"
        class="tag-chip-wrap"
      >
        <button
          type="button"
          class="tag-chip"
          :class="{ active: activeTag === t.tag }"
          :data-testid="`tag-chip-${t.tag}`"
          @click="setTag(t.tag)"
        >
          {{ t.tag }}
          <span class="chip-count">{{ t.story_count }}</span>
        </button>
        <button
          type="button"
          class="follow-btn"
          :class="{ followed: isFollowing(t.tag) }"
          :aria-label="isFollowing(t.tag) ? `Unfollow ${t.tag}` : `Follow ${t.tag}`"
          :title="isFollowing(t.tag) ? 'Unfollow' : 'Follow'"
          :data-testid="`tag-follow-${t.tag}`"
          @click.stop="toggle(t.tag)"
        >{{ isFollowing(t.tag) ? '★' : '☆' }}</button>
      </span>
    </div>

    <p
      v-if="activeTag"
      class="feed-active-filter"
      data-testid="feed-active-filter"
    >{{ $t('feed.filtering_by') }}<code>{{ activeTag }}</code>.
      <button type="button" class="link-btn" @click="clearTag">{{ $t('feed.clear_filter') }}</button>
    </p>

    <div v-if="error" class="error-bar" data-testid="feed-error">{{ error }}</div>

    <div v-if="loading" class="loading-msg">{{ $t('feed.loading_feed') }}</div>

    <div
      v-else-if="stories.length === 0"
      class="empty-msg"
      data-testid="feed-empty"
    >
      {{ $t('feed.nothing_here') }}
    </div>

    <div v-else class="report-cards">
      <article
        v-for="s in stories"
        :key="s.id"
        class="report-card"
        :data-testid="`feed-card-${s.id}`"
        @click="router.push(`/stories/${s.id}`)"
      >
        <h2 class="card-title">{{ s.title }}</h2>
        <p v-if="s.abstract" class="card-abstract">{{ truncate(s.abstract) }}</p>
        <div v-if="s.tags && s.tags.length" class="card-tags" data-testid="feed-card-tags">
          <span v-for="t in s.tags" :key="t" class="tag-pill">{{ t }}</span>
        </div>
        <div class="card-meta">
          <span v-if="s.author">{{ s.author.name || s.author }}</span>
          <span v-if="s.updated_at">&middot; {{ formatDate(s.updated_at) }}</span>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.feed {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}
.feed-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 0.25rem;
}
.feed-sub {
  font-size: 0.8rem;
  color: var(--muted);
  margin: 0 0 1.25rem;
}
.error-bar {
  padding: 0.5rem 0.75rem;
  margin-bottom: 1rem;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 4px;
  font-size: 0.8rem;
}
.loading-msg, .empty-msg {
  text-align: center;
  padding: 2rem 0;
  font-size: 0.85rem;
  color: var(--muted);
}
.report-cards { display: flex; flex-direction: column; gap: 0.75rem; }
.report-card {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1rem;
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.15s;
}
.report-card:hover { border-color: var(--accent); }
.card-title { font-size: 1rem; font-weight: 600; color: var(--text); margin: 0 0 0.35rem; }
.card-abstract { font-size: 0.8rem; color: var(--muted); line-height: 1.5; margin: 0 0 0.5rem; }
.card-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0 0 0.5rem; }
.tag-pill {
  font-size: 0.7rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: var(--accent-bg, rgba(10, 102, 194, 0.12));
  color: var(--accent, #0a66c2);
  font-weight: 500;
}
.card-meta { display: flex; gap: 0.3rem; font-size: 0.7rem; color: var(--muted); }

/* ── Tag chip strip ─────────────────────────────────────────── */
.tag-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0 0 1rem;
}
.tag-chip-wrap {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: var(--accent-bg, rgba(10, 102, 194, 0.10));
  overflow: hidden;
}
.tag-chip {
  border: 0;
  padding: 0.2rem 0.6rem;
  background: transparent;
  color: var(--accent, #0a66c2);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.tag-chip.active,
.tag-chip.all-chip.active { background: var(--accent, #0a66c2); color: #fff; border-radius: 999px; }
.all-chip { border-radius: 999px; background: var(--accent-bg, rgba(10, 102, 194, 0.10)); }
.chip-count { font-size: 0.7rem; color: var(--muted); }
.tag-chip.active .chip-count { color: rgba(255,255,255,0.85); }
.follow-btn {
  border: 0;
  padding: 0.2rem 0.5rem;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1;
}
.follow-btn.followed { color: #f0a000; }
.feed-active-filter { font-size: 0.85rem; color: var(--muted); margin: 0 0 1rem; }
.feed-active-filter code {
  background: var(--accent-bg, rgba(10, 102, 194, 0.12));
  color: var(--accent, #0a66c2);
  padding: 0.05rem 0.35rem;
  border-radius: 4px;
}
.link-btn {
  border: 0;
  background: transparent;
  color: var(--accent, #0a66c2);
  cursor: pointer;
  font: inherit;
  padding: 0;
  margin-left: 0.4rem;
}
.link-btn:hover { text-decoration: underline; }
</style>
