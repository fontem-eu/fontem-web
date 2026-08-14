<script setup>
import { isAuthed } from '../api/session.js'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listActivity, getCurrentUser, getAgentContext } from '../api/community.js'
import ActivityIcon from '../components/ActivityIcon.vue'

const router = useRouter()

const user = ref(null)
const activities = ref([])
const loading = ref(true)
const error = ref(null)

const hasToken = computed(() => isAuthed.value)

onMounted(async () => {
  if (!hasToken.value) {
    loading.value = false
    return
  }
  try {
    const [userData, activityData] = await Promise.allSettled([
      getCurrentUser(),
      listActivity(),
    ])

    if (userData.status === 'fulfilled') user.value = userData.value

    if (activityData.status === 'fulfilled') {
      const events = activityData.value || []
      /* The API already returns newest-first; map to the feed item shape. */
      activities.value = events.map((e) => ({
        id: e.id,
        type: e.entity_type,
        action: e.action,
        title: e.summary || '(untitled)',
        date: e.created_at,
        link: linkFor(e),
        /* Who actually did it. An entry saying the user created a Data
           Studio project is false when the assistant created it on their
           behalf, and until the log carried provenance there was no way to
           tell them apart. Absent (the rows written before the column
           existed) means a person did it, which is true of all of them. */
        byAgent: e.actor_kind === 'agent',
        conversationId: e.conversation_id || null,
        /* The tool call that caused it. Without one there is nothing to
           explain — an agent entry written before the provenance existed,
           or one whose conversation has since been cleared. */
        messageId: e.message_id || null,
      }))
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})

const ENTITY_ROUTES = {
  story: '/stories/',
  investigation: '/investigations/',
  dossier: '/dossiers/',
  issue: '/issues/',
}

/* Deleted resources have no destination; everything else links to its detail page. */
function linkFor(e) {
  const base = ENTITY_ROUTES[e.entity_type]
  return e.action !== 'deleted' && base && e.entity_id ? base + e.entity_id : null
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return dateStr }
}

function typeLabel(type) {
  const map = { story: 'Story', report: 'Story', issue: 'Issue', dossier: 'Dossier', investigation: 'Investigation' }
  return map[type] || type
}

/* Actions come as `created`, `updated`, `deleted`, `translated`, and the
   compound `query_added` / `plot_updated` the Data Studio writes. The verb
   is the last segment, which is also the only part with an icon. */
function verbOf(action) {
  return String(action || '').split('_').pop()
}

/* "query_added" reads as "added query": the noun is context for the verb,
   not part of it. Single-word actions are left alone. */
function actionLabel(action) {
  const parts = String(action || '').split('_')
  if (parts.length < 2) return action
  return `${parts[parts.length - 1]} ${parts.slice(0, -1).join(' ')}`
}

/* ── Agent context ──────────────────────────────────────────────
   Which entry is expanded, and what the server said about it. Kept per
   entry rather than as one shared slot so opening a second one does not
   silently discard the first's loaded state. */
const openContext = ref(null)
const contexts = ref({})

async function toggleContext(item) {
  if (openContext.value === item.id) {
    openContext.value = null
    return
  }
  openContext.value = item.id
  if (contexts.value[item.id] || !item.messageId) return
  contexts.value[item.id] = { loading: true }
  try {
    contexts.value[item.id] = { turn: await getAgentContext(item.messageId) }
  } catch (e) {
    /* The conversation may have been deleted since — the activity survives
       that on purpose, so the link dangling is expected rather than broken. */
    contexts.value[item.id] = { error: e.message }
  }
}
</script>

<template>
  <div class="activity-page" data-testid="activity-view">
    <header class="activity-header">
      <h1>{{ $t('app.activity') }}</h1>
      <p v-if="user" class="activity-user">{{ user.name || user.email }}</p>
    </header>

    <!-- Not signed in -->
    <div v-if="!hasToken" class="activity-empty" data-testid="activity-no-auth">
      <p>{{ $t('activity.sign_in_to_see_your_activity') }}</p>
      <router-link to="/login" class="activity-sign-in">{{ $t('activity.sign_in') }}</router-link>
    </div>

    <p v-if="error" class="activity-error">{{ error }}</p>
    <p v-if="loading" class="activity-loading">{{ $t('activity.loading_activity') }}</p>

    <!-- Empty -->
    <div
      v-if="!loading && hasToken && !activities.length && !error"
      class="activity-empty"
      data-testid="activity-empty"
    >
      {{ $t('activity.no_activity_yet') }}
    </div>

    <!-- Activity feed -->
    <ul v-if="!loading && activities.length" class="activity-list" data-testid="activity-list">
      <li
        v-for="item in activities"
        :key="item.id"
        class="activity-item"
      >
        <!-- The testid lives on the row, not the <li>: the row is what you
             click, and the expanded context below is a sibling of it. -->
        <div
          class="activity-row"
          :class="{ 'activity-clickable': item.link }"
          :data-testid="'activity-' + item.type + '-' + item.action"
          @click="item.link && router.push(item.link)"
        >
          <!-- What it was, and what happened to it. Two glyphs instead of
               two words: the list is meant to be skimmed. -->
          <span class="activity-kind" :title="typeLabel(item.type)">
            <ActivityIcon :name="item.type" :size="17" />
            <span class="visually-hidden">{{ typeLabel(item.type) }}</span>
          </span>
          <span class="activity-verb" :title="actionLabel(item.action)">
            <ActivityIcon :name="verbOf(item.action)" :size="15" />
            <!-- The word, kept for anything that cannot see the glyph. An
                 icon with only a title attribute is not an accessible name:
                 the svg is aria-hidden, so without this the row reads as
                 just a headline with no verb. -->
            <span class="visually-hidden">{{ actionLabel(item.action) }}</span>
          </span>

          <span class="activity-title">{{ item.title }}</span>

          <!-- Not decoration: the difference between "you did this" and
               "something did this for you". -->
          <button
            v-if="item.byAgent"
            type="button"
            class="activity-agent"
            :class="{ 'activity-agent--open': openContext === item.id }"
            data-testid="activity-by-agent"
            :aria-expanded="openContext === item.id"
            :title="$t('activity.by_assistant_hint')"
            @click.stop="toggleContext(item)"
          >
            <ActivityIcon name="agent" :size="14" />
            <span class="activity-agent-label">{{ $t('activity.by_assistant') }}</span>
          </button>

          <time class="activity-date" :datetime="item.date">{{ formatDate(item.date) }}</time>
        </div>

        <!-- Why it happened. Inline rather than a modal: it is a follow-up
             to this row, and on a phone a modal loses the thing you were
             looking at. -->
        <div
          v-if="openContext === item.id"
          class="agent-context"
          data-testid="agent-context"
        >
          <p v-if="contexts[item.id]?.loading" class="agent-context-note">
            {{ $t('activity.context_loading') }}
          </p>
          <p v-else-if="contexts[item.id]?.error" class="agent-context-note">
            {{ $t('activity.context_unavailable') }}
          </p>
          <template v-else-if="contexts[item.id]?.turn">
            <div class="agent-context-block">
              <h3>{{ $t('activity.context_prompt') }}</h3>
              <p class="agent-prompt" data-testid="agent-context-prompt">
                {{ contexts[item.id].turn.prompt?.content || $t('activity.context_no_prompt') }}
              </p>
            </div>

            <div class="agent-context-block">
              <h3>{{ $t('activity.context_calls') }}</h3>
              <ol class="agent-calls">
                <li
                  v-for="call in contexts[item.id].turn.calls"
                  :key="call.id"
                  class="agent-call"
                  :class="{ 'agent-call--subject': call.is_subject }"
                  data-testid="agent-context-call"
                >
                  <code class="agent-call-tool">{{ call.tool }}</code>
                  <code class="agent-call-args">{{ JSON.stringify(call.args) }}</code>
                </li>
              </ol>
            </div>

            <div v-if="contexts[item.id].turn.answer" class="agent-context-block">
              <h3>{{ $t('activity.context_answer') }}</h3>
              <p class="agent-answer">{{ contexts[item.id].turn.answer.content }}</p>
              <p v-if="contexts[item.id].turn.answer.model" class="agent-context-note">
                {{ contexts[item.id].turn.answer.model }}
              </p>
            </div>
          </template>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.activity-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 1rem 4rem;
}

