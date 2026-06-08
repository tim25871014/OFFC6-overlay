<script setup>
import { onUnmounted } from 'vue'
import { RouterView } from 'vue-router'

onUnmounted(() => {
  localStorage.removeItem('game-state')
})
</script>

<template>
  <RouterView />
</template>
