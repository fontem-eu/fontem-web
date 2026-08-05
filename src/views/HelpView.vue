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
  const host = typeof window !== 'undefined' ? window.location.host : 'fontem.eu'
  return `https://${host}/mcp`
})
</script>

<template>
  <div class="help-view" data-testid="help-view">
    <h1>Help</h1>

    <nav class="help-toc" aria-label="Contents">
      <a href="#connect-ai">Connect your AI assistant</a>
      <a href="#why-own-key">Why my own account?</a>
      <a href="#assistant-in-app">The assistant inside Fontem</a>
      <a href="#privacy">What the assistant can see</a>
    </nav>

    <section id="connect-ai" data-testid="help-connect-ai">
      <h2>Connect your AI assistant</h2>
      <p>
        Fontem exposes its data as tools your own AI client can call —
        company records, contracts, the entity graph, SPARQL. You use the
        assistant you already pay for, and Fontem never sees your
        provider account.
      </p>

      <h3>1. Create a token</h3>
      <p>
        Go to <router-link to="/account">Account settings</router-link> →
        <em>Connect your AI assistant</em> → <strong>Create token</strong>.
        Copy it immediately: it is shown once and cannot be retrieved
        afterwards. If you lose it, revoke it and make another.
      </p>

      <h3>2. Point your client at Fontem</h3>
      <p>The endpoint is:</p>
      <pre class="help-pre" data-testid="help-mcp-url"><code>{{ mcpUrl }}</code></pre>

      <h4>Claude Desktop</h4>
      <p>
        Settings → Connectors → Add custom connector. Paste the URL above,
        and your token as the bearer token.
      </p>

      <h4>Claude Code</h4>
      <pre class="help-pre"><code>claude mcp add --transport http fontem {{ mcpUrl }} \
  --header "Authorization: Bearer YOUR_TOKEN"</code></pre>

      <h4>ChatGPT</h4>
      <p>
        Settings → Connectors → Add. ChatGPT's connector support requires
        a paid plan; the URL and token are the same.
      </p>

      <h4>Anything else</h4>
      <p>
        Any client speaking MCP over Streamable HTTP works. Send the token
        as <code>Authorization: Bearer …</code>.
      </p>

      <h3>3. Ask it something</h3>
      <p>
        Try <em>“Use Fontem to find contracts awarded to companies linked
        to X”</em>. Your client decides when to call Fontem's tools.
      </p>

      <h3>Revoking</h3>
      <p>
        Account settings lists every connected client with when it was
        last used. Revoking takes effect on the next request. If you no
        longer recognise a client, revoke it.
      </p>
    </section>

    <section id="why-own-key" data-testid="help-why-own-key">
      <h2>Why do I need my own AI account?</h2>
      <p>
        Because no AI provider sells what would otherwise be the obvious
        arrangement. Anthropic prohibited using a Claude subscription
        inside third-party tools in February 2026 and blocked it that
        April; OpenAI's ChatGPT plans have never included API access; and
        Mistral bills Le Chat and its API separately. A site like Fontem
        genuinely cannot spend your subscription on your behalf.
      </p>
      <p>
        What it can do is hand your own assistant the data. That is better
        than the alternative, not merely cheaper for us: you keep your
        provider, your history and your privacy settings, you are not
        rationed by a budget we set, and nothing breaks here when a vendor
        changes its terms.
      </p>
    </section>

    <section id="assistant-in-app" data-testid="help-assistant-in-app">
      <h2>The assistant inside Fontem</h2>
      <p>
        There is also an assistant built into the site, on every page. It
        can search the data, explain what you are looking at, move you
        around the platform, and — while you are editing an article —
        propose changes to it.
      </p>
      <p>
        It needs an API key from Anthropic, Mistral or OpenAI, added in
        <router-link to="/account">Account settings</router-link>. That is
        pay-per-use and typically costs very little; a subscription is not
        required and would not work here anyway, for the reasons above.
      </p>
    </section>

    <section id="privacy" data-testid="help-privacy">
      <h2>What can the assistant see?</h2>
      <ul>
        <li>The page you are on, and the list of pages it can take you to.</li>
        <li>The public data it looks up on your behalf.</li>
        <li>The article you are editing, while you are editing it.</li>
      </ul>
      <p>
        It cannot see other people's private drafts, and it is offered
        only the tools that make sense where you are — it cannot propose
        edits when no article is open.
      </p>
      <p>
        Your provider key is stored encrypted and is never shown again
        after you save it. Tokens for external clients are stored only as
        a hash, so they cannot be recovered from our database — which is
        why a new one is shown exactly once.
      </p>
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
