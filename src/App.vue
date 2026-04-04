<script setup>
import { onMounted } from 'vue'
import { useTheme } from './composables/useTheme.js'
import AppHeader from './components/AppHeader.vue'

const { init } = useTheme()
// Sync the reactive ref with whatever the anti-FOUC script set on <html>
onMounted(() => init())
</script>

<template>
  <div class="min-h-screen" style="background: var(--bg)">
    <AppHeader />
    <router-view />
  </div>
</template>
