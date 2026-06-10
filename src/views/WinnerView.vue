<script setup>
import { reactive, ref, computed } from 'vue'
import BackgroundVideo from '../components/BackgroundVideo.vue'
import StageLabel from '../components/StageLabel.vue'
import PlayerList from '../components/PlayerList.vue'
import PanelButton from '../components/PanelButton.vue'
import { useTosuSocket } from '../composables/useTosuSocket'
import { useConfig } from '../composables/useConfig'
import { useGameState } from '../composables/useGameState'
import { dataPath } from '../lib/dataPath'

const { teams: teamConfig, currentStage, teamAvatar } = useConfig()

const teams = reactive({ blue: '', red: '' })
const avatar = reactive({ blue: '', red: '' })
const winner = ref('red')
const bgUrl = ref('')
const redPlayers = ref([])
const bluePlayers = ref([])

const forceWinner = ref('auto')

const stage = computed(() => currentStage.value)
const winnerName = computed(() =>
    winner.value === 'red' ? teams.red : winner.value === 'blue' ? teams.blue : 'None',
)

function toggleWinner() {
    if (forceWinner.value === 'auto') forceWinner.value = 'red'
    else if (forceWinner.value === 'red') forceWinner.value = 'blue'
    else forceWinner.value = 'auto'
}

function updateTeamInfo(tourneyMng) {
    teams.red = tourneyMng?.team?.left || 'Red Team'
    teams.blue = tourneyMng?.team?.right || 'Blue Team'
    avatar.red = teamAvatar(teams.red)
    avatar.blue = teamAvatar(teams.blue)
}

function updatePlayerInfo() {
    const redTeam = teamConfig.value.find((t) => t.teamName === teams.red)?.players || []
    const blueTeam = teamConfig.value.find((t) => t.teamName === teams.blue)?.players || []
    redTeam.forEach((player) => {
        player.avatarUrl = `https://a.ppy.sh/${player.id}`
    })
    blueTeam.forEach((player) => {
        player.avatarUrl = `https://a.ppy.sh/${player.id}`
    })
    redPlayers.value = redTeam
    bluePlayers.value = blueTeam
}

useTosuSocket((data) => {
    updateTeamInfo(data.tourney)
    updatePlayerInfo()
})

function updateWinners(state) {
    if (forceWinner.value !== 'auto') {
        winner.value = forceWinner.value
        bgUrl.value = dataPath('video/winner_' + forceWinner.value + '.mp4')
        return
    }
    const red = state.gameStatus?.teams?.red
    const blue = state.gameStatus?.teams?.blue
    if (red == null || blue == null) return
    if (red.hp > blue.hp) {
        winner.value = 'red'
        bgUrl.value = dataPath('video/winner_red.mp4')
    } else if (red.hp < blue.hp) {
        winner.value = 'blue'
        bgUrl.value = dataPath('video/winner_blue.mp4')
    } else {
        winner.value = 'none'
        bgUrl.value = dataPath('video/winner_red.mp4')
    }
}

useGameState(updateWinners)
</script>

<template>
    <div id="main" class="absolute h-[1080px] w-[1920px] text-white">
        <BackgroundVideo :src="bgUrl" />

        <div id="header" class="flex h-[200px] w-full relative">
            <StageLabel :stage="stage" />
        </div>

        <div id="content" class="h-[720px] w-full flex flex-col items-center gap-5 mt-5">
            <div class="font-rog text-[100px]">WINNER</div>
            <div class="w-[1200px] h-[85px] bg-linear-to-r flex items-center justify-center" :class="winner == 'red'
                    ? 'from-transparent via-[#600000]/80 to-transparent'
                    : winner === 'blue'
                        ? 'from-transparent via-[#000090]/80 to-transparent'
                        : 'from-transparent via-[#555555]/80 to-transparent'
                ">
                <p class="font-rog text-[50px] transform translate-y-[-5px]">{{ winnerName }}</p>
            </div>

            <div class="w-full h-full flex gap-16 justify-center">
                <div class="w-[520px] h-full relative">
                    <div class="absolute top-0 left-0 size-[35px] rounded-full animate-pulse" :class="winner == 'red'
                            ? 'bg-[#ff9d8e]'
                            : winner === 'blue'
                                ? 'bg-[#96bcff]'
                                : 'bg-[#555555]'
                        "></div>

                    <div class="absolute top-[14px] left-[14px] w-[502px] h-[387px] border-[12px] rounded-[76px]"
                        :class="winner == 'red'
                                ? 'border-[#cc7066]'
                                : winner === 'blue'
                                    ? 'border-[#6688cc]'
                                    : 'border-[#888888]'
                            "></div>
                    <svg width="502" height="387" viewBox="-6 -6 502 387" class="absolute top-[14px] left-[14px]">
                        <rect x="0" y="0" width="490" height="375" rx="70" ry="70" fill="none" stroke-width="12"
                            stroke-linecap="round" stroke-dasharray="1610 1610"
                            :stroke="winner == 'red' ? '#ff9d8e' : winner === 'blue' ? '#96bcff' : '#555555'"
                            style="animation: snake 3s ease-in-out infinite" />
                    </svg>
                    <div class="absolute top-[375px] left-[500px] size-[35px] rounded-full animate-pulse" :class="winner == 'red'
                            ? 'bg-[#ff9d8e]'
                            : winner === 'blue'
                                ? 'bg-[#96bcff]'
                                : 'bg-[#555555]'
                        "></div>
                    <div id="avatar"
                        class="w-[440px] h-[330px] absolute top-[42px] left-[45px] rounded-[50px] bg-cover bg-center"
                        :style="winner === 'red'
                                ? { backgroundImage: `url(${avatar.red})` }
                                : { backgroundImage: `url(${avatar.blue})` }
                            "></div>
                </div>

                <div id="player-list" class="w-auto h-full py-[22px] space-y-[4px]">
                    <PlayerList :players="winner === 'red' ? redPlayers : bluePlayers" variant="winner" />
                </div>
            </div>
        </div>
    </div>

    <div id="control-panel" class="absolute left-[1950px] flex gap-3 m-4 text-white flex-col">
        <PanelButton @click="toggleWinner">Winner: {{ forceWinner }}</PanelButton>
    </div>
</template>
