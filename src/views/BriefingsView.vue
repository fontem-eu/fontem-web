<script setup>
/**
 * Briefings — browse what there is to watch, and watch it.
 *
 * A briefing is a curated set of queries about one subject. Picking one and
 * picking your regions is the whole of the personalisation: no query is ever
 * shown, and nobody has to know what a NUTS code is to use the picker.
 *
 * Browsing is anonymous on purpose. Deciding whether a briefing is worth
 * watching means seeing what is actually in it, and asking someone to sign up
 * first is asking them to buy unseen.
 *
 * "How much do you want" is a VOLUME, never a threshold. Measured on prod, the
 * 95th percentile of contract value is EUR 5.7M in Coimbra and EUR 10.8M
 * across the EU — one threshold starves a small region and floods a large one
 * at the same time, so the platform ranks and the reader states an appetite.
 */
import { ref, computed, onMounted, watch as vueWatch } from 'vue'
import { isAuthed } from '../api/session.js'
import NutsRegionInput from '../components/NutsRegionInput.vue'
import {
  listBriefings, getBriefing, watchBriefing, listMyWatches, unwatch,
} from '../api/community.js'

const VOLUMES = [3, 10, 25, 50]

const briefings = ref([])
const selected = ref(null)
const detail = ref(null)
const watches = ref([])
const region = ref('')
const volume = ref(10)
const loading = ref(true)
const busy = ref(false)
const error = ref(null)

const authed = computed(() => isAuthed.value)
// The input can return 'EU' explicitly, which already means everywhere;
// anything else is a single NUTS prefix. An empty box means the reader has
// not chosen, and the whole of Europe is the sane default for a preview.
const regions = computed(() => (region.value ? [region.value] : ['EU']))
const currentWatch = computed(
  () => watches.value.find((w) => w.group_id === detail.value?.id) || null,
)

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
    if (briefings.value.length && !selected.value) await select(briefings.value[0].slug)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function select(slug) {
  selected.value = slug
  await refresh()
}

async function refresh() {
  if (!selected.value) return
  error.value = null
  try {
    detail.value = await getBriefing(selected.value,
      { nuts: regions.value, volume: volume.value })
  } catch (err) {
    error.value = err.message
  }
}

// Re-preview whenever the reader changes what they are asking for, so the
// sample always reflects the settings the Watch button would save.
vueWatch([region, volume], refresh)