.activity-header {
  padding: 1.5rem 0 1rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1rem;
}

.activity-header h1 {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.activity-user {
  font-size: 0.85rem;
  color: var(--muted);
  margin: 0.25rem 0 0;
}

.activity-error {
  color: #dc2626;
  font-size: 0.85rem;
}

.activity-loading {
  color: var(--muted);
  font-size: 0.85rem;
}

.activity-empty {
  text-align: center;
  padding: 3rem 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.activity-sign-in {
  display: inline-block;
  margin-top: 0.75rem;
  padding: 0.5rem 1.2rem;
  background: var(--accent);
  color: #fff;
  text-decoration: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.activity-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.activity-item {
  border-bottom: 1px solid var(--border);
}

/* The row is its own flex container so the expanded context can sit under
   it inside the same <li> without becoming a flex item beside the title. */
.activity-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0;
  transition: background 0.1s;
}

.activity-row:hover {
  background: var(--surface);
}

.activity-clickable { cursor: pointer; }

/* Icons carry the kind and the verb. The coloured word-badges they replace
   cost about 120px of a phone's width to say "STORY" next to something
   that was obviously a story. */
.visually-hidden {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0);
  white-space: nowrap; border: 0;
}

.activity-kind {
  flex: none;
  display: inline-flex;
  color: var(--accent);
}

.activity-verb {
  flex: none;
  display: inline-flex;
  color: var(--muted);
}

.activity-title {
  flex: 1;
  min-width: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-agent {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.68rem;
  padding: 0.1rem 0.45rem;
  background: none;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--muted);
  white-space: nowrap;
  cursor: pointer;
}

.activity-agent:hover,
.activity-agent--open {
  color: var(--text);
  border-color: var(--accent);
}

.activity-date {
  flex: none;
  font-size: 0.75rem;
  color: var(--muted);
  white-space: nowrap;
}

/* ── Why the agent did it ─────────────────────────────────── */

.agent-context {
  padding: 0.15rem 0 0.9rem 1.9rem;
  display: grid;
  gap: 0.7rem;
}

.agent-context-block h3 {
  margin: 0 0 0.2rem;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.agent-context-note {
  margin: 0;
  font-size: 0.75rem;
  color: var(--muted);
}

.agent-prompt,
.agent-answer {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text);
  /* The prompt is the user's own words and can be long; wrapping beats
     truncating, because the point is reading what was asked. */
  overflow-wrap: anywhere;
}

.agent-calls {
  margin: 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.3rem;
}

.agent-call {
  font-size: 0.75rem;
  color: var(--muted);
}

/* The call the entry came in on. The others are the sequence around it,
   which is what makes the answer legible rather than a bare fact. */
.agent-call--subject {
  color: var(--text);
  font-weight: 600;
}

.agent-call-tool {
  overflow-wrap: anywhere;
}

.agent-call-args {
  display: block;
  overflow-wrap: anywhere;
  opacity: 0.85;
}

/* Narrow screens: the badge text goes, the icon stays, and the date moves
   under the title rather than squeezing it to nothing. */
@media (max-width: 30rem) {
  .activity-agent-label { display: none; }

  .activity-row {
    flex-wrap: wrap;
    row-gap: 0.15rem;
  }

  .activity-title {
    flex-basis: 100%;
    order: 3;
    white-space: normal;
  }

  .agent-context {
    padding-left: 0.6rem;
  }
}

</style>
