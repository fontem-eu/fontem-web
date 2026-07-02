<script setup>
/**
 * CodeMirror 6 query editor for the Data Studio. Syntax highlighting per
 * language (SQL via lang-sql; Cypher/SPARQL via legacy StreamLanguage modes)
 * and schema-aware autocomplete — real node labels / tables / classes and their
 * properties / columns / predicates, fetched from /api/query/schema/{lang}.
 *
 * CodeMirror 6 is CSP-safe (Lezer/StreamLanguage parsers, no eval / new
 * Function), unlike Monaco — important under our strict script-src.
 */
import { ref, watch, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, placeholder as cmPlaceholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { StreamLanguage, syntaxHighlighting, HighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { sql } from '@codemirror/lang-sql'
import { cypher } from '@codemirror/legacy-modes/mode/cypher'
import { sparql } from '@codemirror/legacy-modes/mode/sparql'
import { tags as t } from '@lezer/highlight'
import { useQuerySchema } from '../composables/useQuerySchema.js'
import { completionSource, sqlSchemaMap } from '../composables/schemaCompletions.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  lang: { type: String, default: 'cypher' },
  placeholder: { type: String, default: '' },
  schema: { type: Object, default: null },  // explicit override (e.g. the plot transform's source aliases)
})
const emit = defineEmits(['update:modelValue', 'run'])

const el = ref(null)
const view = shallowRef(null)
const qs = useQuerySchema()
const effectiveSchema = () => props.schema || qs.cache[props.lang]

const hl = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: 'var(--cm-kw)', fontWeight: '600' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--cm-str)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--cm-num)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--cm-cmt)', fontStyle: 'italic' },
  { tag: [t.typeName, t.className, t.tagName, t.labelName, t.namespace], color: 'var(--cm-entity)', fontWeight: '600' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--cm-prop)' },
  { tag: [t.variableName, t.definition(t.variableName)], color: 'var(--cm-var)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: 'var(--cm-fn)' },
  { tag: [t.operator, t.punctuation, t.bracket, t.separator], color: 'var(--cm-punct)' },
])

const theme = EditorView.theme({
  '&': { fontSize: '0.85rem', backgroundColor: 'var(--bg)', color: 'var(--text)', borderRadius: '8px' },
  '&.cm-focused': { outline: '1px solid var(--accent)' },
  '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: '0.6rem 0' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--muted)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--accent) 6%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '.cm-tooltip': { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)', color: 'var(--text)' },
  '.cm-completionIcon': { paddingRight: '1.1em', opacity: '0.8' },
  '.cm-completionDetail': { color: 'var(--muted)', fontStyle: 'normal', marginLeft: '0.6em' },
})

const langC = new Compartment()
const complC = new Compartment()

function langExt(lang, schema) {
  if (lang === 'sql') return sql({ schema: sqlSchemaMap(schema), upperCaseKeywords: true })
  return StreamLanguage.define(lang === 'sparql' ? sparql : cypher)
}
function complExt(lang, schema) {
  if (lang === 'sql') return autocompletion()
  return autocompletion({ override: [completionSource(lang, schema)] })
}

function reconfigure() {
  if (!view.value) return
  const schema = effectiveSchema()
  view.value.dispatch({ effects: [
    langC.reconfigure(langExt(props.lang, schema)),
    complC.reconfigure(complExt(props.lang, schema)),
  ] })
}

onMounted(() => {
  view.value = new EditorView({
    parent: el.value,
    state: EditorState.create({
      doc: props.modelValue || '',
      extensions: [
        lineNumbers(), history(), drawSelection(), indentOnInput(), bracketMatching(), closeBrackets(),
        highlightActiveLine(), EditorView.lineWrapping,
        cmPlaceholder(props.placeholder),
        syntaxHighlighting(hl),
        langC.of(langExt(props.lang, effectiveSchema())),
        complC.of(complExt(props.lang, effectiveSchema())),
        keymap.of([
          { key: 'Mod-Enter', run: () => { emit('run'); return true }, preventDefault: true },
          ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab,
        ]),
        theme,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) emit('update:modelValue', u.state.doc.toString())
        }),
      ],
    }),
  })
  if (!props.schema) qs.loadSchema(props.lang).then(reconfigure)
  else reconfigure()
})

onBeforeUnmount(() => { view.value?.destroy(); view.value = null })

// External model changes (e.g. loading a saved query) → sync into the doc.
watch(() => props.modelValue, (val) => {
  const v = view.value
  if (v && val !== v.state.doc.toString()) {
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: val || '' } })
  }
})

// Explicit schema changes (e.g. the plot transform gains a source) → reconfigure.
watch(() => props.schema, reconfigure, { deep: true })

// Language switch → reconfigure highlighting + completion, load its schema.
watch(() => props.lang, async (lang) => {
  reconfigure()
  await qs.loadSchema(lang)
  reconfigure()
})
</script>

<template>
  <div ref="el" class="qeditor" data-testid="query-editor" />
</template>

<style scoped>
.qeditor {
  --cm-kw: #7c3aed; --cm-entity: #0369a1; --cm-prop: #0e7490; --cm-str: #15803d;
  --cm-num: #b45309; --cm-cmt: #6b7280; --cm-var: var(--text); --cm-fn: #9333ea; --cm-punct: var(--muted);
  border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
  background: var(--bg);
}
.qeditor :deep(.cm-editor) { max-height: 22rem; }
.qeditor :deep(.cm-scroller) { overflow: auto; }
</style>
<style>
/* Dark-theme syntax palette (the app toggles a `dark` class on the root). */
.dark .qeditor {
  --cm-kw: #c4b5fd; --cm-entity: #7dd3fc; --cm-prop: #67e8f9; --cm-str: #86efac;
  --cm-num: #fdba74; --cm-cmt: #9ca3af; --cm-fn: #d8b4fe;
}
</style>
