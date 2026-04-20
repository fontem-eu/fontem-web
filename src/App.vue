<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useTheme } from './composables/useTheme.js'
import { useSwipeNav } from './composables/useSwipeNav.js'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import CookieConsentBanner from './components/CookieConsentBanner.vue'

const { init } = useTheme()
// Sync the reactive ref with whatever the anti-FOUC script set on <html>
onMounted(() => init())

// Horizontal swipe between Home / Feed / My Reports on mobile.
useSwipeNav()

const route = useRoute()
// Footer is visible everywhere except the login page (where it would
// displace the form and add link noise during sign-in).
const showFooter = computed(() => route.path !== '/login')
</script>

<template>
  <div class="min-h-screen app-shell" style="background: var(--bg)">
    <AppHeader />
    <router-view />
    <AppFooter v-if="showFooter" />
    <CookieConsentBanner />
  </div>
</template>

<style>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.app-shell > .app-footer {
  margin-top: auto;
}
</style>
