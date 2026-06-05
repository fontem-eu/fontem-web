<!--
  Hidden plural-form probe.

  vue-i18n@9 in Composition mode (legacy: false) exposes ``$t`` only;
  the legacy ``$tc`` is gone. Plural signature: ``$t(key, count, named)``
  where ``count`` picks the form and ``named`` provides interpolation.
  This component renders all three forms at fixed counts so e2e tests
  can read them without depending on real data flow. Visually hidden
  via .sr-only -- Playwright's ``toContainText`` reads textContent
  regardless of CSS visibility.
-->
<template>
  <div class="sr-only" aria-hidden="true">
    <span data-testid="i18n-plural-zero">{{ $t('app.contracts_count', 0, { count: 0 }) }}</span>
    <span data-testid="i18n-plural-one">{{ $t('app.contracts_count', 1, { count: 1 }) }}</span>
    <span data-testid="i18n-plural-many">{{ $t('app.contracts_count', 5, { count: 5 }) }}</span>
  </div>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
