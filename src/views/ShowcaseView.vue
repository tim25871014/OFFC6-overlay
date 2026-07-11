<script setup>
import { reactive, ref, computed } from 'vue'
import BackgroundVideo from '../components/BackgroundVideo.vue'
import PlayerList from '../components/PlayerList.vue'
import MarqueeText from '../components/MarqueeText.vue'
import StrainGraph from '../components/StrainGraph.vue'
import { useTosuSocket } from '../composables/useTosuSocket'
import { useConfig } from '../composables/useConfig'
import { useAdRotation } from '../composables/useAdRotation'
import { dataPath } from '../lib/dataPath'

import {
    formatTime,
    convertAR,
    convertCS,
    convertOD,
    convertBPM,
    convertedTime,
} from '../lib/osu'

const { currentStage, pool, teamAvatar } = useConfig()
const showcaseVideo = dataPath('video/showcase.mp4')

const mapInfo = reactive({
    AR: 0, CS: 0, OD: 0, SR: 0, BPM: 0, LEN: 0,
    Title: '', Artist: '', Creator: '', Difficulty: '',
    mapId: 0, setId: 0, BGUrl: '', MapIdentifier: '',
})

// --- map data ---
function updateMapData(beatmapMng) {
    const beatmap = pool.value?.beatmaps?.find((b) => b.beatmap_id === beatmapMng.id)
    mapInfo.MapIdentifier = beatmap ? beatmap.identifier : 'EX'
    const mapMods = beatmap ? beatmap.mods : ''

    if (mapInfo.MapIdentifier == 'EX') {
        mapInfo.AR = beatmapMng.stats.ar.original.toFixed(1)
        mapInfo.CS = beatmapMng.stats.cs.original.toFixed(1)
        mapInfo.OD = beatmapMng.stats.od.original.toFixed(1)
        mapInfo.SR = beatmapMng.stats.stars.total.toFixed(2)
        mapInfo.BPM = beatmapMng.stats.bpm.common.toFixed(0)
        mapInfo.LEN = formatTime(beatmapMng.time.lastObject - beatmapMng.time.firstObject)
    } else {
        mapInfo.AR = convertAR(beatmapMng.stats.ar.original, mapMods).toFixed(1)
        mapInfo.CS = convertCS(beatmapMng.stats.cs.original, mapMods).toFixed(1)
        mapInfo.OD = convertOD(beatmapMng.stats.od.original, mapMods).toFixed(1)
        mapInfo.SR = beatmap.sr.toFixed(2)
        mapInfo.BPM = beatmap.bpm.toFixed(0)
        mapInfo.LEN = formatTime(
            convertedTime(beatmapMng.time.lastObject - beatmapMng.time.firstObject, mapMods),
        )
    }

    mapInfo.Title = beatmapMng.title
    mapInfo.Artist = beatmapMng.artist
    mapInfo.Creator = beatmapMng.mapper
    mapInfo.Difficulty = beatmapMng.version

    if (beatmapMng.id != mapInfo.mapId) {
        mapInfo.mapId = beatmapMng.id
        mapInfo.setId = beatmapMng.set
        mapInfo.BGUrl = `https://assets.ppy.sh/beatmaps/${beatmapMng.set}/covers/cover.jpg`
        updateStrainGraph()
    }
}

// --- strain graph ---
let latestGraph = null
const strainGraph = ref(null)
const liveTime = ref(0)
function updateStrainGraph() {
    strainGraph.value = latestGraph
}

useTosuSocket((data) => {
    latestGraph = data.performance?.graph || null
    liveTime.value = data.beatmap?.time?.live || 0
    updateMapData(data.beatmap)
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
const currentIndex = computed(() =>
    poolBeatmaps.value.findIndex((b) => b.beatmap_id === mapInfo.mapId),
)
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
                <div id="np" class="w-full h-[36px] bg-linear-to-r from-[#ededed]/20 to-[#ededed]/0 flex items-center px-3">
                    <p class="font-rog text-[20px] -mt-[3px]"> Now Playing </p>
                </div>
                <div id="map-info" class="w-full h-[250px] relative overflow-hidden">
                    <img id="map-bg" class="absolute top-0 h-full w-full object-cover object-center -z-1"
                    :src="mapInfo.BGUrl" />
                    <div class="absolute inset-0 bg-linear-to-t from-black/80 to-transparent"></div>
                    <div class="relative h-full flex flex-col justify-between px-4 py-2 font-rog leading-none">
                        <p class="text-[85px] drop-shadow-2xl -mt-1"> {{ mapInfo.MapIdentifier }} </p>
                        <div>
                            <MarqueeText class="text-[28px]" :text="mapInfo.Artist" :scale-x="0.8" />
                            <MarqueeText class="text-[45px]" :text="mapInfo.Title" :scale-x="0.8" />
                            <MarqueeText class="font-lexend-regular text-[20px] mt-1"
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
                    class="w-[420px] h-[330px] bg-black/50 font-lexend-black text-white text-[35px] px-5 flex flex-col justify-center">
                    <div v-for="stat in mapStats" :key="stat.label"
                        class="flex items-center justify-between h-[52px]">
                        <div class="flex items-center gap-3">
                            <span class="w-[6px] h-[35px] bg-[#7ba4af] rounded-full"></span>
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