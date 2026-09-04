<script setup>
/**
 * Help / FAQ.
 *
 * The centrepiece is the "connect your own AI" guide, because that
 * arrangement needs explaining: people expect a chatbot the site pays
 * for, and instead they are asked to bring a client. The honest reason —
 * no provider sells subscription access to third parties — is more
 * persuasive than hiding it, and it explains why the alternative is
 * better rather than merely cheaper for us.
 */
import { computed } from 'vue'

const mcpUrl = computed(() => {
  const host = typeof window !== 'undefined' ? window.location.host : 'dargle.eu'
  return `https://${host}/mcp`
})
</script>

<template>
  <div class="help-view" data-testid="help-view">
    <h1>{{ $t('help.title') }}</h1>

    <nav class="help-toc" :aria-label="$t('help.toc')">
      <a href="#connect-ai">{{ $t('help.connect_title') }}</a>
      <a href="#why-own-key">{{ $t('help.why_key_short') }}</a>
      <a href="#assistant-in-app">{{ $t('help.in_app_title') }}</a>
      <a href="#privacy">{{ $t('help.privacy_short') }}</a>
    </nav>

    <section id="connect-ai" data-testid="help-connect-ai">
      <h2>{{ $t('help.connect_title') }}</h2>
      <p>{{ $t('help.connect_intro') }}</p>

      <h3>{{ $t('help.step_token') }}</h3>
      <p>
        {{ $t('help.step_token_body_pre') }}
        <router-link to="/account">{{ $t('help.step_token_account') }}</router-link>
        {{ $t('help.step_token_body_post', {
          section: $t('mcp_tokens.title'), action: $t('mcp_tokens.create') }) }}
      </p>

      <h3>{{ $t('help.step_endpoint') }}</h3>
      <p>{{ $t('help.step_endpoint_body') }}</p>
      <pre class="help-pre" data-testid="help-mcp-url"><code>{{ mcpUrl }}</code></pre>

      <h4>{{ $t('help.claude_desktop') }}</h4>
      <p>{{ $t('help.claude_desktop_body') }}</p>

      <h4>{{ $t('help.claude_code') }}</h4>
      <pre class="help-pre"><code>claude mcp add --transport http dargle {{ mcpUrl }} \
  --header "Authorization: Bearer YOUR_TOKEN"</code></pre>

      <h4>{{ $t('help.chatgpt') }}</h4>
      <p>{{ $t('help.chatgpt_body') }}</p>

      <h4>{{ $t('help.anything_else') }}</h4>
      <p>{{ $t('help.anything_else_body', { header: 'Authorization: Bearer …' }) }}</p>

      <h3>{{ $t('help.step_ask') }}</h3>
      <p>{{ $t('help.step_ask_body', { example: $t('help.step_ask_example') }) }}</p>

      <h3>{{ $t('help.revoking') }}</h3>
      <p>{{ $t('help.revoking_body') }}</p>
    </section>

    <section id="why-own-key" data-testid="help-why-own-key">
      <h2>{{ $t('help.why_key_title') }}</h2>
      <p>{{ $t('help.why_key_body_1') }}</p>
      <p>{{ $t('help.why_key_body_2') }}</p>
    </section>

    <section id="assistant-in-app" data-testid="help-assistant-in-app">
      <h2>{{ $t('help.in_app_title') }}</h2>
      <p>{{ $t('help.in_app_body_1') }}</p>
      <p>
        {{ $t('help.in_app_body_2_pre') }}
        <router-link to="/account">{{ $t('help.step_token_account') }}</router-link
        >{{ $t('help.in_app_body_2_post') }}
      </p>
    </section>

    <section id="privacy" data-testid="help-privacy">
      <h2>{{ $t('help.privacy_title') }}</h2>
      <ul>
        <li>{{ $t('help.privacy_item_page') }}</li>
        <li>{{ $t('help.privacy_item_data') }}</li>
        <li>{{ $t('help.privacy_item_article') }}</li>
      </ul>
      <p>{{ $t('help.privacy_body_1') }}</p>
      <p>{{ $t('help.privacy_body_2') }}</p>
    </section>
  </div>
</template>

<style scoped>
.help-view { max-width: 46rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
.help-view h1 { font-size: 1.6rem; margin-bottom: 1rem; }
.help-view h2 { font-size: 1.15rem; margin: 2rem 0 0.6rem; }
.help-view h3 { font-size: 1rem; margin: 1.2rem 0 0.4rem; }
.help-view h4 { font-size: 0.9rem; margin: 0.9rem 0 0.3rem; color: var(--muted); }
.help-view p, .help-view li { line-height: 1.6; margin-bottom: 0.6rem; }
.help-view ul { padding-left: 1.2rem; }
.help-toc { display: flex; flex-wrap: wrap; gap: 0.8rem; padding: 0.7rem;
            border: 1px solid var(--bezel-border); border-radius: 8px; margin-bottom: 1rem; }
.help-pre { background: var(--bezel); border: 1px solid var(--bezel-border); border-radius: 8px;
            padding: 0.7rem; overflow-x: auto; font-size: 0.82rem; }
</style>
