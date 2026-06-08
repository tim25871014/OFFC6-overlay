<script setup>
// The black square toggle button used in the gameplay/actions/winner control panels.
defineEmits(['click'])
</script>

<template>
  <button class="bg-black size-25" @click="$emit('click')"><slot /></button>
</template>
