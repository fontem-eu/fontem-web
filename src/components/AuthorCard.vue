<script setup>
/**
 * Author card shown at the foot of an article: the author's avatar (photo or
 * initials via UserAvatar), name (linking to their profile), short summary,
 * and their profile links. Purely presentational — the parent fetches the
 * author's public profile and passes it in.
 */
import UserAvatar from './UserAvatar.vue'

const props = defineProps({
  // The author's public profile — fields used: name, avatar_url, summary,
  // links, avatar_x, avatar_y.
  author: { type: Object, required: true },
  userId: { type: String, required: true },
})

const avatarPosition = `${props.author.avatar_x ?? 50}% ${props.author.avatar_y ?? 50}%`
</script>

<template>
  <aside class="author-card" data-testid="author-card">
    <RouterLink :to="`/users/${userId}`" class="author-card-avatar" :aria-label="author.name">
      <UserAvatar :user="author" :size="64" :position="avatarPosition" />
    </RouterLink>
    <div class="author-card-body">
      <RouterLink :to="`/users/${userId}`" class="author-card-name" data-testid="author-card-name">
        {{ author.name }}
      </RouterLink>
      <p v-if="author.summary" class="author-card-summary" data-testid="author-card-summary">
        {{ author.summary }}
      </p>
      <ul v-if="author.links && author.links.length" class="author-card-links" data-testid="author-card-links">
        <li v-for="(l, i) in author.links" :key="i">
          <a :href="l.url" target="_blank" rel="noopener noreferrer nofollow">{{ l.name }}</a>
        </li>
      </ul>
    </div>
  </aside>
</template>

<style scoped>
.author-card {
  display: flex; gap: 1rem; align-items: flex-start;
  margin: 2.5rem 0 1rem; padding: 1.25rem;
  border: 1px solid var(--border); border-radius: 12px;
  background: var(--surface, transparent);
}
.author-card-avatar { flex: 0 0 auto; display: inline-flex; }
.author-card-body { min-width: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.author-card-name { font-weight: 700; font-size: 1.05rem; color: var(--text); text-decoration: none; }
.author-card-name:hover { color: var(--accent); }
.author-card-summary { font-size: 0.9rem; line-height: 1.5; color: var(--text); margin: 0; }
.author-card-links { list-style: none; padding: 0; margin: 0.15rem 0 0; display: flex; flex-wrap: wrap; gap: 0.75rem; }
.author-card-links a { color: var(--accent); text-decoration: none; font-size: 0.85rem; }
.author-card-links a:hover { text-decoration: underline; }
</style>
