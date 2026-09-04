<script setup>
/**
 * Investigations — the user's workspaces (GitHub-Organizations style, reached
 * from the account menu). Lists every investigation the caller belongs to with
 * their role, plus a Create button. Membership permissions are managed in the
 * detail view.
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listInvestigations, createInvestigation } from '../api/community.js'
import { roleLabel } from '../utils/investigationRole.js'

const router = useRouter()
const items = ref([])
const loading = ref(true)
const error = ref(null)
const showCreate = ref(false)
const newName = ref('')
const newDesc = ref('')
const creating = ref(false)

async function load() {
  loading.value = true
  error.value = null
  try {
    items.value = (await listInvestigations()) || []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)
onMounted(() => { document.title = 'Investigations — Dargle' })

function openCreate() {
  newName.value = ''
  newDesc.value = ''
  showCreate.value = true
}
async function confirmCreate() {
  if (!newName.value.trim()) return
  creating.value = true
  error.value = null
  try {
    const inv = await createInvestigation(newName.value.trim(), newDesc.value.trim())
    showCreate.value = false
    if (inv?.id) router.push(`/investigations/${inv.id}`)
  } catch (e) {
    error.value = e.message
  } finally {
    creating.value = false
  }
}
function open(id) { router.push(`/investigations/${id}`) }
</script>

<template>
  <div class="inv-page" data-testid="investigations-view">
    <header class="inv-header">
      <h1>{{ $t('investigations.title') }}</h1>
      <button class="inv-primary" data-testid="new-investigation-btn" @click="openCreate">
        {{ $t('investigations.create') }}
      </button>
    </header>

    <p v-if="error" class="inv-error" data-testid="investigations-error">{{ error }}</p>
    <p v-if="loading" class="inv-msg">{{ $t('app.loading') }}</p>
    <p v-else-if="!items.length" class="inv-msg" data-testid="investigations-empty">
      {{ $t('investigations.empty') }}
    </p>
    <ul v-else class="inv-list" data-testid="investigation-list">
      <li
        v-for="it in items"
        :key="it.id"
        class="inv-card"
        :data-testid="'investigation-card-' + it.id"
        @click="open(it.id)"
      >
        <div class="inv-card-main">
          <span class="inv-card-name">{{ it.name }}</span>
          <span class="inv-card-desc">{{ it.description }}</span>
        </div>
        <span class="inv-role" data-testid="investigation-role">{{ roleLabel(it.membership) }}</span>
      </li>
    </ul>

    <div
      v-if="showCreate"
      class="inv-modal"
      data-testid="investigation-create-modal"
      @click.self="showCreate = false"
    >
      <div class="inv-modal-card">
        <h3>{{ $t('investigations.create') }}</h3>
        <input
          v-model="newName"
          class="inv-input"
          :placeholder="$t('investigations.name')"
          data-testid="investigation-name-input"
          @keydown.enter="confirmCreate"
        />
        <textarea
          v-model="newDesc"
          class="inv-input"
          :placeholder="$t('investigations.description')"
          data-testid="investigation-desc-input"
        />
        <div class="inv-modal-actions">
          <button @click="showCreate = false">{{ $t('app.cancel') }}</button>
          <button
            class="inv-primary"
            :disabled="creating || !newName.trim()"
            data-testid="create-investigation-confirm"
            @click="confirmCreate"
          >{{ creating ? $t('app.loading') : $t('investigations.create') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inv-page { max-width: 56rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
.inv-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.inv-header h1 { font-size: 1.3rem; font-weight: 700; }
.inv-primary { background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 0.45rem 0.9rem; cursor: pointer; font-size: 0.85rem; }
.inv-primary:disabled { opacity: 0.6; cursor: default; }
.inv-msg { color: var(--muted); padding: 1rem 0; }
.inv-error { color: #dc2626; padding: 0.5rem 0; }
.inv-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.inv-card { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.85rem 1rem; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; background: var(--surface); }
.inv-card:hover { border-color: var(--accent); }
.inv-card-main { display: flex; flex-direction: column; min-width: 0; }
.inv-card-name { font-weight: 600; color: var(--text); }
.inv-card-desc { font-size: 0.8rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.inv-role { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--accent); border: 1px solid var(--border); border-radius: 999px; padding: 0.15rem 0.6rem; flex-shrink: 0; }
.inv-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.inv-modal-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; width: 90%; max-width: 420px; display: flex; flex-direction: column; gap: 0.6rem; }
.inv-modal-card h3 { font-size: 1rem; font-weight: 700; }
.inv-input { width: 100%; padding: 0.5rem 0.6rem; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text); font-size: 0.85rem; box-sizing: border-box; }
textarea.inv-input { min-height: 4rem; resize: vertical; }
.inv-modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
.inv-modal-actions button { padding: 0.4rem 0.8rem; border: 1px solid var(--border); border-radius: 4px; background: var(--surface); color: var(--text); cursor: pointer; }
</style>