async function onWatch() {
  busy.value = true
  error.value = null
  try {
    await watchBriefing(selected.value,
      { nuts: regions.value, volume_per_week: volume.value })
    watches.value = await listMyWatches()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

async function onUnwatch() {
  busy.value = true
  error.value = null
  try {
    await unwatch(currentWatch.value.id)
    watches.value = await listMyWatches()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
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

    <div v-if="briefings.length" class="bf-body">
      <ul class="bf-list" data-testid="briefing-list">
        <li v-for="b in briefings" :key="b.slug">
          <button
            class="bf-item" :class="{ 'is-active': selected === b.slug }"
            :data-testid="`briefing-${b.slug}`"
            @click="select(b.slug)"
          >
            <span class="bf-item-name">{{ b.name }}</span>
            <span class="bf-item-desc">{{ b.description }}</span>
          </button>
        </li>
      </ul>

      <section v-if="detail" class="bf-detail" data-testid="detail">
        <div class="bf-controls">
          <label class="bf-field">
            <span>{{ $t('briefings.your_region') }}</span>
            <NutsRegionInput v-model="region" />
          </label>
          <label class="bf-field bf-narrow">
            <span>{{ $t('briefings.how_much') }}</span>
            <select v-model.number="volume" data-testid="volume">
              <option v-for="v in VOLUMES" :key="v" :value="v">
                {{ $t('briefings.n_a_week', { n: v }) }}
              </option>
            </select>
          </label>
          <div class="bf-actions">
            <button
              v-if="authed && !currentWatch" class="bf-btn bf-primary"
              :disabled="busy" data-testid="watch" @click="onWatch"
            >{{ $t('briefings.watch') }}</button>
            <template v-else-if="authed">
              <button
                class="bf-btn" :disabled="busy" data-testid="update-watch" @click="onWatch"
              >{{ $t('briefings.update_watch') }}</button>
              <button
                class="bf-btn bf-danger" :disabled="busy"
                data-testid="unwatch" @click="onUnwatch"
              >{{ $t('briefings.unwatch') }}</button>
            </template>
            <router-link v-else to="/login" class="bf-btn bf-primary" data-testid="watch-login">
              {{ $t('briefings.sign_in_to_watch') }}
            </router-link>
          </div>
        </div>

        <p v-if="currentWatch" class="bf-watching" data-testid="watching-note">
          {{ $t('briefings.you_are_watching') }}
          <router-link to="/my-briefings">{{ $t('briefings.see_my_briefings') }}</router-link>
        </p>

        <h2 class="bf-preview-title">{{ $t('briefings.whats_in_it') }}</h2>
        <p v-if="!detail.items.length" class="bf-muted" data-testid="no-items">
          {{ $t('briefings.nothing_here_yet') }}
        </p>
        <ol v-else class="bf-items" data-testid="items">
          <li v-for="item in detail.items" :key="item.item_id" class="bf-entry">
            <a :href="item.link" target="_blank" rel="noopener noreferrer">{{ item.title }}</a>
            <p v-if="item.summary" class="bf-entry-summary">{{ item.summary }}</p>
            <p class="bf-entry-meta">
              <time>{{ fmtDate(item.item_time) }}</time>
              <span v-for="r in item.nuts" :key="r" class="bf-chip">{{ r }}</span>
              <span v-if="item.rank_value" class="bf-value">{{ fmtValue(item.rank_value) }}</span>
            </p>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>

<style scoped>
.bf { max-width: 1100px; margin: 0 auto; padding: 0 1rem 4rem; }
.bf-header { padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.bf-header h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
.bf-sub { font-size: 0.9rem; color: var(--muted); margin-top: 0.4rem; max-width: 55ch; }
.bf-muted { color: var(--muted); font-size: 0.9rem; }
.bf-error { color: #c0392b; font-size: 0.85rem; margin: 0.5rem 0; }
.bf-body { display: grid; grid-template-columns: minmax(200px, 280px) 1fr; gap: 1.5rem; align-items: start; }
@media (max-width: 820px) { .bf-body { grid-template-columns: 1fr; } }
.bf-list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.bf-item { display: grid; gap: 0.2rem; width: 100%; text-align: left; padding: 0.8rem 0.9rem; background: none; border: none; border-bottom: 1px solid var(--border); cursor: pointer; color: inherit; }
.bf-item:hover { background: color-mix(in srgb, var(--accent) 7%, transparent); }
.bf-item.is-active { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.bf-item-name { font-weight: 600; font-size: 0.95rem; }
.bf-item-desc { font-size: 0.8rem; color: var(--muted); }
.bf-detail { display: grid; gap: 1rem; }
.bf-controls { display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end; }
.bf-field { display: grid; gap: 0.3rem; font-size: 0.82rem; color: var(--muted); flex: 1 1 260px; }
.bf-field.bf-narrow { flex: 0 0 170px; }
.bf-field small { font-size: 0.75rem; }
.bf-field select { font: inherit; font-size: 0.9rem; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.45rem 0.6rem; }
.bf-actions { display: flex; gap: 0.5rem; }
.bf-btn { font: inherit; font-size: 0.88rem; padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid var(--border); background: var(--surface, #f6f8fa); color: inherit; cursor: pointer; text-decoration: none; }
.bf-btn:disabled { opacity: 0.5; cursor: default; }
.bf-primary { border-color: var(--accent); color: var(--accent); font-weight: 600; }
.bf-danger { border-color: #c0392b; color: #c0392b; }
.bf-watching { font-size: 0.85rem; color: var(--muted); margin: 0; }
.bf-preview-title { font-size: 1rem; margin: 0.5rem 0 0; }
.bf-items { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.9rem; }
.bf-entry { border-bottom: 1px solid var(--border); padding-bottom: 0.8rem; }
.bf-entry a { font-weight: 600; font-size: 0.95rem; color: var(--text); text-decoration: none; }
.bf-entry a:hover { color: var(--accent); text-decoration: underline; }
.bf-entry-summary { font-size: 0.85rem; color: var(--muted); margin: 0.25rem 0 0; }
.bf-entry-meta { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; font-size: 0.75rem; color: var(--muted); margin: 0.35rem 0 0; }
.bf-chip { padding: 0.05rem 0.4rem; border: 1px solid var(--border); border-radius: 999px; }
.bf-value { font-variant-numeric: tabular-nums; }
</style>
