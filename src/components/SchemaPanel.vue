<script setup>
/**
 * Browsable schema reference for the Data Studio — the store's shape made
 * visible (it isn't documented anywhere else). Per language: Cypher node labels
 * (+ their properties) and relationship types; SQL tables (+ columns); SPARQL
 * classes and predicates. Fed by /api/query/schema/{lang}.
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useQuerySchema } from '../composables/useQuerySchema.js'

const props = defineProps({ lang: { type: String, default: 'cypher' } })
const qs = useQuerySchema()
const loading = ref(false)
const open = ref({})

async function load() {
  loading.value = true
  await qs.loadSchema(props.lang)
  loading.value = false
}
onMounted(load)
watch(() => props.lang, load)

const schema = computed(() => qs.cache[props.lang] || null)
const toggle = (k) => { open.value[k] = !open.value[k] }
const localName = (uri) => (uri || '').split(/[#/]/).findLast(Boolean) || uri
</script>

<template>
  <aside class="schema" data-testid="schema-panel">
    <div class="schema-head">Schema <span class="muted">· {{ lang }}</span></div>
    <p v-if="loading && !schema" class="muted small">Loading schema…</p>
    <p v-else-if="!schema" class="muted small">Schema unavailable.</p>

    <template v-else-if="lang === 'cypher'">
      <div class="grp">Node labels</div>
      <ul class="list">
        <li v-for="l in schema.labels" :key="l" data-testid="schema-label">
          <button type="button" class="term" @click="toggle('l:' + l)">
            <span class="chev" :class="{ open: open['l:' + l] }">▸</span><span class="tclass">{{ l }}</span>
          </button>
          <ul v-if="open['l:' + l]" class="props">
            <li v-for="p in (schema.labelProperties[l] || [])" :key="p" class="tprop">{{ p }}</li>
            <li v-if="!(schema.labelProperties[l] || []).length" class="muted small">no recorded properties</li>
          </ul>
        </li>
      </ul>
      <div class="grp">Relationships</div>
      <ul class="list flat"><li v-for="r in schema.relationshipTypes" :key="r" class="trel" data-testid="schema-rel">{{ r }}</li></ul>
    </template>

    <template v-else-if="lang === 'sql'">
      <div class="grp">Tables</div>
      <ul class="list">
        <li v-for="tb in schema.tables" :key="tb.name" data-testid="schema-table">
          <button type="button" class="term" @click="toggle('t:' + tb.name)">
            <span class="chev" :class="{ open: open['t:' + tb.name] }">▸</span><span class="tclass">{{ tb.name }}</span>
          </button>
          <ul v-if="open['t:' + tb.name]" class="props">
            <li v-for="c in tb.columns" :key="c.name" class="tprop">{{ c.name }} <span class="muted small">{{ c.type }}</span></li>
          </ul>
        </li>
      </ul>
    </template>

    <template v-else-if="lang === 'sparql'">
      <div class="grp">Classes</div>
      <ul class="list flat"><li v-for="c in schema.classes" :key="c" class="tclass" :title="c" data-testid="schema-class">{{ localName(c) }}</li></ul>
      <div class="grp">Predicates</div>
      <ul class="list flat"><li v-for="p in schema.predicates" :key="p" class="tprop" :title="p" data-testid="schema-pred">{{ localName(p) }}</li></ul>
    </template>
  </aside>
</template>

<style scoped>
.schema { border: 1px solid var(--border); border-radius: 10px; background: var(--surface); padding: 0.6rem 0.7rem; font-size: 0.8rem; max-height: 30rem; overflow: auto; }
.schema-head { font-weight: 700; font-size: 0.82rem; margin-bottom: 0.4rem; }
.muted { color: var(--muted); }
.small { font-size: 0.72rem; }
.grp { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 0.6rem 0 0.2rem; font-weight: 700; }
.list { list-style: none; margin: 0; padding: 0; }
.list.flat { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.term { display: flex; align-items: center; gap: 0.2rem; border: 0; background: transparent; color: var(--text); cursor: pointer; font-size: 0.8rem; padding: 0.15rem 0; width: 100%; text-align: left; }
.chev { font-size: 0.6rem; color: var(--muted); transition: transform 0.14s; }
.chev.open { transform: rotate(90deg); }
.props { list-style: none; margin: 0.1rem 0 0.3rem 1rem; padding: 0; }
.tclass { color: #0369a1; font-weight: 600; font-family: ui-monospace, monospace; }
.trel { color: #7c3aed; font-family: ui-monospace, monospace; background: color-mix(in srgb, var(--accent) 8%, transparent); border-radius: 5px; padding: 0.05rem 0.35rem; }
.tprop { color: var(--text); font-family: ui-monospace, monospace; padding: 0.1rem 0; }
.list.flat .tprop, .list.flat .tclass { background: color-mix(in srgb, var(--border) 40%, transparent); border-radius: 5px; padding: 0.05rem 0.35rem; }
:global(.dark) .tclass { color: #7dd3fc; }
:global(.dark) .trel { color: #c4b5fd; }
</style>
