<script setup>
import { computed } from 'vue'
import { useTheme } from '../composables/useTheme.js'

const { theme, cycle } = useTheme()

// Show the current theme's icon; clicking cycles to the next.
// Aria-label names what you'll switch TO so it's announced correctly.
const NEXT_LABEL = {
  light: 'Switch to dark mode',
  dark: 'Switch to autumn theme',
  autumn: 'Switch to light mode',
}
const nextLabel = computed(() => NEXT_LABEL[theme.value] || 'Switch theme')
</script>

<template>
  <button
    type="button"
    class="gmr-toggle"
    :aria-label="nextLabel"
    :data-theme="theme"
    @click="cycle"
  >
    <!-- Moon: currently light, click → dark -->
    <svg
      v-if="theme === 'light'"
      data-testid="moon-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>

    <!-- Leaf: currently dark, click → autumn -->
    <svg
      v-else-if="theme === 'dark'"
      data-testid="leaf-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </svg>

    <!-- Sun: currently autumn, click → light -->
    <svg
      v-else
      data-testid="sun-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  </button>
</template>
