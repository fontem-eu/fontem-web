<script setup>
import { ref, onMounted, watch } from 'vue'
import { useLang } from '../composables/useLang.js'
import { useRouter } from 'vue-router'
import { listReports, createReport, listDossiers, createDossier, openReview } from '../api/community.js'

const router = useRouter()

const { lang: uiLang } = useLang()
const stories = ref([])
const loading = ref(true)
const error = ref(null)
const startingReview = ref('')
const creating = ref(false)
const dossiers = ref([])
const showCreateMenu = ref(false)
const creatingDossier = ref(false)

async function loadMine() {
  try {
    const data = await listReports({ scope: 'mine' })
    stories.value = data.stories || data.reports || data || []
    dossiers.value = (await listDossiers()) || []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(loadMine)
// Language switch re-requests the list so cards arrive with translated
// titles/abstracts (the API call carries ?lang=).
watch(uiLang, loadMine)

async function startNewStory() {
  creating.value = true
  error.value = null
  try {
    const story = await createReport('Untitled Analysis', '')
    if (story?.id) {
      router.push(`/stories/${story.id}/edit`)
    }
  } catch (err) {
    error.value = err.message
  } finally {
    creating.value = false
  }
}

async function startNewDossier() {
  creatingDossier.value = true
  error.value = null
  try {
    const d = await createDossier('Untitled dossier')
    if (d?.id) router.push(`/dossiers/${d.id}`)
  } catch (err) {
    error.value = err.message
  } finally {
    creatingDossier.value = false
  }
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

/**
 * Start a read-through of this article.
 *
 * The same object as a change review, minus the diff: a version, and a
 * conversation about it. Inviting somebody is a step you take inside it,
 * so "self review" and "request a review" are the same button followed
 * by a different second action.
 */
async function startArticleReview(story) {
  startingReview.value = story.id
  try {
    const review = await openReview(story.id, 'article')
    router.push(`/stories/${story.id}/reviews/${review.id}`)
  } catch (err) {
    error.value = err.message
  } finally {
    startingReview.value = ''
  }
}

function truncate(text, maxLen = 140) {
  if (!text || text.length <= maxLen) return text || ''
  return text.slice(0, maxLen) + '...'
}
</script>

<template>
  <div class="report-list" data-testid="my-stories">
    <div class="list-header">
      <h1 class="list-title">{{ $t('my_reports.my_stories') }}</h1>
      <div class="create-wrap">
        <button class="new-report-btn" data-testid="create-btn" @click="showCreateMenu = !showCreateMenu">
          {{ $t('my_reports.create') }}
        </button>
        <div v-if="showCreateMenu" class="create-menu" data-testid="create-menu">
          <button :disabled="creating" data-testid="new-story-btn" @click="startNewStory">
            {{ creating ? $t('app.creating') : $t('my_reports.story') }}
          </button>
          <button :disabled="creatingDossier" data-testid="new-dossier-btn" @click="startNewDossier">
            {{ creatingDossier ? $t('app.creating') : $t('investigations.dossier') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-bar" data-testid="my-stories-error">{{ error }}</div>

    <div v-if="loading" class="loading-msg">{{ $t('my_reports.loading_stories') }}</div>

    <div
      v-else-if="stories.length === 0 && dossiers.length === 0"
      class="empty-msg"
      data-testid="my-stories-empty"
    >
      <p class="empty-msg-text">{{ $t('my_reports.no_stories_yet_start_your_first_one_abov') }}</p>
      <router-link
        to="/"
        class="empty-cta-btn"
        data-testid="my-stories-empty-cta"
      >{{ $t('my_reports.or_read_recent_public_stories') }}</router-link>
    </div>

    <div v-if="dossiers.length" class="dossier-section" data-testid="dossier-list">
      <h2 class="section-sub">{{ $t('investigations.dossier') }}s</h2>
      <div class="report-cards">
        <div
          v-for="d in dossiers"
          :key="d.id"
          class="report-card"
          :data-testid="`dossier-card-${d.id}`"
          @click="router.push(`/dossiers/${d.id}`)"
        >
          <div class="card-top"><h2 class="card-title">{{ d.name }}</h2>
            <span class="visibility-badge badge-private">{{ $t('investigations.dossier') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Independent v-if: stories must render alongside dossiers. A `v-else`
         here paired with the dossier-list v-if above and hid the stories list
         whenever the user had any dossier (regression caught by smoke STORY-14). -->
    <div v-if="stories.length" class="report-cards" data-testid="story-cards">
      <div
        v-for="s in stories"
        :key="s.id"
        class="report-card"
        :data-testid="`story-card-${s.id}`"
        @click="router.push(`/stories/${s.id}`)"
      >
        <div class="card-top">
          <h2 class="card-title">{{ s.title }}</h2>
          <span
            class="visibility-badge"
            :class="`badge-${s.visibility || 'private'}`"
          >
            {{ s.visibility ? $t(`app.${s.visibility}`) : $t('app.private') }}
          </span>
        </div>
        <p v-if="s.abstract" class="card-abstract">{{ truncate(s.abstract) }}</p>
        <div class="card-meta">
          <span v-if="s.author">{{ s.author.name || s.author }}</span>
          <span v-if="s.updated_at">&middot; {{ formatDate(s.updated_at) }}</span>
        </div>
        <!-- A full article review: one version read end to end, with
             inline comments and nothing to merge. Either a read-through
             of your own, or somebody else's — the difference is only who
             gets invited once it exists. -->
        <div class="card-reviews" @click.stop>
          <button
            class="card-review-btn"
            :disabled="startingReview === s.id"
            :data-testid="`self-review-${s.id}`"
            @click="startArticleReview(s)"
          >{{ $t('review.start_self_review') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.report-list {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}
.list-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}
.new-report-btn {
  padding: 0.5rem 1.2rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.new-report-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.error-bar {
  padding: 0.5rem 0.75rem;
  margin-bottom: 1rem;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 4px;
  font-size: 0.8rem;
}
.empty-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
.empty-msg-text { margin: 0; }
.empty-cta-btn {
  display: inline-block;
  padding: 0.45rem 1rem;
  border: 1px solid var(--accent);
  border-radius: 999px;
  font-size: 0.85rem;
  color: var(--accent);
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}
.empty-cta-btn:hover {
  background: var(--accent);
  color: #fff;
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
.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}
.card-title { font-size: 1rem; font-weight: 600; color: var(--text); margin: 0; }
.visibility-badge {
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}
.badge-public_open { background: #d1fae5; color: #065f46; }
.badge-public_auth { background: #d1fae5; color: #065f46; }
.badge-shared { background: #dbeafe; color: #1e40af; }
.badge-private { background: #f3f4f6; color: #6b7280; }
.card-abstract { font-size: 0.8rem; color: var(--muted); line-height: 1.5; margin: 0 0 0.5rem; }
.card-meta { display: flex; gap: 0.3rem; font-size: 0.7rem; color: var(--muted); }
/* The review action sits below the card's metadata, separated by a
   hairline: it is an action on the article, not part of its summary.
   Quiet by default — the card's own job is to get you into the article. */
.card-reviews {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.6rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border);
}
.card-review-btn {
  padding: 0.3rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: none;
  color: var(--muted);
  font-size: 0.75rem;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  touch-action: manipulation;
}
.card-review-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.card-review-btn:disabled { opacity: 0.55; cursor: progress; }
.create-wrap { position: relative; display: inline-block; }
.create-menu { position: absolute; right: 0; margin-top: 4px; display: flex; flex-direction: column; gap: 2px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 4px; z-index: 20; box-shadow: 0 4px 14px rgba(0,0,0,0.18); }
.create-menu button { text-align: left; border: none; background: none; color: var(--text); padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem; white-space: nowrap; }
.create-menu button:hover { background: var(--bg); color: var(--accent); }
.section-sub { font-size: 0.9rem; font-weight: 700; color: var(--muted); margin: 0.5rem 0; }
</style>
