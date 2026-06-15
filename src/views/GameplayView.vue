<script setup>
import { reactive, ref, computed, onMounted, onUnmounted, watch } from 'vue'
import CountUp from '../lib/countUp'
import BackgroundVideo from '../components/BackgroundVideo.vue'
import TeamHeader from '../components/TeamHeader.vue'
import ChatPanel from '../components/ChatPanel.vue'
import PanelButton from '../components/PanelButton.vue'
import { useTosuSocket } from '../composables/useTosuSocket'
import { useConfig } from '../composables/useConfig'
import { useGameState } from '../composables/useGameState'
import { useChat } from '../composables/useChat'
import { dataPath } from '../lib/dataPath'
import {
    formatTime,
    convertAR,
    convertCS,
    convertOD,
    convertBPM,
    convertedTime,
    scoreBarStyle,
    extendedScoreBarStyle,
    reversedScoreBarStyle,
    scoreSize,
} from '../lib/osu'

const { currentStage, pool, teamAvatar } = useConfig()
const { chat, update: updateChatMessages } = useChat()

const gameplayVideo = dataPath('video/gameplay.mp4')

const mapInfo = reactive({
    AR: 0, CS: 0, OD: 0, SR: 0, BPM: 0, LEN: 0,
    Title: '', Artist: '', Creator: '', Difficulty: '',
    mapId: 0, setId: 0, BGUrl: '', MapIdentifier: '',
})

const mapStats = computed(() => [
    { label: 'AR', value: mapInfo.AR },
    { label: 'CS', value: mapInfo.CS },
    { label: 'OD', value: mapInfo.OD },
    { label: 'BPM', value: mapInfo.BPM },
    { label: 'LEN', value: mapInfo.LEN },
    { label: 'SR', value: mapInfo.SR + '★' },
])

const scoreInfo = reactive({ RedScore: 0, BlueScore: 0, BarWidth: 0, BorderWidth: 0 })

const teamInfo = reactive({
    RedTeamName: '', BlueTeamName: '',
    RedTeamHP: 0, BlueTeamHP: 0,
    RedTeamAvatar: '', BlueTeamAvatar: '',
    RedTeamHPPercent: 100, BlueTeamHPPercent: 100,
    MaxHP: 0, RedTeamATK: 0, BlueTeamATK: 0, showAtk: false,
})

const controlPanel = reactive({ comboMode: false, chatMode: false })
const toggleComboMode = () => { controlPanel.comboMode = !controlPanel.comboMode }
const toggleChat = () => { controlPanel.chatMode = !controlPanel.chatMode }

// --- ad rotation ---
const adImages = ref([])
const adIndex = ref(0)
const currentAdUrl = ref('')
const adOpacity = ref(1)
const showAd = computed(() => adImages.value.length > 0)
let adTimer = null
let fadeTimer = null

const setAd = (index) => {
    adIndex.value = index
    currentAdUrl.value = adImages.value[index] || ''
    adOpacity.value = 1
}
const clearTimers = () => {
    if (adTimer) clearInterval(adTimer)
    if (fadeTimer) clearTimeout(fadeTimer)
    adTimer = null
    fadeTimer = null
}
const swapAd = () => {
    if (!adImages.value.length) return setAd(0)
    adOpacity.value = 0
    if (fadeTimer) clearTimeout(fadeTimer)
    fadeTimer = setTimeout(() => {
        setAd((adIndex.value + 1) % adImages.value.length)
    }, 250)
}
const startRotation = () => {
    clearTimers()
    if (!adImages.value.length) return setAd(0)
    setAd(adIndex.value)
    if (adImages.value.length > 1) adTimer = setInterval(swapAd, 20000)
}
const preloadAds = (files) => {
    if (!Array.isArray(files) || files.length === 0) return Promise.resolve([])
    const urls = files.map((file) => dataPath('img/ad/' + file))
    return Promise.all(
        urls.map(
            (url) =>
                new Promise((resolve) => {
                    const img = new Image()
                    img.onload = () => resolve(url)
                    img.onerror = () => resolve(null)
                    img.src = url
                }),
        ),
    ).then((results) => results.filter(Boolean))
}

onMounted(() => {
    fetch(dataPath('img/ad/ad-list.json'))
        .then((res) => res.json())
        .then(preloadAds)
        .then((validUrls) => {
            adImages.value = validUrls
            startRotation()
        })
        .catch(() => {
            adImages.value = []
            startRotation()
        })
})
onUnmounted(() => clearTimers())

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
        mapInfo.BPM = convertBPM(beatmapMng.stats.bpm.common, mapMods).toFixed(0)
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
    }
}

