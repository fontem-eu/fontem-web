/**
 * TipTap node extension for inline entity mentions.
 *
 * A mention is an atomic inline node carrying a Dargle IRI:
 *
 *   { type: 'entityMention',
 *     attrs: { iri, label, class } }
 *
 * Rendered as a coloured chip via {@link EntityMentionView}. Clicks
 * surface a CustomEvent('entity-mention-click', { iri, label, class })
 * on the editor root so the parent view can open the side panel
 * without the chip needing direct router/store access — the same
 * decoupling pattern used by WidgetNode.
 *
 * The IRI is constructed once at insert time
 * (`http://data.fontem.eu/id/<Class>/<gmr_id>`) and stored verbatim;
 * the resolver endpoint owns reading it back. This keeps the editor
 * data layer agnostic of where entity facts live (Neo4j today,
 * Virtuoso post-migration).
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import EntityMentionView from './EntityMentionView.vue'

export const EntityMention = Node.create({
  name: 'entityMention',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      iri: { default: null },
      label: { default: '' },
      class: { default: 'Company' },
    }
  },

  parseHTML() {
    // Match chips emitted by renderHTML below, plus a defensive form
    // for old documents (none in the wild yet — first release).
    return [
      { tag: 'span[data-entity-iri]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-entity-iri': HTMLAttributes.iri,
      'data-entity-class': HTMLAttributes.class,
      'data-entity-label': HTMLAttributes.label,
      class: 'entity-mention-chip',
    }), `@${HTMLAttributes.label || ''}`]
  },

  addNodeView() {
    return VueNodeViewRenderer(EntityMentionView)
  },

  addCommands() {
    return {
      insertEntityMention: (attrs) => ({ chain }) =>
        chain()
          .focus()
          .insertContent({ type: this.name, attrs })
          // Trailing space so the cursor lands cleanly after the chip.
          .insertContent(' ')
          .run(),
    }
  },
})
