<script setup>
// Full-screen looping background video (videos live in _data/video, added at deploy time).
defineProps({
  src: { type: String, default: '' },
})
</script>

<template>
  <video :src="src" autoplay loop class="absolute top-0 left-0 -z-10"></video>
</template>