// --- score data ---
const barWidthHistory = []
let lastBarWidth = 0
let lastBarWidthChangeAt = Date.now()

function getBarWidthDelta(currentWidth) {
    const now = Date.now()
    barWidthHistory.push({ t: now, value: currentWidth })

    const epsilon = 0.1
    if (Math.abs(currentWidth - lastBarWidth) > epsilon) {
        lastBarWidth = currentWidth
        lastBarWidthChangeAt = now
    }

    if (now - lastBarWidthChangeAt > 2000 || currentWidth === 0) return 0

    const cutoff = now - 1000
    while (barWidthHistory.length && barWidthHistory[0].t < now - 1000) {
        barWidthHistory.shift()
    }

    let pastValue = barWidthHistory[0]?.value ?? currentWidth
    for (let i = barWidthHistory.length - 1; i >= 0; i--) {
        if (barWidthHistory[i].t <= cutoff) {
            pastValue = barWidthHistory[i].value
            break
        }
    }

    let retVal = currentWidth - pastValue;
    if (retVal > 50) retVal = 50
    else if (retVal < -50) retVal = -50

    return retVal
}

function mapScoreWidth(x) {
    let width
    if (!controlPanel.comboMode) {
        width = 480 * Math.tanh(x / 300000)
    } else {
        width = 480 * Math.tanh(x / 300)
    }
    if (width > 480) return 480
    else if (width < -480) return -480
    else return width
}

function updateScoreData(tourneyMng) {
    let clients = tourneyMng.clients

    let redTeam = clients.filter((client) => client.team === 'left')
    let blueTeam = clients.filter((client) => client.team === 'right')

    let redTeamScore = 0,
        blueTeamScore = 0

    if (!controlPanel.comboMode) {
        redTeamScore = tourneyMng.totalScore.left || 0;
        blueTeamScore = tourneyMng.totalScore.right || 0;
        /*
        redTeamScore = redTeam.reduce((sum, client) => {
            let score = client.play.score || 0
            if (client.play.mods?.name?.includes('EZ')) score = Math.round(score * 1.8)
            return sum + score
        }, 0)
        blueTeamScore = blueTeam.reduce((sum, client) => {
            let score = client.play.score || 0
            if (client.play.mods?.name?.includes('EZ')) score = Math.round(score * 1.8)
            return sum + score
        }, 0)
        */
    } else {
        redTeamScore = redTeam.reduce((sum, client) => sum + client.play.combo.max, 0)
        blueTeamScore = blueTeam.reduce((sum, client) => sum + client.play.combo.max, 0)
    }

    scoreInfo.RedScore = redTeamScore
    scoreInfo.BlueScore = blueTeamScore
    const barWidth = mapScoreWidth(redTeamScore - blueTeamScore)
    scoreInfo.BarWidth = barWidth
    scoreInfo.BorderWidth = 2 * getBarWidthDelta(barWidth)
}

// --- animated score counters (countUp.js owns the innerHTML of #red-score / #blue-score) ---
const redScoreEl = ref(null)
const blueScoreEl = ref(null)
let redScoreCounter = null
let blueScoreCounter = null
// font-rog digits are not equal width, so wrap each digit in a fixed-width span
// (centered) to fake tabular numerals while keeping the font's glyphs.
// A leading "1" gets a narrower cell so it doesn't look gap-y next to its neighbour.
const formatScore = (num) => {
    let isLeading = true
    return Math.round(num)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        .replace(/\d/g, (d) => {
            const cls = isLeading && d === '1' ? 'num-digit num-digit-one' : 'num-digit'
            isLeading = false
            return `<span class="${cls}">${d}</span>`
        })
}
const countUpOptions = { formattingFn: formatScore }

const diffEl = ref(null)
let diffCounter = null
const scoreDiff = () => Math.abs(scoreInfo.RedScore - scoreInfo.BlueScore)

onMounted(() => {
    redScoreCounter = new CountUp(redScoreEl.value, 0, scoreInfo.RedScore, 0, 0.3, countUpOptions)
    redScoreCounter.start()
    blueScoreCounter = new CountUp(blueScoreEl.value, 0, scoreInfo.BlueScore, 0, 0.3, countUpOptions)
    blueScoreCounter.start()
    diffCounter = new CountUp(diffEl.value, 0, scoreDiff(), 0, 0.3, countUpOptions)
    diffCounter.start()
})

