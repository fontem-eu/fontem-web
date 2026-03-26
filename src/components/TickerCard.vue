<script setup>
import { computed } from 'vue'

const props = defineProps({
  ticker: { type: Object, required: true },
  selected: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

// EU tickers have a full ticker like "ASML.AS"; NA tickers just have a symbol.
const selectValue = computed(() => props.ticker.ticker ?? props.ticker.symbol)

const isEsef = computed(() => props.ticker.data_source === 'esef')

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
  <div
    class="gmr-card"
    :class="{ 'gmr-card--active': selected }"
    role="listitem"
    tabindex="0"
    style="cursor: pointer"
    @click="emit('select', selectValue)"
    @keydown.enter="emit('select', selectValue)"
    @keydown.space.prevent="emit('select', selectValue)"
  >
    <!-- Symbol — show full ticker (GALP.LS) for EU entries to disambiguate -->
    <span
      class="ticker-symbol w-16 shrink-0 font-mono text-sm font-bold"
      style="color: var(--accent)"
    >
      {{ ticker.ticker ?? ticker.symbol }}
    </span>

    <!-- Name + meta -->
    <div class="min-w-0 flex-1">
      <div class="ticker-name truncate text-sm font-medium" style="color: var(--text)">
        {{ ticker.name }}
      </div>
      <div v-if="meta" class="ticker-meta mt-0.5 text-xs" style="color: var(--muted)">
        {{ meta }}
      </div>
    </div>

    <!-- Exchange badge -->
    <span v-if="ticker.exchange" class="badge badge-tag">
      {{ ticker.exchange }}
    </span>

    <!-- Data source badge -->
    <span v-if="isEsef" class="badge badge-esef" data-testid="badge-esef">
      ESEF
    </span>
    <span v-else class="badge" :class="ticker.is_active ? 'badge-ok' : 'badge-ko'">
      {{ ticker.is_active ? 'Active' : 'Inactive' }}
    </span>
  </div>
</template>
