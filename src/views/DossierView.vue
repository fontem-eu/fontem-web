<script setup>
/**
 * Dossier — a tree of articles. Left: the TreeNav (navigate / add sub-article /
 * remove). Middle: the selected article (open it in the full editor). Creating
 * an article makes a story and attaches it to the dossier at the chosen parent.
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getDossier, addDossierArticle, removeDossierArticle, createReport,
} from '../api/community.js'
import TreeNav from '../components/TreeNav.vue'
import DossierShareModal from '../components/DossierShareModal.vue'

const route = useRoute()
const router = useRouter()
const id = route.params.id

const dossier = ref(null)
const articles = ref([])
const selectedId = ref(null)
const showShare = ref(false)
const loading = ref(true)
const error = ref(null)

const selected = computed(() => articles.value.find((a) => a.id === selectedId.value) || null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const d = await getDossier(id)
    dossier.value = d
    articles.value = d.articles || []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function newArticle(parentId = null) {
  error.value = null
  try {
    const story = await createReport('Untitled article', '')
    await addDossierArticle(id, story.id, parentId)
    await load()
    selectedId.value = story.id
  } catch (e) {
    error.value = e.message
  }
}
async function onRemove(nodeId) {
  error.value = null
  try {
    await removeDossierArticle(id, nodeId)
    if (selectedId.value === nodeId) selectedId.value = null
    await load()
  } catch (e) {
    error.value = e.message
  }
}
function editArticle() {
  if (selected.value) router.push(`/stories/${selected.value.id}/edit`)
}
</script>

<template>
  <div class="dv" data-testid="dossier-view">
    <router-link to="/my-stories" class="dv-back">{{ $t('investigations.back_stories') }}</router-link>
    <p v-if="error" class="dv-error" data-testid="dossier-error">{{ error }}</p>
    <p v-if="loading" class="dv-msg">{{ $t('app.loading') }}</p>

    <template v-else-if="dossier">
      <header class="dv-header">
        <h1 data-testid="dossier-title">{{ dossier.name }}</h1>
        <button class="inv-primary" data-testid="dossier-share-btn" @click="showShare = true">
          {{ $t('investigations.share_dossier') }}
        </button>
      </header>
      <DossierShareModal v-if="showShare" :dossier-id="id" @close="showShare = false" />
      <div class="dv-body">
        <aside class="dv-tree">
          <button class="inv-primary" data-testid="dossier-new-article" @click="newArticle(null)">
            {{ $t('investigations.new_article') }}
          </button>
          <TreeNav
            :nodes="articles"
            :selected-id="selectedId"
            @select="(nid) => (selectedId = nid)"
            @add-child="newArticle"
            @remove="onRemove"
          />
        </aside>
        <section class="dv-main" data-testid="dossier-main">
          <template v-if="selected">
            <h2 data-testid="dossier-selected-title">{{ selected.title || 'Untitled' }}</h2>
            <button class="inv-primary" data-testid="dossier-edit-article" @click="editArticle">
              {{ $t('investigations.open_in_editor') }}
            </button>
          </template>
          <p v-else class="dv-msg">{{ $t('investigations.select_article') }}</p>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dv { max-width: 72rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
.dv-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.dv-header h1 { font-size: 1.3rem; font-weight: 700; margin: 0.5rem 0; }
.dv-error { color: #dc2626; padding: 0.5rem 0; }
.dv-msg { color: var(--muted); padding: 0.5rem; }
.dv-body { display: flex; gap: 1.5rem; align-items: flex-start; }
.dv-tree { width: 16rem; flex-shrink: 0; border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem; }
.dv-tree .inv-primary { width: 100%; margin-bottom: 0.5rem; }
.dv-main { flex: 1; min-width: 0; border: 1px solid var(--border); border-radius: 8px; padding: 1rem; min-height: 12rem; }
.dv-main h2 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.75rem; }
.inv-primary { background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.82rem; }
</style>
