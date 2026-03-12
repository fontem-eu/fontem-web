<script setup>
import { computed } from 'vue'

const props = defineProps({
  ticker: { type: Object, required: true },
})

const meta = computed(() =>
  [
    props.ticker.exchange,
    props.ticker.country,
    props.ticker.sector !== 'Unknown' ? props.ticker.sector : null,
  ]
    .filter(Boolean)
    .join(' · ')
)
</script>

<template>
  <div class="ticker-card" role="listitem">
    <span class="ticker-symbol">{{ ticker.symbol }}</span>
    <div class="ticker-info">
      <div class="ticker-name">{{ ticker.name }}</div>
      <div v-if="meta" class="ticker-meta">{{ meta }}</div>
    </div>
    <span v-if="ticker.exchange" class="badge badge-exchange">{{ ticker.exchange }}</span>
    <span class="badge" :class="ticker.is_active ? 'badge-active' : 'badge-inactive'">
      {{ ticker.is_active ? 'Active' : 'Inactive' }}
    </span>
  </div>
</template>
