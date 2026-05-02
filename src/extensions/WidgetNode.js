/**
 * TipTap node extension for inline widget embeds.
 *
 * Replaces the fragile ```widget code fence approach with a first-class
 * atom node that renders Vue components via NodeView.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import WidgetNodeView from './WidgetNodeView.vue'

export const WidgetNode = Node.create({
  name: 'widget',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      widget_type: { default: null },
      entityId: { default: null },
      schema_version: { default: 1 },
      depth: { default: undefined },
      // Atlas widget attrs — chosen as flat fields rather than a nested
      // `config` so the existing TipTap JSON serialisation round-trips
      // them without changes elsewhere in the editor pipeline.
      dataset: { default: undefined },
      nuts_level: { default: undefined },
      year: { default: undefined },
      dimensions: { default: undefined },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-widget-type]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-widget-type': HTMLAttributes.widget_type,
      'data-entity-id': HTMLAttributes.entityId,
    })]
  },

  addNodeView() {
    return VueNodeViewRenderer(WidgetNodeView)
  },
})
