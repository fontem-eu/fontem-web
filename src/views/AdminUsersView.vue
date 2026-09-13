<script setup>
/**
 * Admin: the user directory.
 *
 * Every registered account with when it joined, last signed in, was last
 * seen and last changed something. The server decides who may see it; this
 * page only renders what it is given, and renders a refusal as a refusal.
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { listAdminUsers } from '../api/community.js'

const { t } = useI18n()

const PAGE_SIZE = 50
const SORTABLE = [
  { key: 'registered', label: 'admin.users_col_registered' },
  { key: 'last_login', label: 'admin.users_col_last_login' },
  { key: 'last_seen', label: 'admin.users_col_last_seen' },
  { key: 'last_activity', label: 'admin.users_col_last_activity' },
  { key: 'activity_count', label: 'admin.users_col_activity_count' },
]

const sort = ref('registered')
const offset = ref(0)
const page = ref(null)
const loading = ref(true)
const refused = ref(false)
const error = ref(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    page.value = await listAdminUsers({ sort: sort.value, limit: PAGE_SIZE, offset: offset.value })
    refused.value = false
  } catch (err) {
    page.value = null
    // A 403 is the server answering the question, not something going wrong.
    if (err.status === 403) refused.value = true
    else error.value = err.message
  } finally {
    loading.value = false
  }
}

function sortBy(key) {
  if (sort.value === key) return
  sort.value = key
  offset.value = 0
  load()
}

function nextPage() {
  offset.value += PAGE_SIZE
  load()
}

function previousPage() {
  offset.value = Math.max(0, offset.value - PAGE_SIZE)
  load()
}

const total = computed(() => page.value?.total ?? 0)
const hasPrevious = computed(() => offset.value > 0)
const hasNext = computed(() => offset.value + PAGE_SIZE < total.value)
const rangeFrom = computed(() => (total.value ? offset.value + 1 : 0))
const rangeTo = computed(() => Math.min(offset.value + PAGE_SIZE, total.value))

function day(iso) {
  return iso
    ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : '—'
}

function moment(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

/** Trust level first, then any explicit role it does not already say. */
function roleOf(user) {
  return [user.trust_level, ...(user.roles || []).filter((role) => role !== user.trust_level)].join(' · ')
}

onMounted(() => {
  document.title = t('admin.users')
  load()
})
</script>

<template>
  <div class="adu">
    <header class="adu-header">
      <router-link to="/admin" class="adu-back">{{ $t('nav.back_admin') }}</router-link>
      <h1>{{ $t('admin.users') }}</h1>
      <p class="adu-sub">{{ $t('admin.users_intro') }}</p>
    </header>

    <p v-if="loading" class="adu-note">{{ $t('app.loading_2') }}</p>
    <p v-else-if="refused" class="adu-note" data-testid="admin-users-refused">{{ $t('admin.users_refused') }}</p>
    <p v-else-if="error" class="adu-error" data-testid="admin-users-error">{{ error }}</p>

    <template v-else-if="page">
      <p class="adu-count" data-testid="admin-users-count">
        {{ $t('admin.users_count', { from: rangeFrom, to: rangeTo, total }) }}
      </p>
      <div class="adu-scroll">
        <table class="adu-table" data-testid="admin-users-table">
          <thead>
            <tr>
              <th scope="col">{{ $t('admin.users_col_account') }}</th>
              <th scope="col">{{ $t('admin.users_col_role') }}</th>
              <th
                v-for="column in SORTABLE"
                :key="column.key"
                scope="col"
                :aria-sort="sort === column.key ? 'descending' : 'none'"
              >
                <button
                  type="button"
                  class="adu-sort"
                  :class="{ active: sort === column.key }"
                  :data-testid="`admin-users-sort-${column.key}`"
                  @click="sortBy(column.key)"
                >{{ $t(column.label) }}</button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in page.users" :key="user.id" :data-testid="`admin-users-row-${user.id}`">
              <td>
                <div class="adu-name">{{ user.name || '—' }}</div>
                <div class="adu-email">
                  {{ user.email }}
                  <span
                    v-if="!user.email_verified"
                    class="adu-flag"
                    data-testid="admin-users-unverified"
                  >{{ $t('admin.users_unverified') }}</span>
                </div>
              </td>
              <td>{{ roleOf(user) }}</td>
              <td>{{ day(user.registered_at) }}</td>
              <td :title="user.last_login_at ? undefined : $t('admin.users_never_recorded')">
                {{ moment(user.last_login_at) }}
              </td>
              <td>{{ moment(user.last_seen_at) }}</td>
              <td>{{ moment(user.last_activity_at) }}</td>
              <td class="adu-num">{{ user.activity_count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <nav class="adu-pager">
        <button type="button" :disabled="!hasPrevious" data-testid="admin-users-previous" @click="previousPage">
          {{ $t('admin.users_previous') }}
        </button>
        <button type="button" :disabled="!hasNext" data-testid="admin-users-next" @click="nextPage">
          {{ $t('admin.users_next') }}
        </button>
      </nav>
      <p class="adu-legend">{{ $t('admin.users_legend') }}</p>
    </template>
  </div>
</template>

<style scoped>
.adu { max-width: 1100px; margin: 0 auto; padding: 0 1rem 4rem; }
.adu-header { padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1rem; }
.adu-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0.3rem 0 0; }
.adu-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.adu-sub, .adu-count, .adu-legend { font-size: 0.85rem; color: var(--muted); }
.adu-note { color: var(--muted); }
.adu-error { color: var(--danger, #b91c1c); }
.adu-scroll { overflow-x: auto; }
.adu-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.adu-table th, .adu-table td { text-align: left; padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--border); vertical-align: top; }
.adu-table th { font-weight: 600; white-space: nowrap; }
.adu-sort { background: none; border: 0; padding: 0; font: inherit; color: inherit; cursor: pointer; }
.adu-sort.active { color: var(--accent); }
.adu-sort.active::after { content: ' ↓'; }
.adu-name { font-weight: 600; }
.adu-email { color: var(--muted); word-break: break-all; }
.adu-flag { margin-left: 0.4rem; font-size: 0.75rem; padding: 0 0.35rem; border: 1px solid var(--border); border-radius: 4px; }
.adu-num { text-align: right; font-variant-numeric: tabular-nums; }
.adu-pager { display: flex; gap: 0.5rem; margin: 1rem 0; }
</style>
