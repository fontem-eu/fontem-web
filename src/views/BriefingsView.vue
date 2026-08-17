<script setup>
/**
 * Briefings — browse them, manage the ones you watch.
 *
 * This page is the CONTROL surface. Reading is /my-briefings; nothing here
 * tries to be a feed. Keeping the two apart is deliberate: a page that both
 * configures a subscription and streams its contents makes you scroll past
 * settings to read, and past content to change a setting.
 *
 * Cards expand in place. The earlier version put the region picker, the
 * volume and the Watch button in a pane below the list, so choosing a
 * briefing meant looking somewhere else for the controls that belonged to it.
 * Everything about a briefing now lives inside its own card, including a
 * sample of what is actually in it — because the sample is the thing that
 * tells you whether the settings you just picked are any good.
 */
import { ref, computed, onMounted } from 'vue'
import { isAuthed } from '../api/session.js'
import NutsRegionInput from '../components/NutsRegionInput.vue'
import {
  listBriefings, getBriefing, watchBriefing, listMyWatches, unwatch,
} from '../api/community.js'

const VOLUMES = [3, 10, 25, 50]
/** A taste, not a feed. Enough to judge the settings by. */
const PREVIEW_ITEMS = 4

const briefings = ref([])
const watches = ref([])
const expanded = ref('')
/** Per-card working state, keyed by slug: what the reader is currently
 *  choosing, plus the sample fetched for those choices. */
const cards = ref({})
const loading = ref(true)
const busy = ref('')
const error = ref(null)

const authed = computed(() => isAuthed.value)
const watchedIds = computed(() => new Set(watches.value.map((w) => w.group_id)))
const watched = computed(() => briefings.value.filter((b) => watchedIds.value.has(b.id)))

function watchFor(briefing) {
  return watches.value.find((w) => w.group_id === briefing.id) || null
}

function cardOf(slug) {
  if (!cards.value[slug]) cards.value[slug] = { region: '', volume: 10, items: [], loaded: false }
  return cards.value[slug]
}

onMounted(async () => {
  document.title = 'Briefings — Fontem'
  await load()
})

