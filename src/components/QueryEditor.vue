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
import { unifiedMergeView } from '@codemirror/merge'
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
  // A complete replacement text the assistant has proposed. While set the
  // editor shows it as a unified diff against what the user had and takes
  // no input; the parent decides, whole, and the prop goes back to null.
  proposal: { type: String, default: null },
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
// Diff mode. Empty until a proposal arrives; holds the merge view + the
// read-only facets while one is being reviewed.
const mergeC = new Compartment()
// True while the editor swaps its document for a proposal (and back). The
// update listener must not report those swaps as edits: the parent's draft
// autosaves, so a proposal that reached `modelValue` would be persisted
// before anyone accepted it.
let swapping = false

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
        mergeC.of([]),
        keymap.of([
          { key: 'Mod-Enter', run: () => { emit('run'); return true }, preventDefault: true },
          ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab,
        ]),
        theme,
        EditorView.updateListener.of((u) => {
          if (u.docChanged && !swapping) emit('update:modelValue', u.state.doc.toString())
        }),
      ],
    }),
  })
  if (!props.schema) qs.loadSchema(props.lang).then(reconfigure)
  else reconfigure()
  // A proposal can already be pending when the editor is created: the
  // user left the query with a diff up and came back (the view rebuilds
  // the editor on every query switch). The watcher below only sees
  // changes, so the diff is drawn here too — otherwise the bar above
  // would say "review" over an editor that shows no diff and takes input.
  if (props.proposal != null) showProposal(props.proposal)
})

onBeforeUnmount(() => { view.value?.destroy(); view.value = null })

// External model changes (e.g. loading a saved query) → sync into the doc.
// Not while a proposal is on screen: the doc is the proposal then, and the
// model catches up the moment the proposal clears (see below).
watch(() => props.modelValue, (val) => {
  const v = view.value
  if (v && props.proposal == null && val !== v.state.doc.toString()) {
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: val || '' } })
  }
})

// Replace the whole document without telling the parent about it.
function swapDoc(v, text, effects) {
  swapping = true
  try {
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text || '' }, effects })
  } finally {
    swapping = false
  }
}

// Show a proposal as a diff over the user's text, read-only. The "user's
// text" is the model, not the document: while a diff is up the document
// IS the previous proposal, and a model that speaks again must be diffed
// against what the user wrote, not against what it said last time. No
// per-hunk accept/reject controls: the owner's rule is all or nothing,
// and the buttons that decide live next to the editor, not inside it.
function showProposal(text) {
  const v = view.value
  if (!v) return
  swapDoc(v, text, mergeC.reconfigure([
    unifiedMergeView({
      original: props.modelValue || '', mergeControls: false, highlightChanges: true, gutter: true,
    }),
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
  ]))
}

// Proposal in → the diff. Proposal out → the model again (after an accept
// the parent has already set the model to the proposed text, so nothing
// visibly moves).
watch(() => props.proposal, (text) => {
  const v = view.value
  if (!v) return
  if (text != null) showProposal(text)
  else swapDoc(v, props.modelValue, mergeC.reconfigure([]))
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
  <div ref="el" class="qeditor" :class="{ 'qeditor--proposal': proposal != null }" data-testid="query-editor" :data-proposal="proposal != null ? '1' : null" />
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
/* Diff mode: what the proposal adds (changed lines) and what it drops
   (deleted chunks), in the app's palette rather than the merge view's. */
.qeditor--proposal { border-color: var(--accent); }
.qeditor :deep(.cm-changedLine) { background: color-mix(in srgb, #16a34a 14%, transparent); }
.qeditor :deep(.cm-changedText) { background: color-mix(in srgb, #16a34a 30%, transparent); }
.qeditor :deep(.cm-deletedChunk) { background: color-mix(in srgb, #dc2626 10%, transparent); }
.qeditor :deep(.cm-deletedChunk .cm-deletedText) { background: color-mix(in srgb, #dc2626 28%, transparent); }
.qeditor :deep(.cm-changedLineGutter) { background: #16a34a; }
.qeditor :deep(.cm-deletedLineGutter) { background: #dc2626; }
</style>
<style>
/* Dark-theme syntax palette (the app toggles a `dark` class on the root). */
.dark .qeditor {
  --cm-kw: #c4b5fd; --cm-entity: #7dd3fc; --cm-prop: #67e8f9; --cm-str: #86efac;
  --cm-num: #fdba74; --cm-cmt: #9ca3af; --cm-fn: #d8b4fe;
}
.dark .qeditor .cm-changedLine { background: color-mix(in srgb, #4ade80 16%, transparent); }
.dark .qeditor .cm-changedText { background: color-mix(in srgb, #4ade80 32%, transparent); }
.dark .qeditor .cm-deletedChunk { background: color-mix(in srgb, #f87171 14%, transparent); }
.dark .qeditor .cm-deletedChunk .cm-deletedText { background: color-mix(in srgb, #f87171 32%, transparent); }
.dark .qeditor .cm-changedLineGutter { background: #4ade80; }
.dark .qeditor .cm-deletedLineGutter { background: #f87171; }
</style>