watch(() => scoreInfo.RedScore, (value) => redScoreCounter?.update(value))
watch(() => scoreInfo.BlueScore, (value) => blueScoreCounter?.update(value))
watch(scoreDiff, (value) => diffCounter?.update(value))

// --- team data ---
function updateTeamInfo(tourneyMng) {
    teamInfo.RedTeamName = tourneyMng?.team?.left || 'Red Team'
    teamInfo.BlueTeamName = tourneyMng?.team?.right || 'Blue Team'
    teamInfo.showAtk = tourneyMng?.scoreVisible === true
    teamInfo.RedTeamAvatar = teamAvatar(teamInfo.RedTeamName)
    teamInfo.BlueTeamAvatar = teamAvatar(teamInfo.BlueTeamName)
}

useTosuSocket((data) => {
    updateMapData(data.beatmap)
    updateScoreData(data.tourney)
    updateTeamInfo(data.tourney)
    updateChatMessages(data.tourney, controlPanel.chatMode)
})

// --- ref / HP info from localStorage game-state ---
function updateRefInfo(state) {
    const redTeam = state.gameStatus?.teams?.red || {}
    const blueTeam = state.gameStatus?.teams?.blue || {}
    teamInfo.RedTeamHP = redTeam.hp || 0
    teamInfo.BlueTeamHP = blueTeam.hp || 0
    teamInfo.RedTeamATK = redTeam.totalAtk || 0
    teamInfo.BlueTeamATK = blueTeam.totalAtk || 0
    teamInfo.MaxHP = Math.max(teamInfo.MaxHP, teamInfo.RedTeamHP, teamInfo.BlueTeamHP)
    teamInfo.RedTeamHPPercent = teamInfo.MaxHP > 0 ? (teamInfo.RedTeamHP / teamInfo.MaxHP) * 100 : 0
    teamInfo.BlueTeamHPPercent = teamInfo.MaxHP > 0 ? (teamInfo.BlueTeamHP / teamInfo.MaxHP) * 100 : 0
}

useGameState(updateRefInfo)
</script>