async function load() {
  loading.value = true
  error.value = null
  try {
    briefings.value = await listBriefings()
    if (authed.value) watches.value = await listMyWatches()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function toggle(briefing) {
  if (expanded.value === briefing.slug) {
    expanded.value = ''
    return
  }
  expanded.value = briefing.slug
  const card = cardOf(briefing.slug)
  // Opening a briefing you already watch should show YOUR settings, not the
  // defaults — otherwise the sample answers a question you did not ask.
  const existing = watchFor(briefing)
  if (existing && !card.loaded) {
    card.region = existing.nuts.includes('EU') ? '' : existing.nuts[0]
    card.volume = existing.volume_per_week
  }
  await refresh(briefing)
}

function regionsOf(card) {
  return card.region ? [card.region] : ['EU']
}

async function refresh(briefing) {
  const card = cardOf(briefing.slug)
  error.value = null
  try {
    const detail = await getBriefing(briefing.slug,
      { nuts: regionsOf(card), volume: card.volume })
    card.items = (detail.items || []).slice(0, PREVIEW_ITEMS)
    card.total = detail.items ? detail.items.length : 0
    card.loaded = true
  } catch (err) {
    error.value = err.message
  }
}

async function onWatch(briefing) {
  const card = cardOf(briefing.slug)
  busy.value = briefing.slug
  error.value = null
  try {
    await watchBriefing(briefing.slug,
      { nuts: regionsOf(card), volume_per_week: card.volume })
    watches.value = await listMyWatches()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = ''
  }
}

async function onUnwatch(briefing) {
  const existing = watchFor(briefing)
  if (!existing) return
  busy.value = briefing.slug
  error.value = null
  try {
    await unwatch(existing.id)
    watches.value = await listMyWatches()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = ''
  }
}

const copied = ref('')
async function copyFeed(url) {
  try {
    await navigator.clipboard.writeText(url)
    copied.value = url
    setTimeout(() => { copied.value = '' }, 2000)
  } catch {
    error.value = 'clipboard'
  }
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString() : ''
}

function fmtValue(value) {
  if (value === null || value === undefined) return ''
  return new Intl.NumberFormat(undefined, {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(value)
}
</script>

<template>
  <div class="bf">
    <header class="bf-header">
      <h1>{{ $t('briefings.title') }}</h1>
      <p class="bf-sub">{{ $t('briefings.intro') }}</p>
    </header>

    <p v-if="error" class="bf-error" data-testid="error">{{ error }}</p>
    <p v-if="loading" class="bf-muted">{{ $t('app.loading') }}</p>
    <p v-else-if="!briefings.length" class="bf-muted" data-testid="empty">
      {{ $t('briefings.none_yet') }}
    </p>

    <!-- Manage: only the ones you watch, with their feed URLs. -->
    <section v-if="watched.length" class="bf-manage" data-testid="manage">
      <h2>{{ $t('briefings.manage') }}</h2>
      <p class="bf-muted">{{ $t('briefings.feeds_hint') }}</p>
      <ul class="bf-manage-list">
        <li v-for="b in watched" :key="b.id">
          <span class="bf-manage-name">{{ b.name }}</span>
          <span class="bf-chips">
            <span v-for="r in watchFor(b).nuts" :key="r" class="bf-chip">{{ r }}</span>
            <span class="bf-chip">
              {{ $t('briefings.n_a_week', { n: watchFor(b).volume_per_week }) }}
            </span>
          </span>
          <button
            class="bf-mini" :data-testid="`copy-${b.slug}`"
            @click="copyFeed(watchFor(b).feed_url)"
          >{{ copied === watchFor(b).feed_url ? $t('briefings.copied') : $t('briefings.copy_feed') }}</button>
          <router-link to="/my-briefings" class="bf-mini">
            {{ $t('briefings.see_my_briefings') }}
          </router-link>
        </li>
      </ul>
    </section>

    <!-- Browse: every briefing, expanding in place. -->
    <ul v-if="briefings.length" class="bf-cards" data-testid="briefing-list">
      <li
v-for="b in briefings" :key="b.slug" class="bf-card"
          :class="{ 'is-open': expanded === b.slug }">
        <button
          class="bf-card-head" :data-testid="`briefing-${b.slug}`"
          :aria-expanded="expanded === b.slug" @click="toggle(b)"
        >
          <span class="bf-card-title">
            {{ b.name }}
            <span
v-if="watchedIds.has(b.id)" class="bf-chip is-watching"
                  :data-testid="`watching-${b.slug}`">{{ $t('briefings.watching') }}</span>
          </span>
          <span class="bf-card-desc">{{ b.description }}</span>
          <span class="bf-caret" aria-hidden="true">{{ expanded === b.slug ? '▾' : '▸' }}</span>
        </button>

        <div v-if="expanded === b.slug" class="bf-card-body" :data-testid="`panel-${b.slug}`">
          <div class="bf-controls">
            <label class="bf-field">
              <span>{{ $t('briefings.your_region') }}</span>
              <NutsRegionInput
                :model-value="cardOf(b.slug).region"
                @update:model-value="(v) => { cardOf(b.slug).region = v; refresh(b) }"
              />
            </label>
            <label class="bf-field bf-narrow">
              <span>{{ $t('briefings.how_much') }}</span>
              <select
                :value="cardOf(b.slug).volume" :data-testid="`volume-${b.slug}`"
                @change="(e) => { cardOf(b.slug).volume = Number(e.target.value); refresh(b) }"
              >
                <option v-for="v in VOLUMES" :key="v" :value="v">
                  {{ $t('briefings.n_a_week', { n: v }) }}
                </option>
              </select>
            </label>
            <div class="bf-actions">
              <template v-if="authed">
                <button
                  class="bf-btn bf-primary" :disabled="busy === b.slug"
                  :data-testid="`watch-${b.slug}`" @click="onWatch(b)"
                >{{ watchedIds.has(b.id) ? $t('briefings.update_watch') : $t('briefings.watch') }}</button>
                <button
                  v-if="watchedIds.has(b.id)" class="bf-btn bf-danger"
                  :disabled="busy === b.slug" :data-testid="`unwatch-${b.slug}`"
                  @click="onUnwatch(b)"
                >{{ $t('briefings.unwatch') }}</button>
              </template>
              <router-link
v-else to="/login" class="bf-btn bf-primary"
                           :data-testid="`watch-login-${b.slug}`">
                {{ $t('briefings.sign_in_to_watch') }}
              </router-link>
            </div>
          </div>

          <h3 class="bf-sample-title">{{ $t('briefings.whats_in_it') }}</h3>
          <p
v-if="!cardOf(b.slug).items.length" class="bf-muted"
             :data-testid="`no-items-${b.slug}`">
            {{ $t('briefings.nothing_here_yet') }}
          </p>
          <ol v-else class="bf-items" :data-testid="`items-${b.slug}`">
            <li v-for="item in cardOf(b.slug).items" :key="item.item_id" class="bf-entry">
              <a :href="item.link" target="_blank" rel="noopener noreferrer">{{ item.title }}</a>
              <p class="bf-entry-meta">
                <time>{{ fmtDate(item.item_time) }}</time>
                <span v-for="r in item.nuts" :key="r" class="bf-chip">{{ r }}</span>
                <span v-if="item.rank_value" class="bf-value">{{ fmtValue(item.rank_value) }}</span>
              </p>
            </li>
          </ol>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.bf { max-width: 820px; margin: 0 auto; padding: 0 1rem 4rem; }
.bf-header { padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.25rem; }
.bf-header h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
.bf-sub { font-size: 0.9rem; color: var(--muted); margin-top: 0.4rem; max-width: 55ch; }
.bf-muted { color: var(--muted); font-size: 0.88rem; }
.bf-error { color: #c0392b; font-size: 0.85rem; margin: 0.5rem 0; }
.bf-manage { border: 1px solid var(--border); border-radius: 10px; padding: 0.9rem 1rem; margin-bottom: 1.5rem; }
.bf-manage h2 { font-size: 1rem; margin: 0 0 0.2rem; }
.bf-manage-list { list-style: none; margin: 0.6rem 0 0; padding: 0; display: grid; gap: 0.5rem; }
.bf-manage-list li { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; font-size: 0.88rem; }
.bf-manage-name { font-weight: 600; flex: 1; }
.bf-cards { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.7rem; }
.bf-card { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.bf-card.is-open { border-color: var(--accent); }
.bf-card-head { display: grid; grid-template-columns: 1fr auto; gap: 0.15rem 0.6rem; width: 100%; text-align: left; padding: 0.85rem 1rem; background: none; border: none; cursor: pointer; color: inherit; }
.bf-card-head:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.bf-card-title { font-weight: 600; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; }
.bf-card-desc { font-size: 0.83rem; color: var(--muted); grid-column: 1; }
.bf-caret { grid-row: 1 / span 2; align-self: center; color: var(--muted); }
.bf-card-body { padding: 0 1rem 1rem; display: grid; gap: 0.8rem; border-top: 1px solid var(--border); padding-top: 0.9rem; }
.bf-controls { display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end; }
.bf-field { display: grid; gap: 0.3rem; font-size: 0.8rem; color: var(--muted); flex: 1 1 240px; }
.bf-field.bf-narrow { flex: 0 0 160px; }
.bf-field select { font: inherit; font-size: 0.9rem; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.45rem 0.6rem; }
.bf-actions { display: flex; gap: 0.5rem; }
.bf-btn { font: inherit; font-size: 0.86rem; padding: 0.48rem 0.95rem; border-radius: 8px; border: 1px solid var(--border); background: var(--surface, #f6f8fa); color: inherit; cursor: pointer; text-decoration: none; white-space: nowrap; }
.bf-btn:disabled { opacity: 0.5; cursor: default; }
.bf-primary { border-color: var(--accent); color: var(--accent); font-weight: 600; }
.bf-danger { border-color: #c0392b; color: #c0392b; }
.bf-mini { font: inherit; font-size: 0.78rem; padding: 0.25rem 0.6rem; border: 1px solid var(--border); border-radius: 7px; background: none; color: var(--accent); cursor: pointer; text-decoration: none; }
.bf-sample-title { font-size: 0.85rem; margin: 0; color: var(--muted); }
.bf-items { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.7rem; }
.bf-entry a { font-weight: 600; font-size: 0.92rem; color: var(--text); text-decoration: none; }
.bf-entry a:hover { color: var(--accent); text-decoration: underline; }
.bf-entry-meta { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; font-size: 0.74rem; color: var(--muted); margin: 0.25rem 0 0; }
.bf-chips { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.bf-chip { font-size: 0.7rem; padding: 0.05rem 0.4rem; border: 1px solid var(--border); border-radius: 999px; color: var(--muted); }
.bf-chip.is-watching { border-color: var(--accent); color: var(--accent); }
.bf-value { font-variant-numeric: tabular-nums; }
</style>
