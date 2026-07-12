<script setup>
import { ref, computed } from 'vue'
import BackgroundVideo from '../components/BackgroundVideo.vue'
import MarqueeText from '../components/MarqueeText.vue'
import StrainGraph from '../components/StrainGraph.vue'
import { useTosuSocket } from '../composables/useTosuSocket'
import { useConfig } from '../composables/useConfig'
import { useAdRotation } from '../composables/useAdRotation'
import { useMapInfo } from '../composables/useMapInfo'
import { dataPath } from '../lib/dataPath'

const { currentStage, pool, teamAvatar } = useConfig()
const showcaseVideo = dataPath('video/showcase.mp4')

// --- strain graph ---
let latestGraph = null
const strainGraph = ref(null)
const liveTime = ref(0)
function updateStrainGraph() {
    strainGraph.value = latestGraph
}

// --- map data (shared with GameplayView) ---
const { mapInfo, updateMapData, findPoolBeatmap } = useMapInfo(pool, {
    onMapChange: updateStrainGraph,
})

// header line: the player's name while a replay/play is loaded, "Now Playing" otherwise
const playerName = ref('')
const npLabel = computed(() => (playerName.value ? `Player: ${playerName.value}` : 'Now Playing'))

useTosuSocket((data) => {
    latestGraph = data.performance?.graph || null
    liveTime.value = data.beatmap?.time?.live || 0
    playerName.value = data.play?.playerName || ''
    updateMapData(data.beatmap, data.folders, data.files)
})

const mapStats = computed(() => [
    { label: 'SR', value: '★' + mapInfo.SR },
    { label: 'AR', value: mapInfo.AR },
    { label: 'CS', value: mapInfo.CS },
    { label: 'OD', value: mapInfo.OD },
    { label: 'BPM', value: mapInfo.BPM },
    { label: 'LEN', value: mapInfo.LEN },
])

// --- pool indicator ---
// bar colour per mod bracket, left to right: NM HD HR DT FM HP TB
const modColors = {
    NM: '#7fa8e8', HD: '#e6df57', HR: '#f0997a', DT: '#9d8ef2',
    FM: '#74dbe0', HP: '#a3e07d', TB: '#e084e0', OP: '#c9c9c9',
}
const poolBeatmaps = computed(() => pool.value?.beatmaps || [])
const currentIndex = computed(() => {
    // reuse the shared id-then-metadata matcher, then locate its position
    const bm = findPoolBeatmap({
        id: mapInfo.mapId,
        title: mapInfo.Title,
        artist: mapInfo.Artist,
        version: mapInfo.Difficulty,
    })
    return bm ? poolBeatmaps.value.indexOf(bm) : -1
})
const pointerLeft = computed(() => {
    const n = poolBeatmaps.value.length
    if (!n || currentIndex.value < 0) return '0%'
    return `${((currentIndex.value + 0.5) / n) * 100}%`
})

// --- ad rotation ---
const { currentAdUrl, adOpacity } = useAdRotation()
</script>

<template>
    <div class="absolute h-[1080px] w-[1920px]">
        <BackgroundVideo :src="showcaseVideo" />
    </div>
    <div id="main" class="absolute h-[1080px] w-[1920px] text-white">
        <div id="header" class="h-[165px] w-full">
            <div class="absolute top-0 left-0 h-[1080px] w-[14px] bg-[#7ba4af] scanline"></div>
            <div class="absolute top-0 right-0 h-[1080px] w-[14px] bg-[#7ba4af] scanline"></div>
            <div class="relative h-full w-full flex flex-row">
                <div class="h-full w-[560px]"></div>
                <div class="h-full w-auto font-rog flex flex-col justify-center px-10">
                    <p class="text-[54px] -mb-3 -mt-5"> {{ currentStage }}</p>
                    <p class="text-[24px]"> showcase </p>
                </div>
            </div>
        </div>
        <div id="content" class="h-[915px] w-full relative">
            <div id="left" class="w-[1440px] h-full absolute left-[14px] flex flex-col">
                <div id="screen" class="w-full h-[810px] bg-purple-400"></div>
                <div id="strain" class="w-full absolute bottom-0 h-[95px]">
                    <StrainGraph :graph="strainGraph" :live="liveTime" :smooth="0.005"/>
                </div>
            </div>
            <div id="right" class="w-[444px] h-full absolute right-[18px] flex items-center flex-col">
                <div id="np" class="w-full h-[42px] bg-linear-to-r from-[#ededed]/20 to-[#ededed]/0 flex flex-col justify-center px-3">
                    <p class="font-lexend-black text-[23px] truncate mx-1">{{ npLabel }}</p>
                </div>
                <div id="map-info" class="w-full h-[250px] relative overflow-hidden">
                    <img id="map-bg" class="absolute top-0 h-full w-full object-cover object-center -z-1"
                    :src="mapInfo.BGUrl" />
                    <div class="absolute inset-0 bg-linear-to-t from-black/80 to-transparent"></div>
                    <div class="relative h-full flex flex-col justify-between px-4 py-2 font-rog leading-none">
                        <p class="text-[85px] drop-shadow-2xl -mt-1"> {{ mapInfo.MapIdentifier }} </p>
                        <div>
                            <MarqueeText class="text-[28px] -mb-1" :text="mapInfo.Artist" :scale-x="0.8" />
                            <MarqueeText class="text-[43px] mb-2" :text="mapInfo.Title" :scale-x="0.85" />
                            <MarqueeText class="font-lexend-regular text-[20px] my-1"
                                :text="`[${mapInfo.Difficulty}] - by ${mapInfo.Creator}`" />
                        </div>
                    </div>
                </div>
                <div id="pool" class="w-[425px] h-[55px] relative">
                    <div v-show="currentIndex >= 0"
                        class="absolute top-2 h-[24px] w-[17px] bg-white -translate-x-1/2 transition-all duration-300"
                        :style="{ left: pointerLeft, clipPath: 'polygon(0 0, 100% 0, 100% 55%, 50% 100%, 0 55%)' }">
                    </div>
                    <div class="absolute bottom-2 left-0 w-full h-[10px] flex gap-[1px]">
                        <div v-for="(bm, i) in poolBeatmaps" :key="i" class="flex-1 rounded-[1px]"
                            :style="{ backgroundColor: modColors[bm.mods] || '#888' }"></div>
                    </div>
                </div>
                <div id="map-stats"
                    class="w-[420px] h-[330px] bg-black/50 font-lexend-black text-white text-[33px] px-5 flex flex-col justify-center rounded-[10px]">
                    <div v-for="stat in mapStats" :key="stat.label"
                        class="flex items-center justify-between h-[48px]">
                        <div class="flex items-center gap-3">
                            <span class="w-[6px] h-[33px] bg-[#7ba4af] rounded-full"></span>
                            <p> {{ stat.label }} </p>
                        </div>
                        <p> {{ stat.value }} </p>
                    </div>
                </div>

                <div id="advertisment" class="absolute bottom-0 h-[214px] w-[420px] -z-1">
                    <div
                        class="h-full w-full rounded-[7px] bg-black bg-cover bg-center transition-opacity duration-500"
                        :style="{ backgroundImage: currentAdUrl ? `url(${currentAdUrl})` : 'none', opacity: adOpacity }">
                    </div>
                </div>


            </div>

        </div>

    </div>
</template>