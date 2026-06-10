<script setup>
defineProps({
    stage: { type: String, default: '' },
})
</script>

<template>
    <div class="absolute top-[140px] left-[50%] transform -translate-x-1/2 font-rog text-[25px]">
        {{ stage }}
    </div>
</template>
