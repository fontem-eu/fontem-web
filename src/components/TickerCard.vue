<script setup>
import { computed } from 'vue'

const props = defineProps({
  ticker: { type: Object, required: true },
  selected: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

const isAuthority = computed(() => props.ticker._type === 'authority')
const isPerson = computed(() => props.ticker._type === 'person')

// Navigate by ticker if listed, otherwise by gmr_id
const selectValue = computed(() => props.ticker._navKey ?? props.ticker.ticker ?? props.ticker.symbol)

const isEsef = computed(() => props.ticker.data_source === 'esef')

// A real ticker is a short alphanumeric string, not a UUID
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i
const realTicker = computed(() => {
  const t = props.ticker.ticker || props.ticker.symbol || null
  if (!t || UUID_RE.test(t)) return null
  return t
})

const displaySymbol = computed(() => {
  if (isAuthority.value || isPerson.value) return null
  return realTicker.value
})

const meta = computed(() =>
  [
    props.ticker.exchange && props.ticker.exchange !== 'US' ? props.ticker.exchange : null,
    props.ticker.country,
    props.ticker.sector === 'Unknown' ? null : props.ticker.sector,
  ]
    .filter(Boolean)
    .join(' · ')
)
</script>

<template>
  <li class="gmr-card-item" style="list-style: none;">
    <button
      type="button"
      class="gmr-card"
      :class="{ 'gmr-card--active': selected }"
      style="width: 100%; text-align: left; background: transparent; border: 0; padding: 0; cursor: pointer;"
      @click="emit('select', selectValue)"
      @keydown.enter="emit('select', selectValue)"
      @keydown.space.prevent="emit('select', selectValue)"
    >
    <!-- Symbol — show ticker for listed companies, nothing for procurement-only -->
    <span
      v-if="displaySymbol"
      class="ticker-symbol w-16 shrink-0 font-mono text-sm font-bold"
      style="color: var(--accent)"
    >
      {{ displaySymbol }}
    </span>

    <!-- Name + meta -->
    <div class="min-w-0 flex-1">
      <div class="ticker-name truncate text-sm font-medium" style="color: var(--text)">
        {{ ticker.name }}
      </div>
      <div v-if="isPerson && ticker.companies?.length" class="ticker-meta mt-0.5 text-xs" style="color: var(--muted)">
        {{ ticker.companies.join(', ') }}
      </div>
      <div v-else-if="meta" class="ticker-meta mt-0.5 text-xs" style="color: var(--muted)">
        {{ meta }}
      </div>
    </div>

    <!-- Exchange badge — only for listed companies -->
    <span v-if="realTicker && ticker.exchange" class="badge badge-tag">
      {{ ticker.exchange }}
    </span>

    <!-- Entity type badges -->
    <span v-if="isPerson" class="badge badge-auth" data-testid="badge-person">{{ $t('ticker_card.person') }}</span>
    <span v-else-if="isAuthority" class="badge badge-auth" data-testid="badge-auth">{{ $t('ticker_card.authority') }}</span>
    <span v-else-if="isEsef" class="badge badge-esef" data-testid="badge-esef">{{ $t('app.esef') }}</span>
    <span v-else-if="realTicker" class="badge" :class="ticker.is_active ? 'badge-ok' : 'badge-ko'">
      {{ ticker.is_active ? $t('ticker_card.active') : $t('ticker_card.inactive') }}
    </span>
    <span v-else class="badge badge-tag">{{ $t('ticker_card.company') }}</span>
    </button>
  </li>
</template>
