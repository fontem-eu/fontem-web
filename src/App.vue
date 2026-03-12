<script setup>
import { onMounted } from 'vue'
import { useTheme } from './composables/useTheme.js'

const { init } = useTheme()
// Sync the reactive ref with whatever the anti-FOUC script set on <html>
onMounted(() => init())
</script>

<template>
  <router-view />
</template>
