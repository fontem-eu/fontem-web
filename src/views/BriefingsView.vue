<script setup>
/**
 * Briefings — your subscriptions, and what else there is to subscribe to.
 *
 * Two lists, in that order, because they answer different questions. The top
 * one is "what am I getting?", the bottom is "what else could I get?".
 *
 * A WATCH IS NOT A BRIEFING. One briefing can be watched several times at
 * different scopes — fifty a week from Coimbra, ten from Portugal, ten from
 * the whole EU — because a local award and a European one are different kinds
 * of news to the same reader. An earlier version modelled this as at most one
 * watch per briefing and silently overwrote the previous settings, which made
 * a second subscription look like it worked while destroying the first. So
 * the top list is of WATCHES, each editable in place and each with its own
 * feed URL; the bottom list is of briefings, and every one of them can be
 * added again.
 */
import { ref, computed, onMounted } from 'vue'
import { isAuthed } from '../api/session.js'
import NutsRegionInput from '../components/NutsRegionInput.vue'
import {
  listBriefings, getBriefing, addWatch, adjustWatch, listMyWatches, unwatch,
} from '../api/community.js'

const VOLUMES = [3, 10, 25, 50]
/** A taste, not a feed. Enough to judge the settings by. */
const PREVIEW_ITEMS = 4

const briefings = ref([])
const watches = ref([])
const expanded = ref('')
const cards = ref({})
const editing = ref('')
const drafts = ref({})
const loading = ref(true)
const busy = ref('')
const error = ref(null)
const copied = ref('')

const authed = computed(() => isAuthed.value)
const byId = computed(() => Object.fromEntries(briefings.value.map((b) => [b.id, b])))

/** Watches, each resolved to the briefing it belongs to. */
const subscriptions = computed(() => watches.value.map((w) => ({
  watch: w,
  briefing: byId.value[w.group_id] || { name: '—', slug: '' },
})))

function cardOf(slug) {
  if (!cards.value[slug]) cards.value[slug] = { region: '', volume: 10, items: [], loaded: false }
  return cards.value[slug]
}

function draftOf(watch) {
  if (!drafts.value[watch.id]) {
    drafts.value[watch.id] = {
      region: watch.nuts.includes('EU') ? '' : watch.nuts[0],
      volume: watch.volume_per_week,
    }
  }
  return drafts.value[watch.id]
}

