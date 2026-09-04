<script setup>
import { onMounted } from 'vue'

onMounted(() => { document.title = 'Privacy Policy — Dargle' })
</script>

<template>
  <div class="privacy">
    <h1>{{ $t('privacy.privacy_policy') }}</h1>
    <p class="privacy-updated">{{ $t('privacy.last_updated_april_2026') }}</p>

    <h2>{{ $t('privacy.what_dargle_is') }}</h2>
    <p>{{ $t('privacy.dargle_is_a_civic_transparency_platform') }}</p>

    <h2>{{ $t('privacy.data_in_the_knowledge_graph') }}</h2>
    <p>{{ $t('privacy.all_data_in_the_dargle_knowledge_graph_r') }}<strong>{{ $t('privacy.legal_entities') }}</strong> {{ $t('privacy.companies_public_authorities_and_organis') }}</p>
    <ul>
      <li><strong>{{ $t('app.gleif') }}</strong> {{ $t('privacy.global_lei_foundation_company_registry') }}</li>
      <li><strong>{{ $t('app.ted') }}</strong> {{ $t('privacy.eu_public_procurement_notices') }}</li>
      <li><strong>{{ $t('privacy.kohesio') }}</strong> {{ $t('privacy.eu_cohesion_policy_project_funding') }}</li>
      <li><strong>{{ $t('privacy.eu_transparency_register') }}</strong> {{ $t('privacy.lobbying_organisations_registered_with_eu') }}</li>
      <li><strong>{{ $t('privacy.eu_consolidated_sanctions_list') }}</strong> {{ $t('privacy.sanctioned_entities_only') }}</li>
    </ul>
    <p>{{ $t('privacy.no_personal_data_of_individuals_is_store') }}</p>

    <h2>{{ $t('privacy.your_account_data') }}</h2>
    <p>{{ $t('privacy.when_you_sign_in_we_collect_and_store') }}</p>
    <ul>
      <li>{{ $t('privacy.your') }}<strong>{{ $t('privacy.email_address') }}</strong>, <strong>{{ $t('privacy.name') }}</strong>{{ $t('privacy.and') }} <strong>{{ $t('privacy.profile_picture') }}</strong> {{ $t('privacy.provided_by_google_oauth') }}</li>
    </ul>
    <p>{{ $t('privacy.this_data_is_used_solely_for_authenticat') }}</p>
    <p>
      <strong>{{ $t('privacy.legal_basis') }}</strong> {{ $t('privacy.performance_of_a_contract') }}</p>
    <p>{{ $t('privacy.you_can_delete_your_account') }}</p>

    <h2>{{ $t('privacy.ai_assistant') }}</h2>
    <p>{{ $t('privacy.when_you_use_the_ai_assistant') }}</p>
    <ul>
      <li>{{ $t('privacy.conversation_processing_is_performed_by_') }}</li>
      <li>{{ $t('privacy.you_can_delete_your_entire_conversation') }}</li>
      <li>{{ $t('privacy.conversations_are_automatically_deleted_') }}</li>
    </ul>

    <h2>{{ $t('privacy.your_rights') }}</h2>
    <p>{{ $t('privacy.under_the_gdpr_you_have_the_right_to') }}</p>
    <ul>
      <li><strong>{{ $t('privacy.access') }}</strong> {{ $t('privacy.the_personal_data_we_hold_about_you') }}</li>
      <li><strong>{{ $t('privacy.rectify') }}</strong> {{ $t('privacy.inaccurate_data') }}</li>
      <li><strong>{{ $t('privacy.erase') }}</strong> {{ $t('privacy.your_data_right_to_be_forgotten') }}</li>
      <li><strong>{{ $t('privacy.port') }}</strong> {{ $t('privacy.your_data_to_another_service') }}</li>
    </ul>
    <p>{{ $t('privacy.to_exercise_any_of_these_rights_contact_') }}<a href="mailto:privacy@fontem.eu">privacy@fontem.eu</a>.
    </p>
    <p>{{ $t('privacy.you_also_have_the_right_to_lodge') }}</p>

    <h2>{{ $t('privacy.cookies') }}</h2>
    <p>{{ $t('privacy.we_only_use_strictly_necessary_cookies') }}</p>

    <h2>{{ $t('privacy.changes_to_this_policy') }}</h2>
    <p>{{ $t('privacy.we_may_update_this_policy') }}</p>
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
