<script setup>
import { computed } from 'vue'
import { hpColor } from '../lib/osu'
import StageLabel from './StageLabel.vue'

// Shared header for gameplay & actions: stage label + side scanline bars + both
// team panels (avatar, name gradient, HP bar).
const props = defineProps({
    stage: { type: String, default: '' },
    red: { type: Object, required: true }, // { name, avatar, hp, hpPercent }
    blue: { type: Object, required: true },
})

const teams = computed(() => [
    {
        id: 'red',
        row: 'flex-row',
        textAlign: 'text-left',
        avatarClass: 'border-red-950 bg-red-950 rounded-tr-none',
        avatar: props.red.avatar,
        nameGradient: 'bg-gradient-to-r from-red-950 to-transparent',
        name: props.red.name,
        hpBarClass: 'red-hp-bar translate-x-[10px] flex items-center',
        skew: 'skewX(-10deg)',
        hpRight: null,
        hpPercent: props.red.hpPercent,
        hp: props.red.hp,
        nameAlign: '',
    },
    {
        id: 'blue',
        row: 'flex-row-reverse',
        textAlign: 'text-right',
        avatarClass: 'border-blue-950 bg-blue-950 rounded-tl-none',
        avatar: props.blue.avatar,
        nameGradient: 'bg-gradient-to-l from-blue-950 to-transparent',
        name: props.blue.name,
        hpBarClass: 'blue-hp-bar translate-x-[-10px]',
        skew: 'skewX(10deg)',
        hpRight: '0',
        hpPercent: props.blue.hpPercent,
        hp: props.blue.hp,
        nameAlign: 'items-end',
    },
])
</script>

<template>
    <div id="header" class="flex h-[156px] w-full relative">
        <StageLabel :stage="stage" />

        <div class="absolute top-0 left-0 h-[1080px] w-[14px] bg-[#7ba4af] scanline"></div>
        <div class="absolute top-0 right-0 h-[1080px] w-[14px] bg-[#7ba4af] scanline"></div>

        <div id="team-info" class="flex justify-between flex-row w-full mx-10 my-7">
            <div v-for="team in teams" :key="`${team.id}-info`" :id="`${team.id}-info`"
                :class="['flex relative', team.row, team.textAlign]">
                <div class="flex flex-col gap-1 relative">
                    <div :id="`${team.id}-avatar`"
                        :class="['w-[140px] h-[105px] border-[3.5px] rounded-[10px] bg-cover bg-center', team.avatarClass]"
                        :style="{ backgroundImage: `url(${team.avatar})` }"></div>
                </div>
                <div :class="['flex flex-col gap-1', team.nameAlign]">
                    <p :class="['px-4 text-[32px] h-[48px] w-[440px] font-rog', team.nameGradient]">
                        {{ team.name }}
                    </p>
                    <div :class="['relative w-[250px] h-[44px] transform', team.hpBarClass]">
                        <div class="absolute size-[100%] rounded-[10px] transition-[width] duration-300 ease-out"
                            :style="{
                                transform: team.skew,
                                right: team.hpRight,
                                width: team.hpPercent + '%',
                                height: team.hpPercent < 7 ? '85%' : '100%',
                                backgroundColor: hpColor(team.hpPercent),
                            }"></div>
                        <div class="absolute size-[100%] rounded-[10px] border-[3px] border-white"
                            :style="{ transform: team.skew }"></div>
                        <p
                            class="text-2xl absolute font-lexend-black text-shadow-lg text-white top-[50%] left-[50%] transform -translate-x-1/2 -translate-y-1/2">
                            {{ team.hp }}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
