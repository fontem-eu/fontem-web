<script setup>
/**
 * Admin: query groups.
 *
 * A query group is an ordered set of named queries — "Public investment",
 * "Corporate influence" — and is what the public feed picker shows. Adding a
 * group is authoring content, not a schema migration.
 *
 * Membership is many-to-many and ordered, and the order lives on the
 * membership rather than the query, so the same query can sit at a different
 * position in each group it belongs to. The whole membership is saved at
 * once: the UI edits an ordered list, and expressing a positional edit as a
 * diff is where ordering bugs live.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  listQueryGroups, createQueryGroup, updateQueryGroup, deleteQueryGroup,
  setQueryGroupQueries, listNamedQueries,
} from '../api/community.js'

const { t } = useI18n()

const groups = ref([])
const allQueries = ref([])
const selected = ref(null)
const draft = ref(null)
const members = ref([])
const loading = ref(true)
const busy = ref('')
const error = ref(null)

const available = computed(
  () => allQueries.value.filter((q) => !members.value.some((m) => m.id === q.id)),
)
const memberIds = computed(() => members.value.map((m) => m.id))
const membershipDirty = computed(() => {
  if (!selected.value) return false
  return JSON.stringify(memberIds.value)
    !== JSON.stringify((selected.value.queries || []).map((q) => q.id))
})

onMounted(async () => {
  document.title = 'Query groups — Fontem'
  await load()
})

async function load(keepId) {
  loading.value = true
  error.value = null
  try {
    ;[groups.value, allQueries.value] = await Promise.all([
      listQueryGroups(), listNamedQueries(),
    ])
    const id = keepId || selected.value?.id
    const found = id ? groups.value.find((g) => g.id === id) : null
    if (found) select(found)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function select(group) {
  selected.value = group
  draft.value = { ...group }
  members.value = [...(group.queries || [])]
}

function startNew() {
  selected.value = null
  members.value = []
  draft.value = {
    id: null, slug: '', name: '', description: '', sort_order: 0, visibility: 'public',
  }
}

async function run(action, fn) {
  busy.value = action
  error.value = null
  try {
    return await fn()
  } catch (err) {
    error.value = err.message
    return null
  } finally {
    busy.value = ''
  }
}

async function save() {
  const body = {
    slug: draft.value.slug,
    name: draft.value.name,
    description: draft.value.description,
    sort_order: Number(draft.value.sort_order) || 0,
    visibility: draft.value.visibility,
  }
  const saved = await run('save', () => (draft.value.id
    ? updateQueryGroup(draft.value.id, body)
    : createQueryGroup(body)))
  if (saved) await load(saved.id)
}

async function saveMembership() {
  const saved = await run('members',
    () => setQueryGroupQueries(selected.value.id, memberIds.value))
  if (saved) await load(saved.id)
}

async function remove() {
  if (!globalThis.confirm(t('feeds.confirm_delete_group'))) return
  const ok = await run('delete', async () => { await deleteQueryGroup(selected.value.id); return true })
  if (ok) {
    selected.value = null
    draft.value = null
    members.value = []
    await load(null)
  }
}

function add(query) {
  members.value = [...members.value, query]
}

function drop(index) {
  members.value = members.value.filter((_, i) => i !== index)
}

function move(index, delta) {
  const next = [...members.value]
  const target = index + delta
  if (target < 0 || target >= next.length) return
  ;[next[index], next[target]] = [next[target], next[index]]
  members.value = next
}
</script>

<template>
  <div class="qg">
    <header class="qg-header">
      <div>
        <router-link to="/admin" class="qg-back">{{ $t('nav.back_admin') }}</router-link>
        <h1>{{ $t('feeds.query_groups') }}</h1>
        <p class="qg-sub">{{ $t('feeds.query_groups_intro') }}</p>
      </div>
      <button class="qg-btn qg-primary" data-testid="new-group" @click="startNew">
        {{ $t('feeds.new_group') }}
      </button>
    </header>

    <p v-if="error" class="qg-error" data-testid="error">{{ error }}</p>
    <p v-if="loading" class="qg-muted">{{ $t('app.loading') }}</p>

    <div class="qg-body">
      <ul class="qg-list" data-testid="group-list">
        <li v-for="g in groups" :key="g.id">
          <button
            class="qg-item" :class="{ 'is-active': selected && selected.id === g.id }"
            @click="select(g)"
          >
            <span class="qg-item-name">{{ g.name || g.slug }}</span>
            <span class="qg-meta">
              <span class="qg-chip">{{ g.visibility }}</span>
              <span class="qg-muted">{{ $t('feeds.n_queries', { n: (g.queries || []).length }) }}</span>
            </span>
          </button>
        </li>
        <li v-if="!loading && !groups.length" class="qg-muted qg-empty">
          {{ $t('feeds.no_groups') }}
        </li>
      </ul>

      <section v-if="draft" class="qg-editor" data-testid="editor">
        <div class="qg-row">
          <label class="qg-field">
            <span>{{ $t('feeds.name') }}</span>
            <input v-model="draft.name" type="text" data-testid="field-name" />
          </label>
          <label class="qg-field">
            <span>{{ $t('feeds.slug') }}</span>
            <input v-model="draft.slug" type="text" data-testid="field-slug" />
          </label>
          <label class="qg-field qg-narrow">
            <span>{{ $t('feeds.visibility') }}</span>
            <select v-model="draft.visibility" data-testid="field-visibility">
              <option value="public">public</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <label class="qg-field qg-narrow">
            <span>{{ $t('feeds.sort_order') }}</span>
            <input v-model="draft.sort_order" type="number" data-testid="field-sort" />
          </label>
        </div>

        <label class="qg-field">
          <span>{{ $t('feeds.description') }}</span>
          <textarea v-model="draft.description" rows="2" data-testid="field-description" />
        </label>

        <div class="qg-actions">
          <button
class="qg-btn qg-primary" :disabled="busy === 'save'" data-testid="save"
                  @click="save">
            {{ draft.id ? $t('app.save') : $t('feeds.create') }}
          </button>
          <button v-if="selected" class="qg-btn qg-danger" data-testid="delete" @click="remove">
            {{ $t('feeds.delete') }}
          </button>
        </div>

        <!-- membership -->
        <section v-if="selected" class="qg-panel" data-testid="membership">
          <h2>{{ $t('feeds.queries_in_group') }}</h2>
          <p class="qg-muted">{{ $t('feeds.membership_hint') }}</p>
          <ol class="qg-members" data-testid="members">
            <li v-for="(m, i) in members" :key="m.id">
              <span class="qg-member-name">{{ m.name || m.slug }}</span>
              <span class="qg-chip" :class="`is-${m.status}`">{{ m.status }}</span>
              <span class="qg-member-actions">
                <button
class="qg-mini" :disabled="i === 0" :data-testid="`up-${m.id}`"
                        :aria-label="$t('feeds.move_up')" @click="move(i, -1)">↑</button>
                <button
class="qg-mini" :disabled="i === members.length - 1"
                        :data-testid="`down-${m.id}`"
                        :aria-label="$t('feeds.move_down')" @click="move(i, 1)">↓</button>
                <button
class="qg-mini" :data-testid="`remove-${m.id}`"
                        :aria-label="$t('feeds.remove_from_group')" @click="drop(i)">×</button>
              </span>
            </li>
            <li v-if="!members.length" class="qg-muted">{{ $t('feeds.group_empty') }}</li>
          </ol>

          <h3>{{ $t('feeds.add_query') }}</h3>
          <ul class="qg-available" data-testid="available">
            <li v-for="q in available" :key="q.id">
              <button class="qg-add" :data-testid="`add-${q.id}`" @click="add(q)">
                + {{ q.name || q.slug }}
              </button>
            </li>
            <li v-if="!available.length" class="qg-muted">{{ $t('feeds.all_queries_added') }}</li>
          </ul>

          <div class="qg-actions">
            <button
class="qg-btn qg-primary" :disabled="!membershipDirty || busy === 'members'"
                    data-testid="save-members" @click="saveMembership">
              {{ $t('feeds.save_membership') }}
            </button>
          </div>
        </section>
      </section>
    </div>
  </div>
</template>

<style scoped>
.qg { max-width: 1100px; margin: 0 auto; padding: 0 1rem 4rem; }
.qg-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.qg-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0.3rem 0 0; }
.qg-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.qg-sub { font-size: 0.85rem; color: var(--muted); margin-top: 0.3rem; }
.qg-muted { color: var(--muted); font-size: 0.85rem; }
.qg-error { color: var(--danger, #c0392b); font-size: 0.85rem; margin: 0.5rem 0; }
.qg-body { display: grid; grid-template-columns: minmax(200px, 280px) 1fr; gap: 1.5rem; align-items: start; }
@media (max-width: 800px) { .qg-body { grid-template-columns: 1fr; } }
.qg-list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.qg-empty { padding: 0.9rem; }
.qg-item { display: grid; gap: 0.2rem; width: 100%; text-align: left; padding: 0.7rem 0.9rem; background: none; border: none; border-bottom: 1px solid var(--border); cursor: pointer; color: inherit; }
.qg-item:hover { background: color-mix(in srgb, var(--accent) 7%, transparent); }
.qg-item.is-active { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.qg-item-name { font-weight: 600; font-size: 0.9rem; }
.qg-meta { display: flex; gap: 0.4rem; align-items: center; }
.qg-chip { font-size: 0.7rem; padding: 0.05rem 0.4rem; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); }
.qg-chip.is-published { border-color: var(--accent); color: var(--accent); }
.qg-editor { display: grid; gap: 0.9rem; }
.qg-row { display: flex; gap: 0.8rem; flex-wrap: wrap; }
.qg-field { display: grid; gap: 0.25rem; font-size: 0.8rem; color: var(--muted); flex: 1 1 180px; }
.qg-field.qg-narrow { flex: 0 0 130px; }
.qg-field input, .qg-field select, .qg-field textarea { font: inherit; font-size: 0.9rem; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.45rem 0.6rem; }
.qg-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.qg-btn { font: inherit; font-size: 0.85rem; padding: 0.45rem 0.9rem; border-radius: 8px; border: 1px solid var(--border); background: var(--surface, #f6f8fa); color: inherit; cursor: pointer; }
.qg-btn:disabled { opacity: 0.5; cursor: default; }
.qg-primary { border-color: var(--accent); color: var(--accent); }
.qg-danger { border-color: #c0392b; color: #c0392b; }
.qg-panel { border: 1px solid var(--border); border-radius: 10px; padding: 0.9rem 1rem; display: grid; gap: 0.5rem; }
.qg-panel h2 { font-size: 1rem; margin: 0; }
.qg-panel h3 { font-size: 0.85rem; margin: 0.6rem 0 0; }
.qg-members { list-style: decimal inside; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
.qg-members li { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
.qg-member-name { flex: 1; }
.qg-member-actions { display: flex; gap: 0.2rem; }
.qg-mini { font: inherit; font-size: 0.8rem; line-height: 1; padding: 0.2rem 0.4rem; border: 1px solid var(--border); border-radius: 6px; background: none; color: inherit; cursor: pointer; }
.qg-mini:disabled { opacity: 0.35; cursor: default; }
.qg-available { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.3rem; }
.qg-add { font: inherit; font-size: 0.8rem; padding: 0.25rem 0.6rem; border: 1px dashed var(--border); border-radius: 999px; background: none; color: inherit; cursor: pointer; }
</style>
