<script setup>
// Player avatar + name rows. `intro` uses an <img> avatar (optionally mirrored for the
// red side); `winner` uses a larger background-image avatar. The spacing wrapper is
// provided by the parent view.
defineProps({
    players: { type: Array, default: () => [] },
    variant: { type: String, default: 'intro' }, // 'intro' | 'winner'
    reverse: { type: Boolean, default: false },
})
</script>

<template>
    <template v-if="variant === 'winner'">
        <div v-for="(player, idx) in players" :key="idx" class="flex flex-row gap-[10px]">
            <div class="rounded-full w-[56px] h-[56px] bg-cover bg-center"
                :style="{ backgroundImage: `url(${player.avatarUrl})` }"></div>
            <p class="font-lexend-exblack text-[40px]">{{ player.userName }}</p>
        </div>
    </template>
    <template v-else>
        <div v-for="(player, idx) in players" :key="idx" class="flex gap-3 items-center"
            :class="reverse ? 'flex-row-reverse' : ''">
            <img :src="player.avatarUrl" class="size-[50px] rounded-full" />
            <p class="font-lexend-exblack text-[40px]">{{ player.userName }}</p>
        </div>
    </template>
</template>