<template>
    <div id="main" class="absolute h-[1080px] w-[1920px] text-white">
        <BackgroundVideo :src="gameplayVideo" />

        <TeamHeader :stage="currentStage" :red="{
            name: teamInfo.RedTeamName,
            avatar: teamInfo.RedTeamAvatar,
            hp: teamInfo.RedTeamHP,
            hpPercent: teamInfo.RedTeamHPPercent,
        }" :blue="{
            name: teamInfo.BlueTeamName,
            avatar: teamInfo.BlueTeamAvatar,
            hp: teamInfo.BlueTeamHP,
            hpPercent: teamInfo.BlueTeamHPPercent,
        }" />

        <div id="atk" v-show="teamInfo.showAtk"
            class="absolute top-0 left-0 flex flex-row w-full justify-between px-[62px] py-[130px] text-[20px] font-lexend-black">
            <div>ATK:{{ teamInfo.RedTeamATK }}</div>
            <div>ATK:{{ teamInfo.BlueTeamATK }}</div>
        </div>

        <div id="content" class="h-[720px] w-full relative">
            <div class="h-[360px] w-[480px] bg-purple-400 top-0 left-[240px] absolute"></div>
            <div class="h-[360px] w-[480px] bg-purple-400 top-0 left-[1200px] absolute"></div>
            <div class="h-[360px] w-[480px] bg-purple-400 top-[360px] left-0 absolute"></div>
            <div class="h-[360px] w-[480px] bg-purple-400 top-[360px] left-[480px] absolute"></div>
            <div class="h-[360px] w-[480px] bg-purple-400 top-[360px] left-[960px] absolute"></div>
            <div class="h-[360px] w-[480px] bg-purple-400 top-[360px] left-[1440px] absolute"></div>
        </div>

        <div id="footer" class="relative bottom-0 flex h-[204px] w-full px-[20px]">
            <div id="score-info"
                class="absolute top-0 w-[70%] left-[50%] transform -translate-x-1/2 flex h-[102px] flex-col">
                <div id="reversed-score-bar" class="absolute top-0 h-[20px] transition-[width] duration-500 ease-out"
                    :style="reversedScoreBarStyle(scoreInfo.BarWidth, scoreInfo.BorderWidth)"></div>

                <div id="extended-score-bar" class="absolute top-0 h-[20px] transition-[width] duration-500 ease-out"
                    :style="extendedScoreBarStyle(scoreInfo.BarWidth, scoreInfo.BorderWidth)"></div>

                <div id="score-bar" class="absolute top-0 h-[20px] bg-white transition-[width] duration-500 ease-out"
                    :style="scoreBarStyle(scoreInfo.BarWidth)"></div>

                <p id="red-score" ref="redScoreEl"
                    class="absolute left-[50%] top-[20px] translate-x-[-100%] font-rog pr-3 text-red-200 text-[25px] text-shadow-lg"
                    :style="scoreSize(scoreInfo.BarWidth)">
                    0
                </p>
                <p id="blue-score" ref="blueScoreEl"
                    class="absolute left-[50%] top-[20px] translate-x-[0%] font-rog pl-3 text-blue-200 text-[25px] text-shadow-lg"
                    :style="scoreSize(-scoreInfo.BarWidth)">
                    0
                </p>

                <p id="score-diff"
                    class="absolute left-[50%] top-[67px] translate-x-[-50%] font-rog text-white text-[20px]">
                    <span v-if="scoreInfo.BarWidth > 0" class="absolute right-full pr-1">&lt; </span>
                    <span ref="diffEl">0</span>
                    <span v-if="scoreInfo.BarWidth < 0" class="absolute left-full pl-1"> &gt;</span>
                </p>
            </div>

            <div id="map-info"
                class="absolute top-[102px] flex h-[102px] w-[1240px] flex-row bg-gradient-to-r from-white/20 to-transparent">
                <img id="map-bg" class="relative top-0 h-[102px] w-[400px] object-cover object-center"
                    :src="mapInfo.BGUrl" />

                <div id="map-identifier" class="absolute top-0 left-0 h-[45px] w-[100px]">
                    <div
                        class="absolute top-0 right-[-18px] h-full w-[80px] bg-black rounded-[7px] origin-bottom-left skew-x-[-20deg]">
                    </div>
                    <div class="relative h-full w-full bg-white rounded-tr-3xl"></div>
                    <div
                        class="absolute top-0 right-[-15px] h-full w-[80px] bg-white rounded-[7px] origin-bottom-left skew-x-[-20deg]">
                    </div>
                    <p class="absolute top-0 left-0 text-gray-500 text-[12px] mx-[7px] font-rog w-[200px]">
                        ▶▶ playing
                    </p>
                    <p class="absolute top-[11px] left-0 text-black font-rog mx-[7px] text-[22px] w-[200px]">
                        {{ mapInfo.MapIdentifier }}
                    </p>
                </div>

                <div id="map-display" class="flex flex-1 flex-col px-4 text-white">
                    <p class="mt-[3px] text-[14px] font-rog max-w-[700px]">{{ mapInfo.Artist }}</p>
                    <p class="-mt-[10px] text-[28px] font-rog truncate max-w-[700px]">{{ mapInfo.Title }}</p>
                    <p class="-my-1 text-[14px] font-lexend-regular text-gray-200 truncate max-w-[700px]">
                        [{{ mapInfo.Difficulty }}] - by {{ mapInfo.Creator }}
                    </p>
                    <div id="map-stats" class="mt-[0px] flex flex-row items-end gap-4 text-white">
                        <div v-for="stat in mapStats" :key="stat.label" class="flex items-end gap-2">
                            <span class="text-[14px] opacity-80">{{ stat.label }}</span>
                            <span class="text-[20px] font-lexend-black -m-[2px]">{{ stat.value }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div id="chat" class="absolute top-0 right-[20px] h-full w-[678px]">
                <ChatPanel :messages="chat.messages" :show="chat.showChat" />
            </div>

            <div id="advertisment" class="absolute bottom-0 right-[20px] h-full w-[400px] -z-1">
                <div v-show="showAd"
                    class="h-full w-full rounded-[7px] bg-black bg-cover bg-center transition-opacity duration-500"
                    :style="{ backgroundImage: currentAdUrl ? `url(${currentAdUrl})` : 'none', opacity: adOpacity }">
                </div>
            </div>
        </div>
    </div>

    <div id="control-panel" class="absolute left-[1950px] flex gap-3 m-4 text-white flex-col">
        <PanelButton @click="toggleComboMode">Combo Mode: {{ controlPanel.comboMode }}</PanelButton>
        <PanelButton @click="toggleChat">Force Chat: {{ controlPanel.chatMode }}</PanelButton>
    </div>
</template>
