<script setup>
import { onMounted } from 'vue'
import { useTheme } from './composables/useTheme.js'
import AppHeader from './components/AppHeader.vue'
import CookieConsentBanner from './components/CookieConsentBanner.vue'

const { init } = useTheme()
// Sync the reactive ref with whatever the anti-FOUC script set on <html>
onMounted(() => init())
</script>

<template>
  <div class="min-h-screen" style="background: var(--bg)">
    <AppHeader />
    <router-view />
    <CookieConsentBanner />
  </div>
</template>
