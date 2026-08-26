<script setup>
/**
 * Development — the open-source shop window.
 *
 * Reachable from the footer, not the top nav. Two things: a pointer to the
 * GitHub org, and the walkthrough video of how Fontem is built. The video
 * is served same-origin at /media/… — nginx proxies that path to the env's
 * MinIO bucket (public-read "media/" prefix), so the 24 MB asset stays out
 * of the repo and image while remaining CSP-compliant. It preloads nothing
 * until the visitor presses play.
 */
import { onMounted } from 'vue'

// Bound (not static) on purpose: a literal `src`/`poster` attribute is
// rewritten by @vitejs/plugin-vue's transformAssetUrls into a build-time
// `import`, which fails to resolve because these files live in MinIO, not
// the repo (breaking `npm run build`/prerender and the tests). Binding them
// keeps them as plain runtime URLs the browser fetches via the nginx
// /media/ proxy.
const videoUrl = '/media/fontem-devenv.mp4'
const posterUrl = '/media/fontem-devenv-poster.jpg'

onMounted(() => { document.title = 'Development — Fontem' })
</script>

<template>
  <div class="dev" data-testid="development-view">
    <header class="dev-hdr">
      <h1>{{ $t('development.title') }}</h1>
      <p class="dev-sub">{{ $t('development.subtitle') }}</p>
    </header>

    <section class="dev-section">
      <h2>{{ $t('development.open_source') }}</h2>
      <p>{{ $t('development.open_source_desc') }}</p>
      <a
        class="dev-gh"
        href="https://github.com/fontem-eu"
        target="_blank"
        rel="noopener noreferrer"
        data-testid="development-github"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .5C5.7.5.5 5.7.5 12a11.5 11.5 0 0 0 7.9 10.9c.6.1.8-.2.8-.5v-1.7c-3.2.7-3.9-1.6-3.9-1.6-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7 0-.7 0-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.3 11.3 0 0 1 6 0C17 4.4 18 4.7 18 4.7c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5A11.5 11.5 0 0 0 23.5 12C23.5 5.7 18.3.5 12 .5z"/>
        </svg>
        <span>github.com/fontem-eu</span>
        <svg class="dev-ext" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </a>
    </section>

    <section class="dev-section">
      <h2>{{ $t('development.how_we_build') }}</h2>
      <p>{{ $t('development.video_desc') }}</p>
      <video
        class="dev-video"
        controls
        preload="none"
        playsinline
        :poster="posterUrl"
        data-testid="development-video"
      >
        <source :src="videoUrl" type="video/mp4" >
      </video>
    </section>
  </div>
</template>

<style scoped>
.dev { max-width: 52rem; margin: 0 auto; padding: 0 1rem 4rem; }
.dev-hdr { padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.75rem; }
.dev-hdr h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
.dev-sub { font-size: 0.9rem; color: var(--muted); margin: 0.35rem 0 0; text-wrap: balance; }
.dev-section { margin-bottom: 2.25rem; }
.dev-section h2 { font-size: 1.05rem; font-weight: 700; margin: 0 0 0.4rem; }
.dev-section p { font-size: 0.9rem; color: var(--muted); margin: 0 0 0.9rem; line-height: 1.5; }
.dev-gh {
  display: inline-flex; align-items: center; gap: 0.55rem;
  padding: 0.6rem 0.95rem; border: 1px solid var(--border); border-radius: 10px;
  color: var(--text); text-decoration: none; font-weight: 600; font-size: 0.9rem;
  background: var(--surface); transition: border-color 0.15s, background 0.15s;
}
.dev-gh:hover { border-color: var(--accent); }
.dev-ext { color: var(--muted); }
.dev-video {
  width: 100%; max-width: 100%; border-radius: 10px; display: block;
  border: 1px solid var(--border); background: #000; aspect-ratio: 16 / 9;
}
</style>
