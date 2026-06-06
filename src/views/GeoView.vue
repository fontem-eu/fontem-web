<script setup>
import GeoChoropleth from '../components/GeoChoropleth.vue'
</script>

<template>
  <div class="geo-view">
    <header class="geo-view__header">
      <h1>{{ $t('geo.geo_explorer') }}</h1>
      <p class="geo-view__hint">{{ $t('geo.intro') }}</p>
    </header>
    <GeoChoropleth />
  </div>
</template>

<style scoped>
.geo-view {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: calc(100vh - 56px);
}

.geo-view__header h1 {
  font-size: 20px;
  margin: 0 0 4px;
}

.geo-view__hint {
  font-size: 12px;
  color: var(--muted);
  margin: 0;
  max-width: 720px;
}
</style>
