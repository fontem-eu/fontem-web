/**
 * `@`-trigger plugin for entity mentions.
 *
 * Listens for `@<chars>` typed at the cursor, exposes the current
 * trigger state via the `onState` callback so a Vue popover can
 * render an autocomplete list. When the user picks a suggestion,
 * call `editor.commands.acceptMention({ iri, label, class, range })`
 * to replace the `@<chars>` range with an EntityMention node.
 *
 * Keep this minimal — we don't need every feature of Tiptap's full
 * Suggestion utility (no upstream dependency on @tiptap/suggestion).
 * The popover lives in MentionAutocomplete.vue and owns the network
 * + keyboard concerns; this extension just owns DOM-position +
 * what-text-matched.
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

// Allow letters, digits, accented chars, hyphens, dots, spaces in queries
// up to 60 chars — long enough for full company names ("Siemens Healthcare
// Sp. z o.o.") but short enough that runaway matches stop quickly.
const QUERY_RE = /@([\p{L}\p{N}.\-_ ]{0,60})$/u

const pluginKey = new PluginKey('mentionTrigger')

export const MentionTrigger = Extension.create({
  name: 'mentionTrigger',

  addOptions() {
    return {
      // Called whenever the trigger state changes.
      // active=false → user cancelled / moved away.
      // active=true  → query is the current text after `@`,
      //                range = [from, to] of the `@<chars>` span,
      //                pos  = ProseMirror DOM coords for the popover.
      onState: () => {},
    }
  },

  addCommands() {
    return {
      // Replace the `@query` range with an EntityMention node.
      acceptMention: ({ iri, label, cls, range }) => ({ chain }) => {
        return chain()
          .focus()
          .deleteRange(range)
          .insertEntityMention({ iri, label, class: cls })
          .run()
      },
    }
  },

  addProseMirrorPlugins() {
    const onState = this.options.onState
    return [
      new Plugin({
        key: pluginKey,
        view() {
          // Notify on every selection change so the popover can
          // close cleanly when the user clicks away.
          return {
            update(view) {
              const sel = view.state.selection
              if (!sel.empty) {
                onState({ active: false })
                return
              }
              const $from = sel.$from
              const textBefore = $from.parent.textBetween(
                Math.max(0, $from.parentOffset - 60),
                $from.parentOffset,
                undefined,
                '￼',
              )
              const m = QUERY_RE.exec(textBefore)
              if (!m) {
                onState({ active: false })
                return
              }
              const query = m[1]
              // Caret pos minus the matched length = start of `@`.
              const triggerLen = m[0].length
              const from = sel.from - triggerLen
              const to = sel.from
              const coords = view.coordsAtPos(to)
              onState({
                active: true,
                query,
                range: { from, to },
                rect: coords,
              })
            },
          }
        },
      }),
    ]
  },
})
