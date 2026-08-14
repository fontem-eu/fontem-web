<script setup>
/**
 * Icons for the activity feed: one for what was touched, one for what
 * happened to it.
 *
 * Same shape as RailIcon and for the same reason — intrinsic width/height
 * travel with the component, so an icon rendered from a second place does
 * not fall back to the default replaced-element size.
 *
 * Why icons at all: an entry used to be three words of prose in a row
 * ("data_project query_added Top suppliers"), which reads as a sentence
 * fragment and scans as noise. A glyph for the kind and a glyph for the
 * verb turn the list into something you can skim down, and it frees the
 * horizontal space that the title actually needs on a phone.
 *
 * Anything unrecognised falls through to a neutral dot rather than
 * disappearing: an entry with no icon is still an entry, and silently
 * dropping one would hide exactly the new kind of activity nobody has
 * styled yet.
 */
defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 16 },
})
</script>

<template>
  <svg
    class="activity-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- what it is -->
    <template v-if="name === 'story'"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></template>
    <template v-else-if="name === 'data_project'"><path d="M9 3h6M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-3L14 9V3" /></template>
    <template v-else-if="name === 'investigation'"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></template>
    <template v-else-if="name === 'dossier'"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></template>
    <template v-else-if="name === 'issue'"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></template>
    <template v-else-if="name === 'request'"><path d="M4 12h16" /><path d="M14 6l6 6-6 6" /></template>

    <!-- what happened -->
    <template v-else-if="name === 'created'"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></template>
    <template v-else-if="name === 'updated'"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></template>
    <template v-else-if="name === 'deleted'"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></template>
    <template v-else-if="name === 'translated'"><path d="M5 8h9M9 4v4M4 20l5-12 5 12M6.5 16h5" /><path d="M15 20l4-8 4 8M16.5 17h5" /></template>
    <template v-else-if="name === 'added'"><path d="M12 5v14M5 12h14" /></template>

    <!-- who -->
    <template v-else-if="name === 'agent'"><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M12 8V4M9 2h6" /><circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" /></template>

    <template v-else><circle cx="12" cy="12" r="3" /></template>
  </svg>
</template>

<style scoped>
.activity-icon {
  flex: none;
  vertical-align: -0.15em;
}
</style>
