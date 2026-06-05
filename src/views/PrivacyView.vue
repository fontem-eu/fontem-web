<script setup>
import { onMounted } from 'vue'

onMounted(() => { document.title = 'Privacy Policy — Fontem' })
</script>

<template>
  <div class="privacy">
    <h1>{{ $t('privacy.privacy_policy') }}</h1>
    <p class="privacy-updated">{{ $t('privacy.last_updated_april_2026') }}</p>

    <h2>1. What Fontem is</h2>
    <p>
      Fontem is a civic transparency platform that connects EU public procurement data,
      corporate ownership registries, and cohesion policy funding into a single
      knowledge graph. Its goal is to make public spending and corporate structures
      easier to explore and understand.
    </p>

    <h2>2. Data in the knowledge graph</h2>
    <p>{{ $t('privacy.all_data_in_the_fontem_knowledge_graph_r') }}<strong>legal entities</strong>
      (companies, public authorities, and organisations) — not natural persons.
      We aggregate publicly available data from the following sources:
    </p>
    <ul>
      <li><strong>{{ $t('app.gleif') }}</strong> — Global LEI Foundation company registry data</li>
      <li><strong>{{ $t('app.ted') }}</strong> — EU public procurement notices and contract awards</li>
      <li><strong>{{ $t('privacy.kohesio') }}</strong> — EU cohesion policy project funding</li>
      <li><strong>{{ $t('privacy.eu_transparency_register') }}</strong> — lobbying organisations registered with the EU</li>
      <li><strong>{{ $t('privacy.eu_consolidated_sanctions_list') }}</strong> — sanctioned entities only</li>
    </ul>
    <p>{{ $t('privacy.no_personal_data_of_individuals_is_store') }}</p>

    <h2>3. Your account data</h2>
    <p>{{ $t('privacy.when_you_sign_in_we_collect_and_store') }}</p>
    <ul>
      <li>{{ $t('privacy.your') }}<strong>email address</strong>, <strong>name</strong>, and <strong>profile picture</strong> (provided by Google OAuth)</li>
    </ul>
    <p>
      This data is used solely for authentication and personalisation of your
      experience (e.g. displaying your name in the interface).
    </p>
    <p>
      <strong>{{ $t('privacy.legal_basis') }}</strong> performance of a contract (Art. 6(1)(b) GDPR) —
      we need this data to provide you with an account and the services you signed up for.
    </p>
    <p>
      You can delete your account and all associated data at any time by contacting us
      at the address below.
    </p>

    <h2>4. AI assistant</h2>
    <p>
      When you use the AI assistant, your conversations are stored to provide
      chat history and to compute usage metrics.
    </p>
    <ul>
      <li>{{ $t('privacy.conversation_processing_is_performed_by_') }}</li>
      <li>You can delete your entire conversation history from the profile menu at any time.</li>
      <li>{{ $t('privacy.conversations_are_automatically_deleted_') }}</li>
    </ul>

    <h2>5. Your rights</h2>
    <p>{{ $t('privacy.under_the_gdpr_you_have_the_right_to') }}</p>
    <ul>
      <li><strong>{{ $t('privacy.access') }}</strong> the personal data we hold about you</li>
      <li><strong>{{ $t('privacy.rectify') }}</strong> inaccurate data</li>
      <li><strong>{{ $t('privacy.erase') }}</strong> your data ("right to be forgotten")</li>
      <li><strong>{{ $t('privacy.port') }}</strong> your data to another service</li>
    </ul>
    <p>{{ $t('privacy.to_exercise_any_of_these_rights_contact_') }}<a href="mailto:privacy@fontem.eu">privacy@fontem.eu</a>.
    </p>
    <p>
      You also have the right to lodge a complaint with a supervisory authority
      in your country of residence.
    </p>

    <h2>6. Cookies</h2>
    <p>
      We only use strictly necessary session cookies for authentication. We do not
      use tracking cookies, advertising cookies, or third-party analytics cookies.
    </p>

    <h2>7. Changes to this policy</h2>
    <p>
      We may update this policy from time to time. When we do, we will revise the
      "last updated" date at the top of this page. Continued use of Fontem after changes
      constitutes acceptance of the updated policy.
    </p>
  </div>
</template>

<style scoped>
.privacy {
  max-width: 72rem;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
  color: var(--text);
}
.privacy h1 {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
}
.privacy-updated {
  font-size: 0.8rem;
  color: var(--muted);
  margin: 0 0 2rem;
}
.privacy h2 {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 1.75rem 0 0.5rem;
  color: var(--text);
}
.privacy p {
  font-size: 0.9rem;
  line-height: 1.65;
  color: var(--text);
  margin: 0 0 0.75rem;
}
.privacy ul {
  margin: 0 0 0.75rem;
  padding-left: 1.5rem;
}
.privacy li {
  font-size: 0.9rem;
  line-height: 1.65;
  color: var(--text);
  margin-bottom: 0.3rem;
}
.privacy a {
  color: var(--accent);
  text-decoration: none;
}
.privacy a:hover {
  text-decoration: underline;
}
.privacy strong {
  font-weight: 600;
}
</style>