onMounted(async () => {
  document.title = 'Briefings — Dargle'
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

async function run(key, fn) {
  busy.value = key
  error.value = null
  try {
    await fn()
    watches.value = await listMyWatches()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = ''
  }
}

// ── the subscription list ───────────────────────────────────
function startEditing(watch) {
  editing.value = editing.value === watch.id ? '' : watch.id
  draftOf(watch)
}

async function saveWatch(watch) {
  const draft = draftOf(watch)
  await run(watch.id, () => adjustWatch(watch.id, {
    nuts: draft.region ? [draft.region] : ['EU'],
    volume_per_week: draft.volume,
  }))
  editing.value = ''
}

async function removeWatch(watch) {
  await run(watch.id, () => unwatch(watch.id))
}

async function copyFeed(url) {
  try {
    await navigator.clipboard.writeText(url)
    copied.value = url
    setTimeout(() => { copied.value = '' }, 2000)
  } catch {
    error.value = 'clipboard'
  }
}

// ── the catalogue ───────────────────────────────────────────
async function toggle(briefing) {
  if (expanded.value === briefing.slug) {
    expanded.value = ''
    return
  }
  expanded.value = briefing.slug
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
    card.loaded = true
  } catch (err) {
    error.value = err.message
  }
}

async function onAdd(briefing) {
  const card = cardOf(briefing.slug)
  await run(briefing.slug, () => addWatch(briefing.slug, {
    nuts: regionsOf(card), volume_per_week: card.volume,
  }))
}

function countFor(briefing) {
  return watches.value.filter((w) => w.group_id === briefing.id).length
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

    <!-- 1. What you are getting. -->
    <section v-if="authed && !loading" class="bf-subs" data-testid="subscriptions">
      <h2>{{ $t('briefings.manage') }}</h2>
      <p v-if="!subscriptions.length" class="bf-muted" data-testid="no-subs">
        {{ $t('briefings.watch_nothing_yet') }}
      </p>
      <ul v-else class="bf-sub-list">
        <li v-for="{ watch, briefing } in subscriptions" :key="watch.id" class="bf-sub-row">
          <div class="bf-sub-head">
            <span class="bf-sub-name">{{ briefing.name }}</span>
            <span class="bf-chips">
              <span v-for="r in watch.nuts" :key="r" class="bf-chip">{{ r }}</span>
              <span class="bf-chip">
                {{ $t('briefings.n_a_week', { n: watch.volume_per_week }) }}
              </span>
            </span>
            <button
class="bf-mini" :data-testid="`edit-${watch.id}`"
                    @click="startEditing(watch)">{{ $t('briefings.edit') }}</button>
            <button
class="bf-mini" :data-testid="`copy-${watch.id}`"
                    @click="copyFeed(watch.feed_url)">
              {{ copied === watch.feed_url ? $t('briefings.copied') : $t('briefings.copy_feed') }}
            </button>
            <button
class="bf-mini bf-danger" :disabled="busy === watch.id"
                    :data-testid="`remove-${watch.id}`"
                    @click="removeWatch(watch)">{{ $t('briefings.unwatch') }}</button>
          </div>

          <div
v-if="editing === watch.id" class="bf-controls"
               :data-testid="`editor-${watch.id}`">
            <label class="bf-field">
              <span>{{ $t('briefings.your_region') }}</span>
              <NutsRegionInput
                :model-value="draftOf(watch).region"
                @update:model-value="(v) => { draftOf(watch).region = v }"
              />
            </label>
            <label class="bf-field bf-narrow">
              <span>{{ $t('briefings.how_much') }}</span>
              <select
                :value="draftOf(watch).volume" :data-testid="`edit-volume-${watch.id}`"
                @change="(e) => { draftOf(watch).volume = Number(e.target.value) }"
              >
                <option v-for="v in VOLUMES" :key="v" :value="v">
                  {{ $t('briefings.n_a_week', { n: v }) }}
                </option>
              </select>
            </label>
            <button
class="bf-btn bf-primary" :disabled="busy === watch.id"
                    :data-testid="`save-${watch.id}`"
                    @click="saveWatch(watch)">{{ $t('app.save') }}</button>
          </div>
        </li>
      </ul>
    </section>

    <!-- 2. What else there is. -->
    <h2 v-if="!loading && briefings.length" class="bf-catalogue-title">
      {{ $t('briefings.available') }}
    </h2>
    <p v-if="!loading && !briefings.length" class="bf-muted" data-testid="empty">
      {{ $t('briefings.none_yet') }}
    </p>

    <ul v-if="briefings.length" class="bf-cards" data-testid="briefing-list">
      <li
v-for="b in briefings" :key="b.slug" class="bf-card"
          :class="{ 'is-open': expanded === b.slug }">
        <button
class="bf-card-head" :data-testid="`briefing-${b.slug}`"
                :aria-expanded="expanded === b.slug" @click="toggle(b)">
          <span class="bf-card-title">
            {{ b.name }}
            <span
v-if="countFor(b)" class="bf-chip is-watching"
                  :data-testid="`watching-${b.slug}`">
              {{ $t('briefings.n_watches', { n: countFor(b) }) }}
            </span>
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
              <button
v-if="authed" class="bf-btn bf-primary" :disabled="busy === b.slug"
                      :data-testid="`add-${b.slug}`" @click="onAdd(b)">
                {{ countFor(b) ? $t('briefings.add_another') : $t('briefings.watch') }}
              </button>
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
.bf-subs { border: 1px solid var(--border); border-radius: 10px; padding: 0.9rem 1rem; margin-bottom: 1.75rem; }
.bf-subs h2 { font-size: 1rem; margin: 0 0 0.5rem; }
.bf-sub-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; }
.bf-sub-row { display: grid; gap: 0.6rem; }
.bf-sub-row + .bf-sub-row { border-top: 1px solid var(--border); padding-top: 0.6rem; }
.bf-sub-head { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; font-size: 0.88rem; }
.bf-sub-name { font-weight: 600; }
.bf-catalogue-title { font-size: 1rem; margin: 0 0 0.6rem; }
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
.bf-mini { font: inherit; font-size: 0.78rem; padding: 0.25rem 0.6rem; border: 1px solid var(--border); border-radius: 7px; background: none; color: var(--accent); cursor: pointer; text-decoration: none; }
.bf-mini.bf-danger { color: #c0392b; border-color: color-mix(in srgb, #c0392b 40%, transparent); }
.bf-sample-title { font-size: 0.85rem; margin: 0; color: var(--muted); }
.bf-items { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.7rem; }
.bf-entry a { font-weight: 600; font-size: 0.92rem; color: var(--text); text-decoration: none; }
.bf-entry a:hover { color: var(--accent); text-decoration: underline; }
.bf-entry-meta { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; font-size: 0.74rem; color: var(--muted); margin: 0.25rem 0 0; }
.bf-chips { display: flex; gap: 0.3rem; flex-wrap: wrap; flex: 1; }
.bf-chip { font-size: 0.7rem; padding: 0.05rem 0.4rem; border: 1px solid var(--border); border-radius: 999px; color: var(--muted); }
.bf-chip.is-watching { border-color: var(--accent); color: var(--accent); }
.bf-value { font-variant-numeric: tabular-nums; }
</style>
